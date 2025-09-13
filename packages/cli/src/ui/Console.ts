/**
 * Console utilities for consistent output formatting
 */

import pc from 'picocolors'
import process from 'node:process'
import stripAnsi from 'strip-ansi'

export class ConsoleUtils {
  private static instance: ConsoleUtils
  private isDebug: boolean

  constructor() {
    this.isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1'
  }

  static getInstance(): ConsoleUtils {
    if (!ConsoleUtils.instance) {
      ConsoleUtils.instance = new ConsoleUtils()
    }
    return ConsoleUtils.instance
  }

  log(...args: any[]): void {
    console.log(...args)
  }

  error(message: string, error?: Error): void {
    console.error(pc.red(message))
    if (error && this.isDebug) {
      console.error(pc.dim(error.stack || error.message))
    }
  }

  warn(message: string): void {
    console.warn(pc.yellow(message))
  }

  success(message: string): void {
    console.log(pc.green(message))
  }

  info(message: string): void {
    console.log(pc.cyan(message))
  }

  debug(message: string): void {
    if (this.isDebug) {
      console.log(pc.dim(`[DEBUG] ${message}`))
    }
  }

  panel(content: string, title?: string, borderColor: 'cyan' | 'green' | 'red' | 'yellow' = 'cyan'): void {
    const width = 60
    const colorFn = pc[borderColor]

    if (title) {
      console.log(colorFn(`┌─ ${pc.bold(title)} ${'─'.repeat(Math.max(0, width - title.length - 4))}┐`))
    } else {
      console.log(colorFn(`┌${'─'.repeat(width)}┐`))
    }

    const lines = content.split('\n')
    lines.forEach(line => {
      const padding = Math.max(0, width - 2 - line.length)
      console.log(colorFn('│') + ` ${line}${' '.repeat(padding)} ` + colorFn('│'))
    })

    console.log(colorFn(`└${'─'.repeat(width)}┘`))
  }

  center(text: string): void {
    const terminalWidth = process.stdout.columns || 80
    const lines = text.split('\n')
    lines.forEach(line => {
      // Use stripAnsi to get the actual visible length without color codes
      const visibleLength = stripAnsi(line).length
      const padding = Math.max(0, Math.floor((terminalWidth - visibleLength) / 2))
      console.log(' '.repeat(padding) + line)
    })
  }

  clear(): void {
    console.clear()
  }
}

export const consoleUtils = ConsoleUtils.getInstance()