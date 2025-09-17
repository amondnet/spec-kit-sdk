import type { SyncAdapter } from '../types/index.js'
import path from 'node:path'
import process from 'node:process'
import { intro, outro, spinner } from '@clack/prompts'
import chalk from 'chalk'
import { SpecScanner } from '../core/scanner.js'
import { SpecDetails } from '../ui/SpecDetails.js'

export interface ViewCommandOptions {
  verbose?: boolean
}

export async function viewCommand(
  specPath: string,
  adapter: SyncAdapter,
  options: ViewCommandOptions = {},
): Promise<void> {
  intro(chalk.cyan('👀 Spec Viewer'))

  const s = spinner()
  s.start('Loading spec...')

  try {
    const scanner = new SpecScanner()
    let spec

    // Determine if specPath is a directory or a file path
    const resolvedPath = path.resolve(specPath)

    // Try to scan as directory first
    spec = await scanner.scanDirectory(resolvedPath)

    // If not found as directory, try to find by name
    if (!spec) {
      s.message('Searching for spec by name...')
      const allSpecs = await scanner.scanAll()
      spec = allSpecs.find(s =>
        s.name === specPath
        || s.name === path.basename(specPath)
        || s.path.endsWith(specPath),
      )
    }

    if (!spec) {
      s.stop('Spec not found')
      console.log(chalk.red(`\n❌ Could not find spec: ${specPath}`))
      console.log(chalk.gray('   Try one of these options:'))
      console.log(chalk.gray('   • Use the full path to the spec directory'))
      console.log(chalk.gray('   • Use the spec name (e.g., "001-feature-name")'))
      console.log(chalk.gray('   • Run "specify sync list" to see available specs'))
      outro(chalk.red('✗ Not found'))
      process.exit(1)
    }

    s.message('Getting sync status...')

    // Get sync status
    const status = await adapter.getStatus(spec)
    s.stop('Spec loaded')

    // Render spec details
    console.log(SpecDetails.render(spec, status))

    // Additional verbose info
    if (options.verbose) {
      console.log(chalk.gray.bold('🔍 Verbose Information'))
      console.log(chalk.gray('─'.repeat(60)))
      console.log(chalk.gray(`  Resolved path: ${spec.path}`))
      console.log(chalk.gray(`  Files found: ${spec.files.size}`))
      console.log(chalk.gray(`  Status check: ${status.status}`))

      if (status.lastChecked) {
        console.log(chalk.gray(`  Last checked: ${new Date(status.lastChecked).toLocaleString()}`))
      }

      console.log('')
    }

    outro(chalk.green('✓ Spec details displayed'))
  }
  catch (error: any) {
    s.stop('Failed to load spec')
    console.error(chalk.red(`\n❌ Error: ${error.message}`))
    if (options.verbose && error.stack) {
      console.error(chalk.gray(error.stack))
    }
    outro(chalk.red('✗ Failed'))
    process.exit(1)
  }
}
