/**
 * Interactive arrow-key selection interface
 */

import process from 'node:process'
import { select } from '@inquirer/prompts'
import pc from 'picocolors'

export interface SelectOption {
  value: string
  label: string
  description?: string
}

export class InteractiveSelect {
  /**
   * Show an interactive selection menu with arrow keys
   */
  static async select(
    options: Record<string, string>,
    prompt: string = 'Select an option',
    defaultKey?: string,
  ): Promise<string> {
    // Convert options to inquirer format
    const choices = Object.entries(options).map(([key, description]) => ({
      value: key,
      name: `${key}: ${description}`,
    }))

    try {
      const result = await select({
        message: prompt,
        choices,
        default: defaultKey,
      })

      return result
    }
    catch {
      // Handle Ctrl+C or escape
      console.log(pc.yellow('\nSelection cancelled'))
      process.exit(1)
    }
  }

  /**
   * Confirm an action with y/n prompt
   */
  static async confirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    const { confirm } = await import('@inquirer/prompts')

    try {
      return await confirm({
        message,
        default: defaultValue,
      })
    }
    catch {
      // Handle Ctrl+C
      console.log(pc.yellow('\nOperation cancelled'))
      process.exit(1)
    }
  }

  /**
   * Simple text input
   */
  static async input(message: string, defaultValue?: string): Promise<string> {
    const { input } = await import('@inquirer/prompts')

    try {
      return await input({
        message,
        default: defaultValue,
      })
    }
    catch {
      // Handle Ctrl+C
      console.log(pc.yellow('\nInput cancelled'))
      process.exit(1)
    }
  }
}
