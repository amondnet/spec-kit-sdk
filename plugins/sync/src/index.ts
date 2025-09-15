/**
 * @spec-kit/plugin-sync - Main library entry point
 *
 * This module provides the main exports for integrating the sync plugin
 * with other applications (like @spec-kit/cli) while maintaining
 * standalone CLI capability.
 */

import type { SyncAdapter } from './adapters/base.adapter.js'
import type { SyncOptions } from './types'
import path from 'node:path'
import process from 'node:process'
import chalk from 'chalk'
import { Command } from 'commander'
import { GitHubAdapter } from './adapters/github/github.adapter.js'
import { SyncConfigLoader } from './config/loader.js'
import { SpecScanner } from './core/scanner.js'
import { SyncEngine } from './core/sync-engine.js'
// Re-export core modules for advanced usage
export { GitHubAdapter } from './adapters/github/github.adapter.js'
export { SyncConfigLoader } from './config/loader.js'
export { SpecScanner } from './core/scanner.js'
export { SyncEngine } from './core/sync-engine.js'
export type { SyncAdapter, SyncOptions } from './types/index.js'

/**
 * Creates a pre-configured sync command that can be added to any Commander.js program
 *
 * @param options - Configuration options for the command
 * @param options.name - Custom name for the command (default: 'sync')
 * @param options.description - Custom description for the command
 * @returns Commander.js Command object ready to be added to a program
 */
