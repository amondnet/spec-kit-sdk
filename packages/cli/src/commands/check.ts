/**
 * Check command - Check that all required tools are installed
 */

import pc from 'picocolors'
import { CheckResult } from '../types/index.js'
import { consoleUtils } from '../ui/Console.js'
import { Banner } from '../ui/Banner.js'
import { StepTracker } from '../ui/StepTracker.js'
import { PlatformUtils } from '../utils/Platform.js'

const TOOLS_TO_CHECK = [
  {
    name: 'git',
    command: 'git',
    description: 'Git version control',
    installUrl: 'https://git-scm.com/downloads',
  },
  {
    name: 'claude',
    command: 'claude',
    description: 'Claude Code CLI',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code/setup',
    customCheck: () => PlatformUtils.isClaudeAvailable(),
  },
  {
    name: 'gemini',
    command: 'gemini',
    description: 'Gemini CLI',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    name: 'code',
    command: 'code',
    description: 'VS Code (for GitHub Copilot)',
    installUrl: 'https://code.visualstudio.com/',
    alternatives: ['code-insiders'],
  },
  {
    name: 'cursor-agent',
    command: 'cursor-agent',
    description: 'Cursor IDE agent (optional)',
    installUrl: 'https://cursor.sh/',
  },
  {
    name: 'bun',
    command: 'bun',
    description: 'Bun runtime',
    installUrl: 'https://bun.sh',
  },
  {
    name: 'node',
    command: 'node',
    description: 'Node.js runtime',
    installUrl: 'https://nodejs.org/',
  },
]

export async function checkCommand(): Promise<void> {
  // Banner is shown by the main CLI handler
  consoleUtils.log(pc.bold('Checking for installed tools...\n'))

  const tracker = new StepTracker('Check Available Tools')

  // Add all tools to tracker
  TOOLS_TO_CHECK.forEach(tool => {
    tracker.add(tool.name, tool.description)
  })

  const results: CheckResult[] = []

  // Check each tool
  for (const tool of TOOLS_TO_CHECK) {
    let available = false

    if (tool.customCheck) {
      available = tool.customCheck()
    } else {
      available = PlatformUtils.commandExists(tool.command)

      // Check alternatives if main command not found
      if (!available && tool.alternatives) {
        for (const alt of tool.alternatives) {
          if (PlatformUtils.commandExists(alt)) {
            available = true
            break
          }
        }
      }
    }

    results.push({
      tool: tool.name,
      available,
      installHint: tool.installUrl,
    })

    if (available) {
      tracker.complete(tool.name, 'available')
    } else {
      tracker.error(tool.name, `not found - ${tool.installUrl}`)
    }
  }

  // Render the final tree
  consoleUtils.log(tracker.render())
  consoleUtils.log('')

  // Analysis and recommendations
  const gitOk = results.find(r => r.tool === 'git')?.available || false
  const claudeOk = results.find(r => r.tool === 'claude')?.available || false
  const geminiOk = results.find(r => r.tool === 'gemini')?.available || false
  const codeOk = results.find(r => r.tool === 'code')?.available || false
  const bunOk = results.find(r => r.tool === 'bun')?.available || false
  const nodeOk = results.find(r => r.tool === 'node')?.available || false

  // Success message
  consoleUtils.success(pc.bold('Specify CLI is ready to use!'))

  // Recommendations
  const recommendations: string[] = []

  if (!gitOk) {
    recommendations.push('Install git for repository management')
  }

  if (!claudeOk && !geminiOk) {
    recommendations.push('Install an AI assistant for the best experience')
  }

  if (!bunOk && !nodeOk) {
    recommendations.push('Install Bun or Node.js to run the CLI')
  }

  if (!codeOk && !claudeOk) {
    recommendations.push('Install VS Code for GitHub Copilot support')
  }

  if (recommendations.length > 0) {
    consoleUtils.log('')
    consoleUtils.log(pc.yellow('Recommendations:'))
    recommendations.forEach(rec => {
      consoleUtils.log(pc.dim(`  • ${rec}`))
    })
  }

  // Environment info in debug mode
  if (process.env.DEBUG) {
    consoleUtils.log('')
    const systemInfo = PlatformUtils.getSystemInfo()
    const infoLines = Object.entries(systemInfo).map(([key, value]) =>
      `${key.padEnd(15)} → ${pc.gray(value)}`
    )
    consoleUtils.panel(infoLines.join('\n'), 'System Information', 'cyan')
  }
}