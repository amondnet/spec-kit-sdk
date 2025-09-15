import type { SyncConfig } from '../types'
import { ConfigManager } from '@spec-kit/core'

export class ConfigLoader {
  private static instance: ConfigLoader
  private configManager: ConfigManager

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  constructor() {
    this.configManager = new ConfigManager()
  }

  async loadConfig(customPath?: string): Promise<SyncConfig> {
    const options = customPath ? { customPath } : undefined
    const coreConfig = await this.configManager.getSyncConfig(options)

    // Convert from core config format to sync plugin format
    return this.convertFromCoreConfig(coreConfig)
  }

  private convertFromCoreConfig(coreConfig: any): SyncConfig {
    return {
      platform: coreConfig.platform,
      autoSync: coreConfig.autoSync,
      conflictStrategy: coreConfig.conflictStrategy,
      github: coreConfig.github,
      jira: coreConfig.jira,
      asana: coreConfig.asana,
    }
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
