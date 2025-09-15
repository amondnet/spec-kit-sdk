import type { ConfigProvider } from '@spec-kit/core/config'
import type { SyncConfig } from '../types'
import { ConfigManager } from '@spec-kit/core/config'

export class SyncConfigLoader {
  private static instance: SyncConfigLoader
  private configManager: ConfigProvider

  static getInstance(): SyncConfigLoader {
    if (!SyncConfigLoader.instance) {
      SyncConfigLoader.instance = new SyncConfigLoader()
    }
    return SyncConfigLoader.instance
  }

  static setConfigManager(configManager: ConfigProvider): void {
    this.getInstance().configManager = configManager
  }

  constructor() {
    this.configManager = new ConfigManager()
  }

  async loadConfig(customPath?: string): Promise<SyncConfig> {
    const options = customPath ? { customPath } : undefined
    const coreConfig = await this.configManager.getPluginConfig('sync', undefined, null, options)

    // Convert from core config format to sync plugin format
    return this.convertFromCoreConfig(coreConfig)
  }

  private convertFromCoreConfig(coreConfig: any): SyncConfig {
    const result: SyncConfig = {
      platform: coreConfig.platform,
      autoSync: coreConfig.autoSync,
      conflictStrategy: coreConfig.conflictStrategy,
      github: coreConfig.github,
      jira: coreConfig.jira,
      asana: coreConfig.asana,
    }

    // Add default labels for GitHub if labels are provided and need defaults
    if (result.github?.labels) {
      const labels = result.github.labels
      const hasDefaults = labels.common !== undefined ||
                         labels.contracts !== undefined ||
                         labels.datamodel !== undefined ||
                         labels.quickstart !== undefined ||
                         labels.task !== undefined

      // Only add defaults if they're not already present (partial label config)
      if (!hasDefaults) {
        const defaultLabels = {
          common: 'speckit',
          contracts: 'contracts',
          datamodel: 'data-model',
          quickstart: 'quickstart',
          task: 'task',
        }

        result.github.labels = {
          ...defaultLabels,
          ...result.github.labels,
        }
      }
    }

    return result
  }

  getConfig(): SyncConfig | null {
    const coreConfig = this.configManager.getConfig()
    if (!coreConfig?.plugins?.sync) {
      return null
    }
    return this.convertFromCoreConfig(coreConfig.plugins.sync)
  }

  clearCache(): void {
    this.configManager.clearCache()
  }
}
