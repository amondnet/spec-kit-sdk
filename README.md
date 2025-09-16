# Spec-Kit SDK

[![GitHub Issues](https://img.shields.io/badge/+-GitHub%20Issues-1f2328)](https://github.com/amondnet/spec-kit-sdk/issues)
&nbsp;
[![MIT License](https://img.shields.io/badge/License-MIT-28a745)](https://github.com/amondnet/spec-kit-sdk/blob/main/LICENSE)
&nbsp;
[![Star this repo](https://img.shields.io/badge/★-Star%20this%20repo-e7b10b)](https://github.com/amondnet/spec-kit-sdk)

[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=bugs)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=coverage)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk) [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=amondnet_spec-kit-sdk&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=amondnet_spec-kit-sdk)
[![codecov](https://codecov.io/gh/amondnet/spec-kit-sdk/graph/badge.svg?token=q1VdMk4ZGb)](https://codecov.io/gh/amondnet/spec-kit-sdk)

A TypeScript/Bun implementation of Spec-Driven Development tools, inspired by [GitHub's spec-kit](https://github.com/github/spec-kit).

> **Note**: This is an independent TypeScript implementation that provides npm packages for the Spec-Driven Development methodology. While inspired by GitHub's spec-kit project, this implementation is separately maintained and focuses on the npm/TypeScript ecosystem.

## Installation

```bash
npm install -g @spec-kit/cli
```

Both methods install the same CLI tool with the `specify` command.

## Packages

This monorepo includes the following packages:

### Published Packages

- **`@spec-kit/cli`**: The main CLI tool for Spec-Driven Development
- **`@spec-kit/core`**: Core utilities and configuration management
- **`@spec-kit/scripts`**: TypeScript library for Spec-Kit scripts with cross-platform support
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

## Configuration

Spec-Kit uses a centralized configuration system through `.specify/config.yml`:

```yaml
version: "1.0"

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
