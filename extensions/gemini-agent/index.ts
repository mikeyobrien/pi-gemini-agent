import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function (pi: ExtensionAPI) {
  // Symlink agents on session start for discovery by pi-subagents
  pi.on("session_start", () => {
    const agentsSourceDir = path.join(__dirname, "agents");
    const agentsTargetDir = path.join(os.homedir(), ".pi", "agent", "agents");

    if (fs.existsSync(agentsSourceDir) && fs.existsSync(agentsTargetDir)) {
      try {
        const files = fs.readdirSync(agentsSourceDir);
        for (const file of files) {
          if (file.endsWith(".md")) {
            const src = path.join(agentsSourceDir, file);
            const dest = path.join(agentsTargetDir, file);
            if (!fs.existsSync(dest)) {
              fs.symlinkSync(src, dest);
            }
          }
        }
      } catch (err) {
        // Silently fail if symlink fails (e.g. permissions or already exists)
      }
    }
  });

  pi.registerTool({
    name: "gemini_agent",
    label: "Gemini Agent",
    description: "Delegates a complex autonomous task to the Gemini CLI Agent. Use this for multi-file refactoring, deep research, or when the user asks for 'agent mode' or 'Gemini'.",
    parameters: Type.Object({
      task: Type.String({ description: "The task to perform" }),
      cwd: Type.Optional(Type.String({ description: "The working directory for the agent (defaults to current directory)" })),
      model: Type.Optional(Type.String({ description: "Optional Gemini model override" })),
      approval_mode: Type.Optional(Type.Enum({ default: "yolo", enum: ["yolo", "auto_edit", "default", "plan"] }, { description: "Approval mode for tools. 'yolo' is fully autonomous." })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const task = params.task;
      const cwd = params.cwd || ctx.cwd;
      const model = params.model;
      const approvalMode = params.approval_mode || "yolo";

      const args = ["-p", task, "--approval-mode", approvalMode, "--output-format", "stream-json"];
      if (model) args.push("-m", model);

      const child = spawn("gemini", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "1" }
      });

      let stdout = "";
      let stderr = "";
      let lastAssistantMessage = "";
      let lastToolName = "";
      let lastToolArgs = "";
      let toolCallCount = 0;

      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const event = JSON.parse(line);
          if (event.type === "message" && event.role === "assistant" && event.content) {
             lastAssistantMessage += event.content;
          } else if (event.type === "tool_use") {
             toolCallCount++;
             lastToolName = event.tool_name;
             lastToolArgs = JSON.stringify(event.parameters || {});
          } else if (event.type === "tool_result") {
             // result event
          }

          let display = lastAssistantMessage || "(starting agent...)";
          if (lastToolName) {
            display += `\n\n${lastToolName}(${lastToolArgs})`;
          }
          if (toolCallCount > 0) {
            display += `\n\n(Total tools used: ${toolCallCount})`;
          }
          onUpdate?.({ content: [{ type: "text", text: display }] });
        } catch {
          // Ignore non-json lines
        }
      };

      let buffer = "";
      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(processLine);
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      if (signal) {
        signal.addEventListener("abort", () => {
          child.kill("SIGTERM");
        }, { once: true });
      }

      const exitCode = await new Promise<number>((resolve) => {
        child.on("close", (code) => resolve(code ?? 0));
        child.on("error", () => resolve(1));
      });

      if (buffer.trim()) processLine(buffer);

      if (exitCode !== 0 && !lastAssistantMessage) {
        return {
          content: [{ type: "text", text: `Gemini Agent failed with exit code ${exitCode}\n\n${stderr}` }],
          isError: true,
          details: { stderr, exitCode }
        };
      }

      return {
        content: [{ type: "text", text: lastAssistantMessage || "Task completed." }],
        details: { stdout, stderr, exitCode, toolCallCount }
      };
    }
  });

  pi.registerCommand("gemini", {
    description: "Run Gemini CLI in agent mode (YOLO). Supports --model <id>.",
    handler: async (args, ctx) => {
      let task = args.trim();
      if (!task) {
        ctx.ui.notify("Usage: /gemini [--model <id>] <task>", "error");
        return;
      }

      let model: string | undefined;
      const modelMatch = task.match(/(?:--model|-m)\s+(\S+)/);
      if (modelMatch) {
        model = modelMatch[1];
        task = task.replace(modelMatch[0], "").trim();
      }

      if (!task) {
        ctx.ui.notify("Usage: /gemini [--model <id>] <task>", "error");
        return;
      }

      ctx.ui.notify(`Starting Gemini Agent${model ? ` (${model})` : ""}...`, "info");
      pi.sendUserMessage(`Run gemini_agent with this task: "${task}"${model ? `, model: "${model}"` : ""}`);
    }
  });
}
