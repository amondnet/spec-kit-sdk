/**
 * Step tracker for hierarchical progress visualization
 */

import pc from 'picocolors'
import process from 'node:process'

export interface Step {
  key: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  detail?: string
}

export class StepTracker {
  private title: string
  private steps: Step[] = []
  private refreshCallback?: () => void

  constructor(title: string) {
    this.title = title
  }

  attachRefresh(callback: () => void): void {
    this.refreshCallback = callback
  }

  add(key: string, label: string): void {
    if (!this.steps.find(s => s.key === key)) {
      this.steps.push({ key, label, status: 'pending' })
      this.maybeRefresh()
    }
  }

  start(key: string, detail?: string): void {
    this.update(key, 'running', detail)
  }

  complete(key: string, detail?: string): void {
    this.update(key, 'done', detail)
  }

  error(key: string, detail?: string): void {
    this.update(key, 'error', detail)
  }

  skip(key: string, detail?: string): void {
    this.update(key, 'skipped', detail)
  }

  private update(key: string, status: Step['status'], detail?: string): void {
    const step = this.steps.find(s => s.key === key)
    if (step) {
      step.status = status
      if (detail !== undefined) {
        step.detail = detail
      }
    } else {
      // If not present, add it
      this.steps.push({ key, label: key, status, detail })
    }
    this.maybeRefresh()
  }

  private maybeRefresh(): void {
    if (this.refreshCallback) {
      try {
        this.refreshCallback()
      } catch {
        // Ignore refresh errors
      }
    }
  }

  render(): string {
    const lines: string[] = []
    lines.push(pc.bold(pc.cyan(this.title)))

    const treeChars = {
      vertical: '│',
      branch: '├',
      last: '└',
      horizontal: '─',
    }

    this.steps.forEach((step, index) => {
      const isLast = index === this.steps.length - 1
      const prefix = isLast ? treeChars.last : treeChars.branch
      const symbol = this.getStatusSymbol(step.status)
      const line = this.formatStepLine(step, symbol)

      lines.push(pc.gray(`${prefix}${treeChars.horizontal} `) + line)
    })

    return lines.join('\n')
  }

  private getStatusSymbol(status: Step['status']): string {
    switch (status) {
      case 'done':
        return pc.green('●')
      case 'pending':
        return pc.dim(pc.green('○'))
      case 'running':
        return pc.cyan('○')
      case 'error':
        return pc.red('●')
      case 'skipped':
        return pc.yellow('○')
      default:
        return ' '
    }
  }

  private formatStepLine(step: Step, symbol: string): string {
    const detail = step.detail?.trim()

    if (step.status === 'pending') {
      // Entire line light gray (pending)
      const text = detail ? `${step.label} (${detail})` : step.label
      return `${symbol} ${pc.gray(text)}`
    } else {
      // Label white, detail (if any) light gray in parentheses
      const labelText = pc.white(step.label)
      const detailText = detail ? pc.gray(` (${detail})`) : ''
      return `${symbol} ${labelText}${detailText}`
    }
  }

  print(): void {
    console.log(this.render())
  }

  // For live updates
  getLiveRenderer(): (width?: number) => string {
    return (width?: number) => {
      const rendered = this.render()
      if (width && process.stdout.columns) {
        // Truncate lines if needed
        return rendered.split('\n').map(line => {
          if (line.length > width) {
            return line.substring(0, width - 3) + '...'
          }
          return line
        }).join('\n')
      }
      return rendered
    }
  }
}