export function createSyncCommand(options: { name?: string, description?: string } = {}): Command {
  const syncCmd = new Command(options.name || 'sync')
    .description(options.description || 'Synchronize specs with issue tracking platforms')
    .option('--platform <platform>', 'Platform to sync with (github, jira, asana)', 'github')
    .option('--config <path>', 'Path to configuration file')
    .option('--verbose', 'Enable verbose logging')
    .option('--dry-run', 'Preview changes without applying them')
    .addHelpText('after', `
Examples:
  $ specify sync status
  $ specify sync push --all
  $ specify sync pull 123
  $ specify sync --platform github push specs/001-feature
  $ specify sync --platform jira status
  $ specify sync config --show

Available platforms:
  github   - GitHub Issues & Projects
  jira     - Atlassian Jira (coming soon)
  asana    - Asana Tasks & Projects (coming soon)

Configuration:
  Create .specify/sync.config.json with platform credentials
  Run 'specify sync config --show' to see current configuration
`)

  // Push subcommand
  syncCmd
    .command('push [spec-path]')
    .description('Push specs to remote platform')
    .option('-a, --all', 'Sync all specs')
    .option('-f, --force', 'Force sync even if no changes detected')
    .option('--conflict-strategy <strategy>', 'Conflict resolution strategy (manual, theirs, ours, interactive)', 'manual')
    .action(async (specPath, options, command) => {
      const globalOptions = command.parent.opts()
      try {
        const syncOptions: SyncOptions = {
          force: options.force,
          dryRun: globalOptions.dryRun,
          verbose: globalOptions.verbose,
          platform: globalOptions.platform,
          conflictStrategy: options.conflictStrategy,
        }

        // Load configuration
        const configLoader = SyncConfigLoader.getInstance()
        const config = await configLoader.loadConfig(globalOptions.config)

        // Create appropriate adapter
        const adapter = await createAdapter(config.platform, config)
        await adapter.checkAuth()
        const syncEngine = new SyncEngine(adapter)

        if (options.all || !specPath) {
          console.log(chalk.blue(`Syncing all specs to ${config.platform}...`))
          const result = await syncEngine.syncAll(syncOptions)
          displayResult(result, options.verbose || globalOptions.verbose)
        }
        else {
          const scanner = new SpecScanner()
          const spec = await scanner.scanDirectory(specPath)

          if (!spec) {
            console.error(chalk.red(`✗ No spec found at ${specPath}`))
            process.exit(1)
          }

          console.log(chalk.blue(`Syncing ${spec.name} to ${config.platform}...`))
          const result = await syncEngine.syncSpec(spec, syncOptions)
          displayResult(result, options.verbose || globalOptions.verbose)
        }
      }
      catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`))
        if (globalOptions.verbose) {
          console.error(error.stack)
        }
        process.exit(1)
      }
    })

  // Pull subcommand
  syncCmd
    .command('pull [issue-id]')
    .description('Pull issues from remote platform to specs')
    .option('-a, --all', 'Pull all issues with spec label')
    .option('-f, --force', 'Force overwrite existing specs')
    .action(async (issueId, options, command) => {
      const globalOptions = command.parent.opts()
      try {
        // Load configuration
        const configLoader = SyncConfigLoader.getInstance()
        const config = await configLoader.loadConfig(globalOptions.config)

        // Create appropriate adapter
        const adapter = await createAdapter(config.platform, config)

        if (options.all || !issueId) {
          console.log(chalk.blue(`Pulling all issues from ${config.platform}...`))
          // This would need implementation for batch pull
          console.log(chalk.yellow('Batch pull not yet implemented'))
        }
        else {
          console.log(chalk.blue(`Pulling issue #${issueId} from ${config.platform}...`))

          const remoteRef = { id: issueId, type: 'parent' as const }
          const spec = await adapter.pull(remoteRef)

          console.log(chalk.green(`✓ Successfully pulled ${spec.name}`))
        }
      }
      catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`))
        if (globalOptions.verbose) {
          console.error(error.stack)
        }
        process.exit(1)
      }
    })

  // Status subcommand
  syncCmd
    .command('status')
    .description('Check sync status of all specs')
    .action(async (options, command) => {
      const globalOptions = command.parent.opts()

      try {
        // Load configuration
        const configLoader = SyncConfigLoader.getInstance()
        const config = await configLoader.loadConfig(globalOptions.config)

        // Create appropriate adapter
        const adapter = await createAdapter(config.platform, config)

        const scanner = new SpecScanner()
        const specs = await scanner.scanAll()

        console.log(chalk.blue(`Spec Sync Status (${config.platform}):`))
        console.log(chalk.gray('─'.repeat(60)))

        for (const spec of specs) {
          const status = await adapter.getStatus(spec)
          const specFile = spec.files.get('spec.md')
          const issueNumber = specFile?.frontmatter.github?.issue_number || spec.issueNumber

          const statusColor
            = status.status === 'synced'
              ? chalk.green
              : status.status === 'conflict'
                ? chalk.red
                : status.status === 'draft'
                  ? chalk.yellow
                  : chalk.gray

          const changeIndicator = status.hasChanges ? '●' : '○'

          console.log(
            `${changeIndicator} ${chalk.cyan(spec.name.padEnd(25))} `
            + `Issue: ${issueNumber ? chalk.white(`#${issueNumber}`) : chalk.gray('none')} `
            + `Status: ${statusColor(status.status)}`,
          )

          if (status.conflicts && status.conflicts.length > 0 && globalOptions.verbose) {
            status.conflicts.forEach((conflict) => {
              console.log(chalk.gray(`    ⚠ ${conflict}`))
            })
          }
        }
      }
      catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`))
        if (globalOptions.verbose) {
          console.error(error.stack)
        }
        process.exit(1)
      }
    })

  // Check subcommand (for hooks)
  syncCmd
    .command('check')
    .description('Check if a file needs syncing (for hooks)')
    .option('--file <path>', 'File path to check')
    .action(async (options, command) => {
      try {
        if (!options.file) {
          process.exit(0)
        }

        // Only process markdown files in specs directory
        if (!options.file.includes('/specs/') || !options.file.endsWith('.md')) {
          process.exit(0)
        }

        const globalOptions = command.parent.opts()
        const configLoader = SyncConfigLoader.getInstance()
        const config = await configLoader.loadConfig(globalOptions.config)
        const adapter = await createAdapter(config.platform, config)

        const scanner = new SpecScanner()
        const dirPath = path.dirname(options.file)
        const spec = await scanner.scanDirectory(dirPath)

        if (spec) {
          const status = await adapter.getStatus(spec)

          if (status.status === 'conflict') {
            console.log(chalk.yellow('⚠ File has sync conflicts. Resolve before editing.'))
          }
        }
      }
      catch {
        // Silently fail for hook operations
        process.exit(0)
      }
    })

  // Auto subcommand (for hooks)
  syncCmd
    .command('auto')
    .description('Auto-sync after file changes (for hooks)')
    .option('--file <path>', 'File path that changed')
    .action(async (options, command) => {
      try {
        if (!options.file) {
          process.exit(0)
        }

        // Only process markdown files in specs directory
        if (!options.file.includes('/specs/') || !options.file.endsWith('.md')) {
          process.exit(0)
        }

        const globalOptions = command.parent.opts()
        const configLoader = SyncConfigLoader.getInstance()
        const config = await configLoader.loadConfig(globalOptions.config)

        if (!config.autoSync) {
          process.exit(0)
        }

        const adapter = await createAdapter(config.platform, config)
        const syncEngine = new SyncEngine(adapter)

        const scanner = new SpecScanner()
        const dirPath = path.dirname(options.file)
        const spec = await scanner.scanDirectory(dirPath)

        if (spec) {
          const filename = path.basename(options.file)
          const file = spec.files.get(filename)

          if (file?.frontmatter.auto_sync !== false) {
            await syncEngine.syncSpec(spec, { force: false })
          }
        }
      }
      catch {
        // Silently fail for hook operations
        process.exit(0)
      }
    })

  // Config subcommand
  syncCmd
    .command('config')
    .description('Manage sync configuration')
    .option('--show', 'Show current configuration')
    .option('--platform <platform>', 'Set default platform')
    .action(async (options, command) => {
      try {
        const globalOptions = command.parent.opts()
        const configLoader = SyncConfigLoader.getInstance()

        if (options.show) {
          const config = await configLoader.loadConfig(globalOptions.config)
          console.log(chalk.blue('Current Configuration:'))
          console.log(JSON.stringify(config, null, 2))
        }
        else if (options.platform) {
          console.log(chalk.yellow('Configuration management not yet implemented'))
        }
        else {
          console.log(chalk.yellow('Use --show to view current config'))
        }
      }
      catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`))
        process.exit(1)
      }
    })

  return syncCmd
}

// Helper functions
async function createAdapter(platform: string, config: any): Promise<SyncAdapter> {
  switch (platform) {
    case 'github':
      if (!config.github) {
        throw new Error('GitHub configuration not found')
      }
      return new GitHubAdapter(config.github)

    case 'jira':
      throw new Error('Jira adapter not yet implemented')

    case 'asana':
      throw new Error('Asana adapter not yet implemented')

    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

function displayResult(result: any, verbose: boolean = false): void {
  if (result.success) {
    console.log(chalk.green(`✓ ${result.message}`))
    if (result.details && verbose) {
      if (result.details.created?.length) {
        console.log(chalk.gray(`  Created: ${result.details.created.join(', ')}`))
      }
      if (result.details.updated?.length) {
        console.log(chalk.gray(`  Updated: ${result.details.updated.join(', ')}`))
      }
      if (result.details.skipped?.length) {
        console.log(chalk.gray(`  Skipped: ${result.details.skipped.join(', ')}`))
      }
    }
  }
  else {
    console.error(chalk.red(`✗ ${result.message}`))
    if (result.details?.errors && verbose) {
      result.details.errors.forEach((err: string) => {
        console.error(chalk.red(`  - ${err}`))
      })
    }
    process.exit(1)
  }
}
