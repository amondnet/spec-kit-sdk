/**
 * Type definitions for the Specify CLI
 */

export interface AIAssistant {
  key: string
  name: string
  command?: string
  installUrl?: string
}

export const AI_ASSISTANTS: Record<string, AIAssistant> = {
  copilot: {
    key: 'copilot',
    name: 'GitHub Copilot',
    command: 'code',
    installUrl: 'https://code.visualstudio.com/',
  },
  claude: {
    key: 'claude',
    name: 'Claude Code',
    command: 'claude',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code/setup',
  },
  gemini: {
    key: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  cursor: {
    key: 'cursor',
    name: 'Cursor',
    command: 'cursor-agent',
    installUrl: 'https://cursor.sh/',
  },
}

export const SCRIPT_TYPES = {
  sh: 'POSIX Shell (bash/zsh)',
  ps: 'PowerShell',
}

export interface InitOptions {
  projectName?: string
  aiAssistant?: string
  scriptType?: string
  ignoreAgentTools?: boolean
  noGit?: boolean
  here?: boolean
  skipTLS?: boolean
  debug?: boolean
}

export interface CheckResult {
  tool: string
  available: boolean
  installHint?: string
  version?: string
}

export interface TemplateMetadata {
  filename: string
  size: number
  release: string
  assetUrl: string
}