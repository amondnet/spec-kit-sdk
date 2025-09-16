#!/usr/bin/env node

import process from 'node:process'
import chalk from 'chalk'
import { Command } from 'commander'
import packageJson from '../package.json' with { type: 'json' }
import { createSyncCommand } from './index.js'

const program = new Command()
const VERSION = packageJson.version
program
  .name('specify-sync')
  .description('Synchronize markdown specs with issue tracking platforms')
  .version(VERSION)

// Global options
program
  .option('--platform <platform>', 'Platform to sync with (github, jira, asana)', 'github')
  .option('--config <path>', 'Path to configuration file')
  .option('--verbose', 'Enable verbose logging')
  .option('--dry-run', 'Preview changes without applying them')

// Add the sync command directly as subcommands to support standalone usage
const syncCommand = createSyncCommand()

// Extract and add each subcommand to make them top-level commands for standalone CLI
for (const subCommand of syncCommand.commands) {
  program.addCommand(subCommand)
}

// Run CLI
(async () => {
  try {
    program.parse(process.argv)
  }
  catch (error: any) {
    console.error(chalk.red(`CLI Error: ${error.message}`))
    process.exit(1)
  }
})()
