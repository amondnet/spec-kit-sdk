import type { SyncAdapter } from '../types/index.js'
import { intro, outro, spinner } from '@clack/prompts'
import chalk from 'chalk'
import { SpecBrowser } from '../ui/SpecBrowser.js'

export interface BrowseCommandOptions {
  verbose?: boolean
  noActions?: boolean
}

export async function browseCommand(
  adapter: SyncAdapter,
  options: BrowseCommandOptions = {},
): Promise<void> {
  intro(chalk.cyan('🔍 Spec Browser'))

  const s = spinner()
  s.start('Loading specs...')

  try {
    // Create browser
    const browser = await SpecBrowser.create(adapter, {
      allowActions: !options.noActions,
      showPreview: true,
    })

    s.stop('Specs loaded')

    console.log(chalk.gray('Use arrow keys to navigate, Enter to select, Ctrl+C to exit'))
    console.log('')

    // Start browsing
    await browser.browse()

    outro(chalk.green('✓ Browse session complete'))
  }
  catch (error: any) {
    s.stop('Failed to load browser')
    console.error(chalk.red(`\n❌ Error: ${error.message}`))
    if (options.verbose && error.stack) {
      console.error(chalk.gray(error.stack))
    }
    outro(chalk.red('✗ Failed'))
    process.exit(1)
  }
}
