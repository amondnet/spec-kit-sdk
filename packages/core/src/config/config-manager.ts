import type { ConfigLoadOptions } from './loader.js'
import type { SpecKitConfig } from './schemas.js'
import { ConfigLoader } from './loader.js'

export interface ConfigProvider {
  /**
   * Load the configuration from file or return cached version
   */
  load: (options?: ConfigLoadOptions) => Promise<SpecKitConfig>

  /**
   * Force reload the configuration from file
   */
  reload: (options?: ConfigLoadOptions) => Promise<SpecKitConfig>

  /**
   * Get the current loaded configuration
   */
  getConfig: () => SpecKitConfig | null

  /**
   * Get configuration for a custom plugin
   */
  getPluginConfig: <T>(
    pluginName: string,
    validator?: (config: unknown) => T,
    defaultConfig?: T,
    options?: ConfigLoadOptions,
  ) => Promise<T>

  /**
   * Check if a plugin is configured
   */
  hasPlugin: (pluginName: string, options?: ConfigLoadOptions) => Promise<boolean>

  /**
   * Get all configured plugin names
   */
  getConfiguredPlugins: (options?: ConfigLoadOptions) => Promise<string[]>

  /**
   * Clear the configuration cache
   */
  clearCache: () => void
}

export class ConfigManager implements ConfigProvider {
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
