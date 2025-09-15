#!/bin/bash

# Claude Code hook script for spec synchronization
# This script is called before reading spec files

# Get the file path from the tool input
FILE_PATH=$(echo "$1" | jq -r '.tool_input.file_path // .tool_input.path // ""')

# Only process markdown files in specs directory
if [[ "$FILE_PATH" == *"/specs/"*.md ]]; then
  # Change to project root
  cd "$CLAUDE_PROJECT_DIR" || exit 0

  # Run sync check command
  packages/spec-sync/dist/cli check --file "$FILE_PATH" 2>/dev/null
fi

# Always exit successfully to not block Claude Code
exit 0
