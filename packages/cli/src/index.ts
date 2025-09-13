#!/usr/bin/env bun
/**
 * Specify CLI - Setup tool for Specify projects
 *
 * Usage:
 *   specify init <project-name>
 *   specify init --here
 *   specify check
 */

import process from 'node:process'
import { Command } from 'commander'
import pc from 'picocolors'
import { initCommand } from './commands/init.js'
import { checkCommand } from './commands/check.js'
import { Banner } from './ui/Banner.js'
import { consoleUtils } from './ui/Console.js'

const VERSION = '0.1.0'

// Track if banner has been shown to prevent duplicates
let bannerShown = false

// Create the CLI program
const program = new Command()
  .name('specify')
  .description('Spec-Driven Development Toolkit')
  .version(VERSION)
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Show banner for actual commands (not help)
    if (!bannerShown && actionCommand && actionCommand.name() !== 'help') {
      Banner.show()
      bannerShown = true
    }
  })

// Init command
program
  .command('init [project-name]')
  .description('Initialize a new Specify project from the latest template')
  .option('--ai <assistant>', 'AI assistant to use: claude, gemini, copilot, or cursor')
  .option('--script <type>', 'Script type to use: sh or ps')
  .option('--ignore-agent-tools', 'Skip checks for AI agent tools')
  .option('--no-git', 'Skip git repository initialization')
  .option('--here', 'Initialize project in the current directory')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)', false)
  .option('--debug', 'Show verbose diagnostic output', false)
  .action(async (projectName, options) => {
    try {
      await initCommand({
        projectName,
        aiAssistant: options.ai,
        scriptType: options.script,
        ignoreAgentTools: options.ignoreAgentTools || false,
        noGit: !options.git,
        here: options.here || false,
        skipTLS: options.skipTls || false,
        debug: options.debug || false,
      })
    } catch (error) {
      consoleUtils.error('Failed to initialize project', error instanceof Error ? error : new Error(String(error)))
      process.exit(1)
    }
  })
  .addHelpText('after', `
Examples:
  $ specify init my-project
  $ specify init my-project --ai claude
  $ specify init my-project --ai gemini
  $ specify init my-project --ai copilot --no-git
  $ specify init my-project --ai cursor
  $ specify init --ignore-agent-tools my-project
  $ specify init --here --ai claude
  $ specify init --here

This command will:
  1. Check that required tools are installed (git is optional)
  2. Let you choose your AI assistant (Claude Code, Gemini CLI, GitHub Copilot, or Cursor)
  3. Download the appropriate template from GitHub
  4. Extract the template to a new project directory or current directory
  5. Initialize a fresh git repository (if not --no-git and no existing repo)
  6. Optionally set up AI assistant commands`)

// Check command
program
  .command('check')
  .description('Check that all required tools are installed')
  .action(async () => {
    try {
      await checkCommand()
    } catch (error) {
      consoleUtils.error('Check command failed', error instanceof Error ? error : new Error(String(error)))
      process.exit(1)
    }
  })

// Remove the configureHelp override since we handle banner elsewhere

// Custom error handling
program.exitOverride()
program.showHelpAfterError('(add --help for additional information)')

// Handle unknown commands
program.on('command:*', () => {
  consoleUtils.error(`Invalid command: ${program.args.join(' ')}`)
  consoleUtils.error('Run "specify --help" for a list of available commands')
  process.exit(1)
})

// Parse and execute
async function main(): Promise<void> {
  try {
    // Show banner when no arguments provided
    if (process.argv.length === 2) {
      if (!bannerShown) {
        Banner.show()
        bannerShown = true
      }
      consoleUtils.center(pc.dim('Run "specify --help" for usage information'))
      consoleUtils.log()
      return
    }

    // Show banner for help/version commands
    const args = process.argv.slice(2)
    if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
      if (!bannerShown) {
        Banner.show()
        bannerShown = true
      }
    }

    await program.parseAsync(process.argv)
  } catch (error: any) {
    // Handle commander exit codes
    if (error.code === 'commander.help' || error.message === '(outputHelp)') {
      // Help was displayed successfully, exit cleanly
      process.exit(0)
    } else if (error.code === 'commander.version') {
      process.exit(0)
    } else if (error.code === 'commander.unknownCommand') {
      process.exit(1)
    } else {
      consoleUtils.error(`Error: ${error.message || error}`)
      process.exit(1)
    }
  }
}

// Run the CLI
if (import.meta.main) {
  main().catch((error) => {
    consoleUtils.error(`Fatal error: ${error}`)
    process.exit(1)
  })
}

// Export for testing
export { program }