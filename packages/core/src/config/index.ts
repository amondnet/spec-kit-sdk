// Export all configuration-related functionality
export { ConfigManager } from './config-manager'
export { ConfigLoader } from './loader.js'
export type { ConfigLoadOptions } from './loader.js'

// Export schemas and types
export {
  baseConfigSchema,
  githubConfigSchema,
  jiraConfigSchema,
  asanaConfigSchema,
  syncPluginConfigSchema,
  testRunnerPluginConfigSchema,
  deployPluginConfigSchema,
  pluginsConfigSchema,
  configSchema,
  validateConfig,
  validateSyncConfig,
  validateTestRunnerConfig,
  validateDeployConfig,
} from './schemas.js'

export type {
  BaseConfig,
  GithubConfig,
  JiraConfig,
  AsanaConfig,
  SyncPluginConfig,
  TestRunnerPluginConfig,
  DeployPluginConfig,
  PluginsConfig,
  SpecKitConfig,
} from './schemas.js'