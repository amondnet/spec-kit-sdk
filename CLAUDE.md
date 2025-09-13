# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@STANDARDS.md

## Project Overview

This is a Spec-Kit SDK monorepo built with Bun and Turborepo, focused on Spec-Driven Development (SDD) workflows. The project provides a TypeScript library for creating cross-platform development tools and scripts, with a custom command system integrated with Claude.

## Key Commands

### Build & Development
```bash
# Install dependencies (using Bun)
bun install

# Build all packages
turbo build

# Run linting
turbo lint

# Run type checking
turbo check-types

# Build the scripts package
cd packages/scripts && bun build

# Run tests for scripts package
cd packages/scripts && bun test
cd packages/scripts && bun test:unit
cd packages/scripts && bun test:integration
cd packages/scripts && bun test:contract
cd packages/scripts && bun test:coverage
```

### Spec-Kit Custom Commands

The repository includes custom Claude commands in `.claude/commands/`:

- `/specify <feature-description>` - Create a new feature specification and branch
- `/plan <implementation-details>` - Generate implementation plan and design artifacts
- `/implement` - Execute implementation based on plan
- `/tasks` - Manage and track development tasks

### Spec-Kit Scripts

Execute scripts directly from `.specify/scripts/bash/`:
```bash
# Create new feature with JSON output
.specify/scripts/bash/create-new-feature.sh --json "feature description"

# Setup implementation plan
.specify/scripts/bash/setup-plan.sh --json

# Check task prerequisites
.specify/scripts/bash/check-task-prerequisites.sh

# Update agent context
.specify/scripts/bash/update-agent-context.sh

# Get feature paths
.specify/scripts/bash/get-feature-paths.sh
```

## Architecture & Structure

### Monorepo Layout
- **packages/scripts**: TypeScript library providing spec-kit functionality with exports for different commands
- **packages/tooling-config**: Shared configuration package
- **.specify/**: Spec-kit specific files (templates, scripts, memory)
- **.claude/**: Claude-specific configurations (commands, agents, settings)
- **memory/**: Constitutional requirements and project memory
- **submodules/**: Git submodules for spec-kit integration

### Package Architecture (@spec-kit/scripts)
The main package uses modular exports for different commands:
- `/create-feature` - Feature creation functionality
- `/setup-plan` - Plan setup utilities
- `/update-agent-context` - Agent context management
- `/check-prerequisites` - Task prerequisite checking
- `/get-paths` - Feature path resolution

### Spec-Kit Workflow
1. **Specification Phase**: Use `/specify` to create feature specs from natural language
2. **Planning Phase**: Use `/plan` to generate implementation plans with design artifacts
3. **Implementation Phase**: Execute tasks based on generated plans
4. **Templates**: Located in `.specify/templates/` for specs, plans, and other artifacts

### Key Technologies
- **Bun**: Runtime and package manager (v1.2.20)
- **Turborepo**: Monorepo build system
- **TypeScript**: Primary language with ES modules
- **Simple-git**: Git operations in scripts
- **Picocolors**: Terminal output formatting

## Important Notes

- This project is undergoing modernization from bash scripts to TypeScript (see github-issue-spec-kit-modernization.md)
- All file paths in commands should be absolute to avoid path resolution issues
- The project uses Bun's native TypeScript support - no separate compilation step needed for development
- Custom Claude agents are defined in `.claude/agents/` for specialized workflows
- Constitutional requirements are maintained in `.specify/memory/constitution.md`
