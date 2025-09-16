# Spec-Kit SDK

[![GitHub Issues](https://img.shields.io/badge/+-GitHub%20Issues-1f2328)](https://github.com/amondnet/spec-kit-sdk/issues)
&nbsp;
[![MIT License](https://img.shields.io/badge/License-MIT-28a745)](https://github.com/amondnet/spec-kit-sdk/blob/main/LICENSE)
&nbsp;
[![Star this repo](https://img.shields.io/badge/★-Star%20this%20repo-e7b10b)](https://github.com/amondnet/spec-kit-sdk)

[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=bugs)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=coverage)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk)
[![codecov](https://codecov.io/gh/amondnet/spec-kit-sdk/graph/badge.svg?token=q1VdMk4ZGb)](https://codecov.io/gh/amondnet/spec-kit-sdk)

A TypeScript/Bun implementation of Spec-Driven Development tools with seamless integration to the [official GitHub spec-kit](https://github.com/github/spec-kit).

> **Features**: This implementation provides both local Bun-based commands and integration with the official GitHub spec-kit. Users can choose between `bun-first` or `official-first` execution modes, with intelligent fallback for maximum compatibility.

## Installation

```bash
npm install -g @spec-kit/cli
```

Both methods install the same CLI tool with the `specify` command.

## Packages

This monorepo includes the following packages:

### Published Packages

- **`@spec-kit/cli`**: The main CLI tool for Spec-Driven Development with dual execution modes
- **`@spec-kit/core`**: Core utilities, configuration management, and CLI mode schemas
- **`@spec-kit/scripts`**: TypeScript library for Spec-Kit scripts with cross-platform support
- **`@spec-kit/official-wrapper`**: Wrapper for official GitHub spec-kit integration and command routing
- **`spec-kit`**: Meta package for easy installation

### Plugins

- **`@spec-kit/plugin-sync`**: Universal sync plugin for synchronizing specs with issue tracking platforms (GitHub, Jira, Asana)

### Development

This project uses:
- **Bun** as the JavaScript runtime and package manager
- **Turbo** for monorepo management
- **TypeScript** for type safety

### Prerequisites

- **Bun** v1.2.20 or higher
- **GitHub CLI** (for sync plugin functionality)
- **Git** (required for all operations)
- **Node.js** 18+ (optional, for npm compatibility)
- **uv/uvx** (optional, for official GitHub spec-kit integration)

## Configuration

Spec-Kit uses a centralized configuration system through `.specify/config.yml`:

```yaml
version: "1.0"

cli:
  mode: bun-first  # or official-first
  official:
    repository: "git+https://github.com/github/spec-kit.git"

plugins:
  sync:
    platform: github
    autoSync: true
    conflictStrategy: manual
    github:
      owner: ${GITHUB_OWNER}
      repo: ${GITHUB_REPO}
      auth: cli
```

### Configuration Management

```bash
# Initialize a new config file
specify config init

# Show current configuration
specify config show

# Validate configuration
specify config validate

# List configured plugins
specify config plugins
```

### Environment Variables

Configuration supports environment variable interpolation:

```bash
export GITHUB_OWNER=your-org
export GITHUB_REPO=your-repo
export GITHUB_TOKEN=your-token  # Optional, for token-based auth
```

Variables can be referenced in config files using `${VARIABLE_NAME}` syntax.

### CLI Execution Modes

The CLI supports two execution modes for maximum flexibility:

#### bun-first (Default)
1. Check if command exists in local Bun implementation
2. If yes → execute with Bun (fast, local)
3. If no → execute with official spec-kit via `uvx`

**Best for**: Users who prefer fast local execution with official fallback for new features like APM commands.

#### official-first
1. Try official spec-kit via `uvx` first
2. If command fails → fallback to local Bun implementation
3. Appropriate error handling for missing commands

**Best for**: Users who want the latest official features with local fallback for stability.

#### Examples

```bash
# These commands use local Bun implementation (bun-first mode)
specify init my-project
specify check
specify sync push

# These commands automatically fallback to official spec-kit
specify apm init        # APM commands from GitHub PR #271
specify apm install
specify apm compile
specify apm deps
```

### Building

```bash
# Install dependencies
bun install

# Build all packages
turbo build

# Run tests
turbo test

# Lint (with auto-fix)
turbo lint --fix

# Type checking
turbo typecheck

# Quality check sequence
turbo lint --fix && turbo typecheck && bun test
```

## Documentation

For detailed development guidance, refer to:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design patterns
- **[STANDARDS.md](./STANDARDS.md)** - Coding standards and mandatory rules
- **[TESTING.md](./TESTING.md)** - Testing guidelines and best practices
- **[CLAUDE.md](./CLAUDE.md)** - AI-assisted development guide

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Acknowledgements

This project is inspired by [GitHub's spec-kit](https://github.com/github/spec-kit) project, which introduces the Spec-Driven Development methodology.
