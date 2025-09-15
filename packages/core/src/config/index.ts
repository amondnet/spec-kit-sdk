// Export all configuration-related functionality
export { ConfigManager, type ConfigProvider } from './config-manager'
export { ConfigLoader } from './loader.js'
export type { ConfigLoadOptions } from './loader.js'

// Export schemas and types
export {
  baseConfigSchema,
  configSchema,
  pluginsConfigSchema,
  validateConfig,
} from './schemas.js'

export type {
  BaseConfig,
  PluginsConfig,
  SpecKitConfig,
} from './schemas.js'
