# ρ Pi Gemini Agent Extension

This extension integrates the **Gemini CLI Agent Mode** directly into the [Pi coding agent](https://github.com/badlogic/pi-mono). It allows Pi to delegate complex, multi-file autonomous tasks to Gemini's native agentic loop (YOLO mode).

## Features

- **`gemini_agent` Tool**: A tool that Pi can call to run the Gemini CLI autonomously.
- **`/gemini` Command**: A slash command to quickly trigger the Gemini agent from the Pi terminal.
- **Real-time Telemetry**: Streams assistant output and tool usage from Gemini back to the Pi UI.
- **Automatic Agent Discovery**: Automatically installs specialized proxy agents for use with `pi-subagents`.

## Prerequisites

- **[Pi Coding Agent](https://github.com/badlogic/pi-mono)** installed and configured.
- **[Pi Subagents](https://github.com/nicobailon/pi-subagents)** installed (for chaining features).
- **[Gemini CLI](https://github.com/google/gemini-cli)** installed and authenticated.

## Agent Chaining

This extension enables powerful agent chaining by providing "Proxy Agents" that Pi can orchestrate.

### Available Proxy Agents

- **`gemini`**: General-purpose autonomous worker.
- **`gemini-coder`**: Expert coding agent for complex refactoring and bug fixing.
- **`gemini-researcher`**: Specialized research and synthesis agent.

### Chaining Example

You can chain Gemini agents together using the `/chain` command from `pi-subagents`:

```bash
/chain gemini-researcher "Analyze competitive features of X" -> gemini-coder "Implement a similar feature in our project"
```

## Usage

### As a Tool
Pi can automatically choose to use the `gemini_agent` tool when faced with complex tasks if it's enabled in your session.

### As a Command
Type `/gemini <task>` in the Pi terminal to start the Gemini agent:
```bash
/gemini "Refactor the authentication logic to use JWT"
```

## Installation

### Local Installation (for this project)
```bash
pi install ./extensions/gemini-agent -l
```

### Manual Installation
1. Copy the `extensions/gemini-agent` directory to `~/.pi/agent/extensions/`.
2. Run `npm install` in that directory.
3. Restart Pi or run `/reload`.

## License

MIT
