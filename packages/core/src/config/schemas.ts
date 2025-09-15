import { z } from 'zod'

// Base configuration schema
export const baseConfigSchema = z.object({
  version: z.string().default('1.0'),
  plugins: z.record(z.unknown()).default({}),
})

// GitHub labels configuration schema
export const githubLabelsSchema = z.object({
  spec: z.union([z.string(), z.array(z.string())]).default('spec'),
  plan: z.union([z.string(), z.array(z.string())]).default('plan'),
  research: z.union([z.string(), z.array(z.string())]).default('research'),
  task: z.union([z.string(), z.array(z.string())]).default('task'),
  quickstart: z.union([z.string(), z.array(z.string())]).default('quickstart'),
  datamodel: z.union([z.string(), z.array(z.string())]).default('data-model'),
  contracts: z.union([z.string(), z.array(z.string())]).default('contracts'),
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
})

// Test runner plugin configuration schema
export const testRunnerPluginConfigSchema = z.object({
  framework: z.enum(['jest', 'vitest', 'playwright']).default('jest'),
  parallel: z.boolean().default(true),
  coverage: z.boolean().default(false),
  timeout: z.number().default(30000),
})

// Deploy plugin configuration schema
export const deployPluginConfigSchema = z.object({
  target: z.enum(['aws', 'vercel', 'netlify', 'docker']).default('aws'),
  environment: z.enum(['dev', 'staging', 'prod']).default('dev'),
  autoDeployBranches: z.array(z.string()).default(['main', 'develop']),
})

// Known plugins configuration schemas
export const pluginsConfigSchema = z.object({
  'sync': syncPluginConfigSchema.optional(),
  'test-runner': testRunnerPluginConfigSchema.optional(),
  'deploy': deployPluginConfigSchema.optional(),
}).catchall(z.unknown()) // Allow unknown plugins

// Full configuration schema
export const configSchema = z.object({
  version: z.string().default('1.0'),
  plugins: pluginsConfigSchema.default({}),
})

// Type exports
export type BaseConfig = z.infer<typeof baseConfigSchema>
export type GitHubLabels = z.infer<typeof githubLabelsSchema>
export type GithubConfig = z.infer<typeof githubConfigSchema>
export type JiraConfig = z.infer<typeof jiraConfigSchema>
export type AsanaConfig = z.infer<typeof asanaConfigSchema>
export type SyncPluginConfig = z.infer<typeof syncPluginConfigSchema>
export type TestRunnerPluginConfig = z.infer<typeof testRunnerPluginConfigSchema>
export type DeployPluginConfig = z.infer<typeof deployPluginConfigSchema>
export type PluginsConfig = z.infer<typeof pluginsConfigSchema>
export type SpecKitConfig = z.infer<typeof configSchema>

// Configuration validation
export function validateConfig(config: unknown): SpecKitConfig {
  return configSchema.parse(config)
}

// Plugin-specific validation
export function validateSyncConfig(config: unknown): SyncPluginConfig {
  return syncPluginConfigSchema.parse(config)
}

export function validateTestRunnerConfig(config: unknown): TestRunnerPluginConfig {
  return testRunnerPluginConfigSchema.parse(config)
}

export function validateDeployConfig(config: unknown): DeployPluginConfig {
  return deployPluginConfigSchema.parse(config)
}
