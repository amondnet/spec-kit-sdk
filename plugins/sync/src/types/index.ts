// Import Zod-inferred type instead of manual interface
export type { SpecFileFrontmatter } from '../schemas/spec.js'

export interface SpecFile {
  path: string
  filename: string
  content: string
  frontmatter: SpecFileFrontmatter
  markdown: string
}

export interface SpecDocument {
  path: string
  name: string
  files: Map<string, SpecFile>
  issueNumber?: number
}

export interface GitHubIssue {
  number: number
  title: string
  body: string
  state: 'OPEN' | 'CLOSED'
  labels?: string[]
  assignees?: string[]
  milestone?: number
  parent_issue?: number
  subtasks?: number[]
}

export interface SyncResult {
  success: boolean
  message: string
  details?: {
    created?: string[]
    updated?: string[]
    skipped?: string[]
    errors?: string[]
  }
}

export interface SyncOptions {
  dryRun?: boolean
  force?: boolean
  verbose?: boolean
  platform?: string
  conflictStrategy?: 'manual' | 'theirs' | 'ours' | 'interactive'
}

export type SpecFileType = 'spec' | 'plan' | 'research' | 'quickstart' | 'datamodel' | 'tasks' | 'contracts'

export const SPEC_FILE_MAPPING: Record<SpecFileType, string> = {
  spec: 'spec.md',
  plan: 'plan.md',
  research: 'research.md',
  quickstart: 'quickstart.md',
  datamodel: 'data-model.md',
  tasks: 'tasks.md',
  contracts: 'contracts/',
}

export const SPEC_FILE_TITLES: Record<SpecFileType, (feature: string) => string> = {
  spec: feature => `Feature Specification: ${feature}`,
  plan: feature => `Plan: ${feature}`,
  research: feature => `Research: ${feature}`,
  quickstart: feature => `Quickstart: ${feature}`,
  datamodel: feature => `Data Model: ${feature}`,
  tasks: feature => `Tasks: ${feature}`,
  contracts: feature => `API Contracts: ${feature}`,
}

export interface SyncStatus {
  status: 'draft' | 'synced' | 'conflict' | 'unknown'
  lastSync?: Date
  hasChanges: boolean
  remoteId?: string | number
  conflicts?: string[]
}

export interface SyncConfig {
  platform: string
  autoSync: boolean
  conflictStrategy: string
  github?: {
    owner: string
    repo: string
    auth: 'cli' | 'token' | 'app'
    token?: string
  }
  jira?: {
    host: string
    project: string
    auth: 'oauth' | 'basic'
    username?: string
    token?: string
  }
  asana?: {
    workspace: string
    project: string
    token: string
  }
}
