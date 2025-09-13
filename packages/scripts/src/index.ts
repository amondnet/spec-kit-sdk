#!/usr/bin/env bun
/**
 * Spec-Kit Scripts TypeScript Library
 * Main CLI entry point and library exports
 */

import pc from 'picocolors';
import { parseArgs } from 'node:util';

// Import all commands
import {
  createNewFeature,
  setupPlan,
  updateAgentContext,
  checkTaskPrerequisites,
  getFeaturePaths,
  createNewFeatureCLI,
  setupPlanCLI,
  updateAgentContextCLI,
  checkTaskPrerequisitesCLI,
  getFeaturePathsCLI
} from './commands/index.js';

// Export library API
export {
  createNewFeature,
  setupPlan,
  updateAgentContext,
  checkTaskPrerequisites,
  getFeaturePaths
};

// Export types
export type {
  CreateFeatureResult,
  SetupPlanResult,
  UpdateAgentContextResult,
  CheckTaskPrerequisitesResult,
  FeaturePathsResult,
  CommonOptions,
  CreateFeatureOptions,
  UpdateAgentContextOptions,
  SpecKitLibrary
} from './contracts/spec-kit-library.js';

// Export errors
export {
  SpecKitError,
  GitRepositoryError,
  FeatureBranchError,
  TemplateError,
  FileOperationError
} from './contracts/spec-kit-library.js';

// CLI implementation
const COMMANDS = {
  'create-feature': createNewFeatureCLI,
  'setup-plan': setupPlanCLI,
  'update-agent-context': updateAgentContextCLI,
  'check-prerequisites': checkTaskPrerequisitesCLI,
  'get-paths': getFeaturePathsCLI,
  // Aliases for backward compatibility
  'create': createNewFeatureCLI,
  'plan': setupPlanCLI,
  'update': updateAgentContextCLI,
  'check': checkTaskPrerequisitesCLI,
  'paths': getFeaturePathsCLI
} as const;

type CommandName = keyof typeof COMMANDS;

function showHelp(): void {
  console.log(pc.bold('Spec-Kit Scripts Library v0.1.0'));
  console.log();
  console.log(pc.yellow('Usage:'));
  console.log('  spec-kit <command> [options]');
  console.log('  bun run scripts <command> [options]');
  console.log();
  console.log(pc.yellow('Commands:'));
  console.log('  create-feature <description>  Create a new feature specification');
  console.log('  setup-plan                   Set up implementation planning');
  console.log('  update-agent-context <type>  Update AI agent configuration');
  console.log('  check-prerequisites          Check task prerequisites');
  console.log('  get-paths                    Get feature directory paths');
  console.log();
  console.log(pc.yellow('Options:'));
  console.log('  --json        Output in JSON format');
  console.log('  --help, -h    Show help for a command');
  console.log();
  console.log(pc.yellow('Examples:'));
  console.log('  spec-kit create-feature "implement user authentication"');
  console.log('  spec-kit setup-plan --json');
  console.log('  spec-kit update-agent-context claude');
  console.log('  spec-kit check-prerequisites');
  console.log('  spec-kit get-paths --json');
  console.log();
  console.log(pc.dim('For command-specific help, use: spec-kit <command> --help'));
}

function showVersion(): void {
  console.log('spec-kit v0.1.0');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle no arguments
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  // Handle global flags
  if (args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === '--version' || args[0] === '-v') {
    showVersion();
    process.exit(0);
  }

  // Parse command
  const command = args[0] as CommandName;
  const commandArgs = args.slice(1);

  // Check if command exists
  if (!(command in COMMANDS)) {
    console.error(pc.red(`Error: Unknown command '${command}'`));
    console.error();
    console.error('Available commands:');
    Object.keys(COMMANDS).forEach(cmd => {
      if (!['create', 'plan', 'update', 'check', 'paths'].includes(cmd)) {
        console.error(`  ${cmd}`);
      }
    });
    process.exit(1);
  }

  // Execute command
  try {
    await COMMANDS[command](commandArgs);
  } catch (error) {
    // Error handling is done in individual commands
    // This is just a fallback for unexpected errors
    if (error instanceof Error && !error.message.includes('Error:')) {
      console.error(pc.red('Unexpected error:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch(error => {
    console.error(pc.red('Fatal error:'), error);
    process.exit(1);
  });
}

// Default export for library usage
export default {
  name: '@spec-kit/scripts',
  version: '0.1.0',
  commands: {
    createNewFeature,
    setupPlan,
    updateAgentContext,
    checkTaskPrerequisites,
    getFeaturePaths
  }
};