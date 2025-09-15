// Export all configuration-related functionality
export { ConfigManager } from './config-manager'
export { ConfigLoader } from './loader.js'
export type { ConfigLoadOptions } from './loader.js'

// Export schemas and types
export {
  asanaConfigSchema,
  baseConfigSchema,
  configSchema,
  deployPluginConfigSchema,
  githubConfigSchema,
  jiraConfigSchema,
  pluginsConfigSchema,
  syncPluginConfigSchema,
  testRunnerPluginConfigSchema,
  validateConfig,
  validateDeployConfig,
  validateSyncConfig,
  validateTestRunnerConfig,
} from './schemas.js'

export type {
  AsanaConfig,
  BaseConfig,
  DeployPluginConfig,
  GithubConfig,
  GitHubLabels,
  JiraConfig,
  PluginsConfig,
  SpecKitConfig,
  SyncPluginConfig,
  TestRunnerPluginConfig,
} from './schemas.js'
