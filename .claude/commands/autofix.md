---
description: Automates code quality fixes using lint and type checking with parallel agents.
argument-hint: [file_path]
---

# Autofix Command

This command provides automated fixing workflows for code quality issues using parallel agent processing.

## Process

1. **Lint Fix**:
   - Run `bunx eslint --fix $ARGUMENTS` to auto-fix linting issues
   - For remaining lint errors, use general-purpose agents in parallel to fix each affected file

2. **Type Check Fix**:
   - Run `bunx tsc --no-emit typecheck $ARGUMENTS` to identify type errors
   - For type errors, use general-purpose agents in parallel to fix each affected file

## Usage

The autofix process leverages parallel agent execution for efficient resolution of code quality issues across multiple files simultaneously.