import type { SpecDocument, SyncAdapter } from '../types/index.js'
import process from 'node:process'
import { cancel, isCancel, select } from '@clack/prompts'
import chalk from 'chalk'
import { SpecScanner } from '../core/scanner.js'
import { SpecDetails } from './SpecDetails.js'
import { SpecTable } from './SpecTable.js'

export interface BrowserOptions {
  showPreview?: boolean
  allowActions?: boolean
}

export class SpecBrowser {
  private specs: SpecDocument[] = []
  private adapter: SyncAdapter
  private options: BrowserOptions

  constructor(specs: SpecDocument[], adapter: SyncAdapter, options: BrowserOptions = {}) {
    this.specs = specs
    this.adapter = adapter
    this.options = {
      showPreview: true,
      allowActions: true,
      ...options,
    }
  }

  async browse(): Promise<void> {
    if (this.specs.length === 0) {
      console.log(chalk.yellow('No specs found in the current directory.'))
      return
    }

    // Show initial table
    console.log(chalk.cyan.bold('\n📋 Available Specs'))
    console.log(chalk.gray('─'.repeat(60)))

    const table = await SpecTable.create(this.specs, this.adapter)
    console.log(table.render())

    while (true) {
      const choices = this.specs.map((spec, index) => ({
        value: index.toString(),
        label: this.formatSpecChoice(spec),
      }))

      choices.push(
        { value: 'table', label: chalk.gray('📊 Show table view') },
        { value: 'exit', label: chalk.gray('❌ Exit browser') },
      )

      const selected = await select({
        message: 'Select a spec to view details:',
        options: choices,
      })

      if (isCancel(selected)) {
        cancel('Operation cancelled.')
        return
      }

      if (selected === 'exit') {
        console.log(chalk.green('👋 Goodbye!'))
        return
      }

      if (selected === 'table') {
        console.log('\n')
        console.log(table.render())
        continue
      }

      // Show spec details
      const specIndex = Number.parseInt(selected as string, 10)
      const spec = this.specs[specIndex]
      if (!spec) {
        console.log(chalk.red('Invalid selection'))
        continue
      }

      const status = await this.adapter.getStatus(spec)

      console.log(SpecDetails.render(spec, status))

      if (this.options.allowActions) {
        const action = await this.showActions(spec)
        if (action === 'back') {
          continue
        }
        if (action === 'exit') {
          return
        }
      }
    }
  }

  private formatSpecChoice(spec: SpecDocument): string {
    const specFile = spec.files.get('spec.md')
    const issueNumber = specFile?.frontmatter.github?.issue_number || spec.issueNumber
    const issueText = issueNumber ? chalk.gray(` (#${issueNumber})`) : ''

    return `${chalk.white(spec.name)}${issueText}`
  }

  private async showActions(spec: SpecDocument): Promise<string> {
    const actions = [
      { value: 'sync', label: '🔄 Sync with remote' },
      { value: 'edit', label: '✏️  Edit spec' },
      { value: 'github', label: '🌐 Open in GitHub' },
      { value: 'back', label: '⬅️  Back to list' },
      { value: 'exit', label: '❌ Exit browser' },
    ]

    const action = await select({
      message: 'What would you like to do?',
      options: actions,
    })

    if (isCancel(action)) {
      return 'back'
    }

    switch (action) {
      case 'sync':
        await this.syncSpec(spec)
        return 'back'
      case 'edit':
        await this.editSpec(spec)
        return 'back'
      case 'github':
        await this.openInGitHub(spec)
        return 'back'
      case 'back':
        return 'back'
      case 'exit':
        return 'exit'
      default:
        return 'back'
    }
  }

