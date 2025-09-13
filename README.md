# Spec-Kit SDK

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
- **`@spec-kit/scripts`**: TypeScript library for Spec-Kit scripts with cross-platform support
- **`spec-kit`**: Meta package for easy installation

### Development

This project uses:
- **Bun** as the JavaScript runtime and package manager
- **Turbo** for monorepo management
- **TypeScript** for type safety

### Building

```bash
# Install dependencies
bun install

# Build all packages
turbo build

# Run tests
turbo test

# Lint
turbo lint
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Acknowledgements

This project is inspired by [GitHub's spec-kit](https://github.com/github/spec-kit) project, which introduces the Spec-Driven Development methodology.
