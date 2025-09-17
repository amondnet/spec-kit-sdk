# @spec-kit/official-wrapper

[![npm version](https://badge.fury.io/js/@spec-kit%2Fofficial-wrapper.svg)](https://www.npmjs.com/package/@spec-kit/official-wrapper)

> ⚠️ **Development Status**: This package is currently under active development. APIs and features may change.

Official GitHub Spec-Kit wrapper and command router for the spec-kit-sdk project.

## Overview

This package provides seamless integration between the local Bun-based spec-kit implementation and the official GitHub spec-kit. It offers two execution modes to give users flexibility in choosing their preferred implementation.

## Features

- **Dual Execution Modes**: Choose between `bun-first` and `official-first` strategies
- **Automatic Fallback**: Intelligent command routing with fallback mechanisms
- **Configuration-Driven**: Simple YAML-based configuration
- **APM Ready**: Full support for GitHub spec-kit PR #271 APM features
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
bun add @spec-kit/official-wrapper
```

## Usage

### Basic Setup

```typescript
import { CommandRouter } from '@spec-kit/official-wrapper'

const router = new CommandRouter({
  mode: 'bun-first', // or 'official-first'
  official: {
    repository: 'git+https://github.com/github/spec-kit.git'
  }
})

// Execute a command
await router.execute('init', ['my-project'])
```

### Configuration

Add CLI configuration to your `.specify/config.yml`:

```yaml
version: '1.0'
cli:
  mode: bun-first # or official-first
  official:
    repository: 'git+https://github.com/github/spec-kit.git'
```

## Execution Modes

### bun-first (Default)

1. Check if command exists in local Bun implementation
2. If yes → execute with Bun
3. If no → execute with official spec-kit via `uvx`

**Best for**: Users who prefer the fast local implementation with official fallback for new features.

### official-first

1. Try to execute with official spec-kit via `uvx`
2. If command not found → check Bun implementation
3. If exists in Bun → execute with Bun
4. If not → show error

**Best for**: Users who want to use the latest official features with local fallback for stability.

## API Reference

### CommandRouter

Main class for routing commands between implementations.

#### Constructor

```typescript
new CommandRouter(config?: CLIConfig)
```

#### Methods

- `execute(command: string, args: string[]): Promise<ExecutionResult>`
- `hasLocalCommand(command: string): boolean`
- `getMode(): ExecutionMode`
- `setMode(mode: ExecutionMode): void`
- `isOfficialAvailable(): Promise<boolean>`

### OfficialExecutor

Handles execution of commands via the official spec-kit using `uvx`.

#### Constructor

```typescript
new OfficialExecutor(config?: OfficialConfig)
```

#### Methods

- `execute(command: string, args: string[]): Promise<ExecutionResult>`
- `isAvailable(): Promise<boolean>`
- `getRepository(): string`
- `updateRepository(repository: string): void`

## Requirements

For official spec-kit execution:

- [uv](https://docs.astral.sh/uv/getting-started/installation/) must be installed
- Internet connection for downloading the official spec-kit

## Examples

### Basic Command Execution

```typescript
import { CommandRouter } from '@spec-kit/official-wrapper'

const router = new CommandRouter()

// This will use local 'init' command (bun-first mode)
await router.execute('init', ['my-project'])

// This will try official spec-kit for APM commands
await router.execute('apm', ['install'])
```

### Checking Official Availability

```typescript
const router = new CommandRouter()

if (await router.isOfficialAvailable()) {
  console.log('Official spec-kit is available')
}
else {
  console.log('Official spec-kit requires uv installation')
}
```

### Dynamic Command Registration

```typescript
const router = new CommandRouter()

// Add custom local command
router.addLocalCommand('custom-cmd')

// Check if command is local
if (router.hasLocalCommand('custom-cmd')) {
  // Handle locally
}
```

## Error Handling

The router handles various error scenarios:

- **uvx not installed**: Graceful fallback with helpful error message
- **Command not found**: Appropriate error reporting
- **Execution failures**: Proper exit code handling

## Testing

```bash
# Run unit tests
bun test

# Run with coverage
bun test --coverage
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build the package
bun run build

# Type checking
bun run check-types
```

## Contributing

1. Follow the project's coding standards in [STANDARDS.md](../../STANDARDS.md)
2. Write tests for new functionality
3. Ensure type safety with TypeScript
4. Test both execution modes

## License

MIT
