import type { ConfigLoadOptions } from './loader.js'
import type {
  DeployPluginConfig,
  SpecKitConfig,
  SyncPluginConfig,
  TestRunnerPluginConfig,
} from './schemas.js'
import { ConfigLoader } from './loader.js'
import {
  validateDeployConfig,
  validateSyncConfig,
  validateTestRunnerConfig,
} from './schemas.js'

export class ConfigManager {
  private loader: ConfigLoader
  private config: SpecKitConfig | null = null

  constructor(loader?: ConfigLoader) {
    this.loader = loader || ConfigLoader.getInstance()
  }

  /**
   * Load the configuration from file or return cached version
   */
  async load(options?: ConfigLoadOptions): Promise<SpecKitConfig> {
    if (!this.config) {
      this.config = await this.loader.loadConfig(options)
    }
    return this.config
  }

  /**
   * Force reload the configuration from file
   */
  async reload(options?: ConfigLoadOptions): Promise<SpecKitConfig> {
    this.loader.clearCache()
    this.config = null
    return this.load(options)
  }

  /**
   * Get the current loaded configuration
   */
  getConfig(): SpecKitConfig | null {
    return this.config
  }

  /**
   * Get configuration for the sync plugin
   */
  async getSyncConfig(options?: ConfigLoadOptions): Promise<SyncPluginConfig> {
    const config = await this.load(options)
    const syncConfig = config.plugins?.sync

    if (!syncConfig) {
      // Return default sync config
      return validateSyncConfig({
        platform: 'github',
        autoSync: true,
        conflictStrategy: 'manual',
        github: {
          owner: process.env.GITHUB_OWNER || process.env.SPEC_KIT_GITHUB_OWNER || '',
          repo: process.env.GITHUB_REPO || process.env.SPEC_KIT_GITHUB_REPO || '',
          auth: 'cli',
        },
      })
    }

    return validateSyncConfig(syncConfig)
  }

  /**
   * Get configuration for the test-runner plugin
   */
  async getTestRunnerConfig(options?: ConfigLoadOptions): Promise<TestRunnerPluginConfig> {
    const config = await this.load(options)
    const testConfig = config.plugins?.['test-runner']

    if (!testConfig) {
      // Return default test runner config
      return validateTestRunnerConfig({
        framework: 'jest',
        parallel: true,
        coverage: false,
        timeout: 30000,
      })
    }

    return validateTestRunnerConfig(testConfig)
  }

  /**
   * Get configuration for the deploy plugin
   */
  async getDeployConfig(options?: ConfigLoadOptions): Promise<DeployPluginConfig> {
    const config = await this.load(options)
    const deployConfig = config.plugins?.deploy

    if (!deployConfig) {
      // Return default deploy config
      return validateDeployConfig({
        target: 'aws',
        environment: 'dev',
        autoDeployBranches: ['main', 'develop'],
      })
    }

    return validateDeployConfig(deployConfig)
  }

  /**
   * Get configuration for a custom plugin
   */
  async getPluginConfig<T>(
    pluginName: string,
    validator?: (config: unknown) => T,
    defaultConfig?: T,
    options?: ConfigLoadOptions,
  ): Promise<T> {
    const config = await this.load(options)
    const pluginConfig = config.plugins?.[pluginName]

    if (!pluginConfig) {
      if (defaultConfig) {
        return defaultConfig
      }
      throw new Error(`No configuration found for plugin: ${pluginName}`)
    }

    if (validator) {
      return validator(pluginConfig)
    }

    return pluginConfig as T
  }

  /**
   * Check if a plugin is configured
   */
  async hasPlugin(pluginName: string, options?: ConfigLoadOptions): Promise<boolean> {
    const config = await this.load(options)
    return Boolean(config.plugins?.[pluginName])
  }

  /**
   * Get all configured plugin names
   */
  async getConfiguredPlugins(options?: ConfigLoadOptions): Promise<string[]> {
    const config = await this.load(options)
    return Object.keys(config.plugins || {})
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.loader.clearCache()
    this.config = null
  }
}