  private async syncSpec(spec: SpecDocument): Promise<void> {
    console.log(chalk.blue(`🔄 Syncing ${spec.name}...`))

    try {
      // Import SyncEngine dynamically to avoid circular dependencies
      const { SyncEngine } = await import('../core/sync-engine.js')

      // Create sync engine with the adapter
      const syncEngine = new SyncEngine(this.adapter)

      // Perform the sync
      const result = await syncEngine.syncSpec(spec, {
        verbose: false,
        force: false,
      })

      if (result.success) {
        console.log(chalk.green(`✓ ${result.message}`))

        // Show details if available
        if (result.details) {
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
        console.log(chalk.red(`✗ ${result.message}`))

        // Show errors if available
        if (result.details?.errors?.length) {
          result.details.errors.forEach((error) => {
            console.log(chalk.red(`  - ${error}`))
          })
        }
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(chalk.red(`✗ Failed to sync ${spec.name}: ${errorMessage}`))
    }
  }

  private async editSpec(spec: SpecDocument): Promise<void> {
    const specFile = spec.files.get('spec.md')
    if (specFile) {
      console.log(chalk.blue(`✏️  Opening ${specFile.path} in default editor...`))

      try {
        // Use the system's default editor through child_process
        const { exec } = await import('node:child_process')
        const { platform } = await import('node:os')
        const os = platform()

        // Determine the command based on the operating system
        let command: string
        if (os === 'darwin') {
          // macOS
          command = `open "${specFile.path}"`
        }
        else if (os === 'win32') {
          // Windows
          command = `start "" "${specFile.path}"`
        }
        else {
          // Linux/Unix - try common editors
          const editor = process.env.EDITOR || process.env.VISUAL || 'xdg-open'
          command = `${editor} "${specFile.path}"`
        }

        exec(command, (error) => {
          if (error) {
            console.log(chalk.red(`✗ Failed to open editor: ${error.message}`))
            console.log(chalk.gray(`  Try setting the EDITOR environment variable`))
          }
          else {
            console.log(chalk.green('✓ Editor opened successfully'))
          }
        })
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(chalk.red(`✗ Failed to open editor: ${errorMessage}`))
      }
    }
    else {
      console.log(chalk.yellow('⚠️  No spec.md file found for this spec'))
    }
  }

  private async openInGitHub(spec: SpecDocument): Promise<void> {
    const specFile = spec.files.get('spec.md')
    const issueNumber = specFile?.frontmatter.github?.issue_number

    if (issueNumber) {
      console.log(chalk.blue(`🌐 Opening GitHub issue #${issueNumber}...`))

      try {
        // Get GitHub config to build the URL
        const { SyncConfigLoader } = await import('../config/loader.js')
        const configLoader = SyncConfigLoader.getInstance()
        const config = await configLoader.loadConfig()

        if (config.github?.owner && config.github?.repo) {
          const url = `https://github.com/${config.github.owner}/${config.github.repo}/issues/${issueNumber}`

          // Open the URL in the default browser
          const { exec } = await import('node:child_process')
          const { platform } = await import('node:os')
          const os = platform()

          let command: string
          if (os === 'darwin') {
            // macOS
            command = `open "${url}"`
          }
          else if (os === 'win32') {
            // Windows
            command = `start "" "${url}"`
          }
          else {
            // Linux/Unix
            command = `xdg-open "${url}"`
          }

          exec(command, (error) => {
            if (error) {
              console.log(chalk.red(`✗ Failed to open browser: ${error.message}`))
              console.log(chalk.gray(`  URL: ${url}`))
            }
            else {
              console.log(chalk.green(`✓ Opened issue #${issueNumber} in browser`))
            }
          })
        }
        else {
          console.log(chalk.yellow('⚠️  GitHub repository not configured'))
          console.log(chalk.gray('  Run "specify sync config" to set up GitHub integration'))
        }
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(chalk.red(`✗ Failed to open GitHub issue: ${errorMessage}`))
      }
    }
    else {
      console.log(chalk.yellow('⚠️  No GitHub issue associated with this spec'))
      console.log(chalk.gray('  Run "specify sync" to push this spec to GitHub'))
    }
  }

  static async create(adapter: SyncAdapter, options?: BrowserOptions): Promise<SpecBrowser> {
    const scanner = new SpecScanner()
    const specs = await scanner.scanAll()

    return new SpecBrowser(specs, adapter, options)
  }
}
