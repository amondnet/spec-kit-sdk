import type { SpecDocument, SyncAdapter, SyncStatus } from '../types/index.js'
import chalk from 'chalk'
import CliTable3 from 'cli-table3'

export interface SpecTableRow {
  spec: SpecDocument
  status: SyncStatus
  issueNumber?: number
}

export class SpecTable {
  private table: any

  constructor() {
    this.table = new CliTable3({
      head: ['Spec Name', 'Issue', 'Status', 'Last Sync', 'Changes'],
      colWidths: [25, 10, 12, 16, 9],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
    })
  }

  addRow(row: SpecTableRow): void {
    const { spec, status } = row
    const specFile = spec.files.get('spec.md')
    const issueNumber = specFile?.frontmatter.github?.issue_number || spec.issueNumber || row.issueNumber

    // Status formatting
    const statusText = this.formatStatus(status.status)

    // Last sync formatting
    const lastSync = specFile?.frontmatter.last_sync
      ? new Date(specFile.frontmatter.last_sync).toLocaleDateString()
      : '-'

    // Changes indicator
    const changeIndicator = status.hasChanges ? chalk.red('●') : chalk.gray('○')

    // Issue number formatting
    const issueText = issueNumber ? chalk.white(`#${issueNumber}`) : chalk.gray('-')

    this.table.push([
      chalk.white(spec.name),
      issueText,
      statusText,
      chalk.gray(lastSync),
      changeIndicator,
    ])
  }

  private formatStatus(status: string): string {
    switch (status) {
      case 'synced':
        return chalk.green('✓ synced')
      case 'draft':
        return chalk.yellow('⚠ draft')
      case 'conflict':
        return chalk.red('✗ conflict')
      case 'local':
        return chalk.gray('○ local')
      default:
        return chalk.gray('○ unknown')
    }
  }

  render(): string {
    return this.table.toString()
  }

  clear(): void {
    this.table.splice(0, this.table.length)
  }

  static async create(specs: SpecDocument[], adapter: SyncAdapter): Promise<SpecTable> {
    const table = new SpecTable()

    for (const spec of specs) {
      const status = await adapter.getStatus(spec)
      table.addRow({ spec, status })
    }

    return table
  }
}
