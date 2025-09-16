import type { SpecDocument, SyncAdapter } from '../types/index.js'
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
    // This would call the actual sync functionality
    // For now, just show a message
    console.log(chalk.green('✓ Sync functionality would be called here'))
  }

  private async editSpec(spec: SpecDocument): Promise<void> {
    const specFile = spec.files.get('spec.md')
    if (specFile) {
      console.log(chalk.blue(`✏️  Opening ${specFile.path} in default editor...`))
      // This would open the file in the user's default editor
      console.log(chalk.green('✓ Edit functionality would be implemented here'))
    }
  }

  private async openInGitHub(spec: SpecDocument): Promise<void> {
    const specFile = spec.files.get('spec.md')
    const issueNumber = specFile?.frontmatter.github?.issue_number

    if (issueNumber) {
      console.log(chalk.blue(`🌐 Opening GitHub issue #${issueNumber}...`))
      // This would open the GitHub issue in the browser
      console.log(chalk.green('✓ GitHub integration would be implemented here'))
    }
    else {
      console.log(chalk.yellow('⚠️  No GitHub issue associated with this spec'))
    }
  }

  static async create(adapter: SyncAdapter, options?: BrowserOptions): Promise<SpecBrowser> {
    const scanner = new SpecScanner()
    const specs = await scanner.scanAll()

    return new SpecBrowser(specs, adapter, options)
  }
}
