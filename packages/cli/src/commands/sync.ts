/**
 * Sync command - Synchronize specs with issue tracking platforms
 * Now integrated with @spec-kit/plugin-sync
 */

import type { Command } from 'commander'
import { createSyncCommand } from '@spec-kit/plugin-sync'

export function registerSyncCommands(program: Command) {
  // Use the plugin's sync command factory
  const syncCommand = createSyncCommand({
    name: 'sync',
    description: 'Synchronize specs with issue tracking platforms',
  })

  // Add the sync command to the main program
  program.addCommand(syncCommand)
}
