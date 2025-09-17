import type { SpecFileFrontmatter } from '../schemas'
import { z } from 'zod'

export type { AdapterCapabilities, RemoteRef, SyncAdapter } from '../adapters/base.adapter.js'
export type { SpecFileFrontmatter } from '../schemas/spec.ts'

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
  status: 'draft' | 'synced' | 'conflict' | 'local' | 'unknown'
  lastSync?: Date | null
  lastChecked?: Date | null
  hasChanges: boolean
  remoteId?: string | number
  conflicts?: string[]
}

export interface SyncConfig {
  platform: string
  autoSync?: boolean
  conflictStrategy?: string
  github?: {
    owner: string
    repo: string
    auth: 'cli' | 'token' | 'app'
    token?: string
    labels?: GitHubLabels
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
// GitHub labels configuration schema
export const githubLabelsSchema = z.object({
  spec: z.union([z.string(), z.array(z.string())]).optional(),
  plan: z.union([z.string(), z.array(z.string())]).optional(),
  research: z.union([z.string(), z.array(z.string())]).optional(),
  task: z.union([z.string(), z.array(z.string())]).optional(),
  quickstart: z.union([z.string(), z.array(z.string())]).optional(),
  datamodel: z.union([z.string(), z.array(z.string())]).optional(),
  contracts: z.union([z.string(), z.array(z.string())]).optional(),
  common: z.union([z.string(), z.array(z.string())]).optional(),
}).default({})

// GitHub configuration schema
export const githubConfigSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  auth: z.enum(['cli', 'token', 'app']).default('cli'),
  token: z.string().optional(),
  labels: githubLabelsSchema.optional(),
})

// Jira configuration schema
export const jiraConfigSchema = z.object({
  host: z.string(),
  project: z.string(),
  auth: z.enum(['oauth', 'basic']).default('basic'),
  username: z.string().optional(),
  token: z.string().optional(),
})

// Asana configuration schema
export const asanaConfigSchema = z.object({
  workspace: z.string(),
  project: z.string(),
  token: z.string(),
})

// Sync plugin configuration schema
export const syncPluginConfigSchema = z.object({
  platform: z.enum(['github', 'jira', 'asana', 'linear', 'notion']).default('github'),
  autoSync: z.boolean().default(true),
  conflictStrategy: z.enum(['manual', 'theirs', 'ours', 'interactive']).default('manual'),
  github: githubConfigSchema.optional(),
  jira: jiraConfigSchema.optional(),
  asana: asanaConfigSchema.optional(),
  validate: (config: unknown) => syncPluginConfigSchema.parse(config),
})

export type SyncPluginConfig = z.infer<typeof syncPluginConfigSchema>
export type GitHubLabels = z.infer<typeof githubLabelsSchema>
