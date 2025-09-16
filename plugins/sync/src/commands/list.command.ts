import type { SyncAdapter } from '../types/index.js'
import { intro, outro, spinner } from '@clack/prompts'
import chalk from 'chalk'
import { SpecScanner } from '../core/scanner.js'
import { SpecTable } from '../ui/SpecTable.js'

export interface ListCommandOptions {
  verbose?: boolean
  filter?: string
}

export async function listCommand(adapter: SyncAdapter, options: ListCommandOptions = {}): Promise<void> {
  intro(chalk.cyan('📋 Spec List'))

  const s = spinner()
  s.start('Scanning specs...')

  try {
    // Scan all specs
    const scanner = new SpecScanner()
    const specs = await scanner.scanAll()

    if (specs.length === 0) {
      s.stop('No specs found')
      console.log(chalk.yellow('\n📁 No specs found in the current directory.'))
      console.log(chalk.gray('   Run "specify create-feature <name>" to create your first spec.'))
      outro('Done')
      return
    }

    s.message('Building table...')

    // Filter specs if requested
    let filteredSpecs = specs
    if (options.filter) {
      filteredSpecs = specs.filter(spec =>
        spec.name.toLowerCase().includes(options.filter!.toLowerCase()),
      )

      if (filteredSpecs.length === 0) {
        s.stop('No matching specs found')
        console.log(chalk.yellow(`\n🔍 No specs matching "${options.filter}" found.`))
        outro('Done')
        return
      }
    }

    // Create and populate table
    const table = await SpecTable.create(filteredSpecs, adapter)
    s.stop('Table ready')

    // Display header info
    console.log('')
    if (options.filter) {
      console.log(chalk.blue(`Found ${filteredSpecs.length} specs matching "${options.filter}" (of ${specs.length} total)`))
    }
    else {
      console.log(chalk.blue(`Found ${specs.length} specs`))
    }
    console.log('')

    // Display table
    console.log(table.render())

    // Show legend if verbose
    if (options.verbose) {
      console.log('')
      console.log(chalk.gray.bold('Legend:'))
      console.log(chalk.gray('  ● = Has local changes'))
      console.log(chalk.gray('  ○ = No local changes'))
      console.log(chalk.green('  ✓ synced = In sync with remote'))
      console.log(chalk.yellow('  ⚠ draft = Not yet synced'))
      console.log(chalk.red('  ✗ conflict = Conflicts with remote'))
      console.log(chalk.gray('  ○ local = Local only, no remote'))
    }

    outro(chalk.green('✓ Spec list complete'))
  }
  catch (error: any) {
    s.stop('Failed to scan specs')
    console.error(chalk.red(`\n❌ Error: ${error.message}`))
    if (options.verbose && error.stack) {
      console.error(chalk.gray(error.stack))
    }
    outro(chalk.red('✗ Failed'))
    process.exit(1)
  }
}
