# @spec-kit/cli

[![npm version](https://badge.fury.io/js/@spec-kit%2Fcli.svg)](https://www.npmjs.com/package/@spec-kit/cli)

Spec-Kit CLI - Setup tool for Spec-Driven Development projects

## Installation

```bash
# Install globally with Bun
bun install -g @spec-kit/cli

# Or use directly with bunx
bunx @spec-kit/cli init my-project
```

## Usage

### Initialize a new project

```bash
# Create a new project directory
specify init my-project

# Initialize in current directory
specify init --here

# Specify AI assistant
specify init my-project --ai claude
specify init my-project --ai gemini
specify init my-project --ai copilot
specify init my-project --ai cursor

# Specify script type
specify init my-project --script sh  # POSIX shell (default on Unix)
specify init my-project --script ps  # PowerShell (default on Windows)

# Skip git initialization
specify init my-project --no-git

# Skip AI tool checks
specify init my-project --ignore-agent-tools
```

### Check installed tools

```bash
specify check
```

## Features

- 🚀 **Cross-platform**: Works on Windows, macOS, and Linux
- 🤖 **AI Assistant Support**: Templates for Claude Code, Gemini CLI, GitHub Copilot, and Cursor
- 📦 **Template System**: Downloads latest templates from GitHub releases
- 🎯 **Interactive Setup**: Arrow-key selection for configuration options
- 🌳 **Progress Tracking**: Tree-based visualization of setup steps
- 🔧 **Tool Detection**: Automatic checking of required tools
- 📜 **Script Variants**: Support for both POSIX shell and PowerShell scripts

## Architecture

The CLI is built with:

- **Bun**: Runtime and package manager
- **TypeScript**: Type-safe development
- **Commander**: CLI framework
- **Inquirer**: Interactive prompts
- **Picocolors**: Terminal colors

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Build for production
bun run build

# Run tests
bun test

# Build standalone executables
bun run build:standalone  # Current platform
bun run build:windows     # Windows
bun run build:mac         # macOS
bun run build:linux       # Linux
```

## Migration from Python CLI

This TypeScript implementation replaces the original Python `specify_cli` with:

- Better performance through Bun's native compilation
- Type safety and better IDE support
- Consistent tooling with the rest of the spec-kit ecosystem
- Easier testing and maintenance

### Feature Parity

All features from the Python CLI are preserved:

- ✅ Interactive AI assistant selection
- ✅ Script type selection (sh/ps)
- ✅ Template downloading from GitHub
- ✅ Git repository initialization
- ✅ Progress tracking with tree display
- ✅ Tool availability checking
- ✅ Cross-platform support
- ✅ `--here` flag for current directory initialization

## License

MIT
