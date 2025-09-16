import type { SpecDocument, SyncStatus } from '../types/index.js'
import chalk from 'chalk'
import CliTable3 from 'cli-table3'

export class SpecDetails {
  static render(spec: SpecDocument, status: SyncStatus): string {
    const lines: string[] = []

    // Header
    lines.push('')
    lines.push(chalk.cyan.bold(`📋 ${spec.name}`))
    lines.push(chalk.gray('─'.repeat(60)))

    // Basic Info
    const specFile = spec.files.get('spec.md')
    const issueNumber = specFile?.frontmatter.github?.issue_number || spec.issueNumber

    const infoTable = new CliTable3({
      colWidths: [20, 40],
      style: { border: ['gray'] },
    })

    infoTable.push(
      ['Path', chalk.white(spec.path)],
      ['Issue Number', issueNumber ? chalk.white(`#${issueNumber}`) : chalk.gray('None')],
      ['Status', this.formatStatus(status.status)],
      ['Has Changes', status.hasChanges ? chalk.red('Yes') : chalk.green('No')],
    )

    lines.push(infoTable.toString())

    // Frontmatter details
    if (specFile?.frontmatter && Object.keys(specFile.frontmatter).length > 0) {
      lines.push('')
      lines.push(chalk.yellow.bold('📝 Frontmatter'))
      lines.push(chalk.gray('─'.repeat(60)))

      const frontmatterTable = new CliTable3({
        colWidths: [20, 40],
        style: { border: ['gray'] },
      })

      // GitHub sync info
      if (specFile.frontmatter.github) {
        const github = specFile.frontmatter.github
        frontmatterTable.push(['GitHub Issue', github.issue_number ? `#${github.issue_number}` : 'None'])
      }

      // Sync info
      if (specFile.frontmatter.sync_status) {
        frontmatterTable.push(['Sync Status', specFile.frontmatter.sync_status])
      }
      if (specFile.frontmatter.last_sync) {
        const lastSync = new Date(specFile.frontmatter.last_sync).toLocaleString()
        frontmatterTable.push(['Last Sync', lastSync])
      }
      if (specFile.frontmatter.sync_hash) {
        frontmatterTable.push(['Sync Hash', specFile.frontmatter.sync_hash])
      }

      lines.push(frontmatterTable.toString())
    }

    // Files in spec
    lines.push('')
    lines.push(chalk.yellow.bold('📁 Files'))
    lines.push(chalk.gray('─'.repeat(60)))

    const filesTable = new CliTable3({
      head: ['Filename', 'Type'],
      colWidths: [30, 20],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
    })

    for (const [filename, file] of spec.files) {
      const fileType = filename.endsWith('.md') ? 'Markdown' : 'Other'
      filesTable.push([
        chalk.white(filename),
        chalk.gray(fileType),
      ])
    }

    lines.push(filesTable.toString())

    // Conflicts if any
    if (status.conflicts && status.conflicts.length > 0) {
      lines.push('')
      lines.push(chalk.red.bold('⚠️  Conflicts'))
      lines.push(chalk.gray('─'.repeat(60)))

      for (const conflict of status.conflicts) {
        lines.push(chalk.red(`  • ${conflict}`))
      }
    }

    // Content preview (first few lines)
    if (specFile) {
      lines.push('')
      lines.push(chalk.yellow.bold('📄 Content Preview'))
      lines.push(chalk.gray('─'.repeat(60)))

      const contentLines = specFile.markdown.split('\n').slice(0, 10)
      for (const line of contentLines) {
        lines.push(chalk.white(`  ${line}`))
      }

      if (specFile.markdown.split('\n').length > 10) {
        lines.push(chalk.gray('  ... (truncated)'))
      }
    }

    lines.push('')
    return lines.join('\n')
  }

  private static formatStatus(status: string): string {
    switch (status) {
      case 'synced':
        return chalk.green('✓ Synced')
      case 'draft':
        return chalk.yellow('⚠ Draft')
      case 'conflict':
        return chalk.red('✗ Conflict')
      case 'local':
        return chalk.gray('○ Local Only')
      default:
        return chalk.gray('○ Unknown')
    }
  }
}
