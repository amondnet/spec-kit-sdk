import type { ConfigLoadOptions, ConfigProvider, SpecKitConfig } from '@spec-kit/core/config'
import { beforeEach, describe, expect, test } from 'bun:test'
import { SyncConfigLoader } from '../../src/config/loader.js'

// Mock ConfigManager for testing
class MockConfigManager implements ConfigProvider {
  private mockConfig: any = null
  private mockSyncConfig: any = null

  setMockConfig(config: any): void {
    this.mockConfig = config
  }

  setMockSyncConfig(syncConfig: any): void {
    this.mockSyncConfig = syncConfig
  }

  getConfig(): any {
    return this.mockConfig
  }

  clearCache(): void {
    this.mockConfig = null
    this.mockSyncConfig = null
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  getConfiguredPlugins(options: ConfigLoadOptions | undefined): Promise<string[]> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  getPluginConfig<T>(pluginName: string, validator: ((config: unknown) => T) | undefined, defaultConfig: T | undefined, options: ConfigLoadOptions | undefined): Promise<T> {
    return Promise.resolve(this.mockSyncConfig as T)
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  hasPlugin(pluginName: string, options: ConfigLoadOptions | undefined): Promise<boolean> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  load(options: ConfigLoadOptions | undefined): Promise<SpecKitConfig> {
    throw new Error('Method not implemented.')
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  reload(options: ConfigLoadOptions | undefined): Promise<SpecKitConfig> {
    throw new Error('Method not implemented.')
  }
}

describe('ConfigLoader', () => {
  let configLoader: SyncConfigLoader
  let mockConfigManager: MockConfigManager

  beforeEach(() => {
    configLoader = SyncConfigLoader.getInstance()
    mockConfigManager = new MockConfigManager()

    // Replace the internal config manager with our mock
    SyncConfigLoader.setConfigManager(mockConfigManager)
  })

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = SyncConfigLoader.getInstance()
      const instance2 = SyncConfigLoader.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('loadConfig', () => {
    test('should load basic sync config', async () => {
      const mockSyncConfig = {
        platform: 'github',
        autoSync: false,
        conflictStrategy: 'ours',
        github: {
          owner: 'example',
          repo: 'project',
          auth: 'token' as const,
          token: 'test-token',
        },
      }

      mockConfigManager.setMockSyncConfig(mockSyncConfig)

      const result = await configLoader.loadConfig()

      expect(result).toEqual({
        platform: 'github',
        autoSync: false,
        conflictStrategy: 'ours',
        github: {
          owner: 'example',
          repo: 'project',
          auth: 'token' as const,
          token: 'test-token',
        },
        jira: undefined,
        asana: undefined,
      })
    })

    test('should load config with custom path', async () => {
      const customPath = '/custom/config/path'
      const mockSyncConfig = {
        platform: 'jira',
        autoSync: true,
        conflictStrategy: 'theirs',
        jira: {
          host: 'company.atlassian.net',
          project: 'PROJ',
          auth: 'oauth' as const,
          username: 'user@company.com',
          token: 'oauth-token',
        },
      }

      mockConfigManager.setMockSyncConfig(mockSyncConfig)

      const result = await configLoader.loadConfig(customPath)

      expect(result).toEqual({
        platform: 'jira',
        autoSync: true,
        conflictStrategy: 'theirs',
        github: undefined,
        jira: {
          host: 'company.atlassian.net',
          project: 'PROJ',
          auth: 'oauth' as const,
          username: 'user@company.com',
          token: 'oauth-token',
        },
        asana: undefined,
      })
    })

    test('should load config with multiple platforms', async () => {
      const mockSyncConfig = {
        platform: 'github',
        autoSync: true,
        conflictStrategy: 'manual',
        github: {
          owner: 'org',
          repo: 'project',
          auth: 'cli' as const,
        },
        jira: {
          host: 'jira.company.com',
          project: 'DEV',
          auth: 'basic' as const,
          username: 'developer',
          token: 'api-token',
        },
        asana: {
          workspace: 'workspace-id',
          project: 'project-id',
          token: 'asana-token',
        },
      }

      mockConfigManager.setMockSyncConfig(mockSyncConfig)

      const result = await configLoader.loadConfig()

      expect(result.platform).toBe('github')
      expect(result.github).toEqual({
        owner: 'org',
        repo: 'project',
        auth: 'cli' as const,
      })
      expect(result.jira).toEqual({
        host: 'jira.company.com',
        project: 'DEV',
        auth: 'basic',
        username: 'developer',
        token: 'api-token',
      })
      expect(result.asana).toEqual({
        workspace: 'workspace-id',
        project: 'project-id',
        token: 'asana-token',
      })
    })

    test('should handle empty config gracefully', async () => {
      mockConfigManager.setMockSyncConfig({})

      const result = await configLoader.loadConfig()

      expect(result.platform).toBeUndefined()
      expect(result.autoSync).toBeUndefined()
      expect(result.conflictStrategy).toBeUndefined()
      expect(result.github).toBeUndefined()
      expect(result.jira).toBeUndefined()
      expect(result.asana).toBeUndefined()
    })
  })

  describe('getConfig', () => {
    test('should return cached config when available', () => {
      const mockConfig = {
        plugins: {
          sync: {
            platform: 'github',
            autoSync: true,
            github: {
              owner: 'cached-owner',
              repo: 'cached-repo',
              auth: 'cli' as const,
            },
          },
        },
      }

      mockConfigManager.setMockConfig(mockConfig)

      const result = configLoader.getConfig()

      expect(result).toEqual({
        platform: 'github',
        autoSync: true,
        conflictStrategy: undefined,
        github: {
          owner: 'cached-owner',
          repo: 'cached-repo',
          auth: 'cli' as const,
        },
        jira: undefined,
        asana: undefined,
      })
    })

    test('should return null when no config available', () => {
      mockConfigManager.setMockConfig(null)

      const result = configLoader.getConfig()

      expect(result).toBeNull()
    })

    test('should return null when plugins.sync is missing', () => {
      const mockConfig = {
        plugins: {
          deploy: {},
        },
      }

      mockConfigManager.setMockConfig(mockConfig)

      const result = configLoader.getConfig()

      expect(result).toBeNull()
    })

    test('should handle config without plugins section', () => {
      const mockConfig = {
        project: 'test-project',
      }

      mockConfigManager.setMockConfig(mockConfig)

      const result = configLoader.getConfig()

      expect(result).toBeNull()
    })
  })

  describe('clearCache', () => {
    test('should clear config manager cache', () => {
      // Set up some cached config
      const mockConfig = {
        plugins: {
          sync: {
            platform: 'github',
            autoSync: true,
          },
        },
      }

      mockConfigManager.setMockConfig(mockConfig)

      // Verify config exists
      expect(configLoader.getConfig()).not.toBeNull()

      // Clear cache
      configLoader.clearCache()

      // Verify cache was cleared (since our mock resets on clearCache)
      expect(configLoader.getConfig()).toBeNull()
    })
  })

  describe('convertFromCoreConfig', () => {
    test('should convert core config format to sync format', async () => {
      const coreConfig = {
        platform: 'github',
        autoSync: false,
        conflictStrategy: 'interactive',
        github: {
          owner: 'test-org',
          repo: 'test-project',
          auth: 'app' as const,
          token: 'github-app-token',
        },
        jira: {
          host: 'test.atlassian.net',
          project: 'TEST',
          auth: 'oauth' as const,
        },
      }

      mockConfigManager.setMockSyncConfig(coreConfig)

      const result = await configLoader.loadConfig()

      expect(result).toEqual({
        platform: 'github',
        autoSync: false,
        conflictStrategy: 'interactive',
        github: {
          owner: 'test-org',
          repo: 'test-project',
          auth: 'app' as const,
          token: 'github-app-token',
        },
        jira: {
          host: 'test.atlassian.net',
          project: 'TEST',
          auth: 'oauth' as const,
        },
        asana: undefined,
      })
    })

    test('should handle missing optional fields', async () => {
      const minimalConfig = {
        platform: 'jira',
      }

      mockConfigManager.setMockSyncConfig(minimalConfig)

      const result = await configLoader.loadConfig()

      expect(result.platform).toBe('jira')
      expect(result.autoSync).toBeUndefined()
      expect(result.conflictStrategy).toBeUndefined()
      expect(result.github).toBeUndefined()
      expect(result.jira).toBeUndefined()
      expect(result.asana).toBeUndefined()
    })

    test('should preserve all platform configurations', async () => {
      const fullConfig = {
        platform: 'asana',
        autoSync: true,
        conflictStrategy: 'ours',
        github: {
          owner: 'github-org',
          repo: 'github-repo',
          auth: 'cli' as const,
        },
        jira: {
          host: 'jira.example.com',
          project: 'EX',
          auth: 'basic' as const,
          username: 'user',
          token: 'token',
        },
        asana: {
          workspace: 'workspace-gid',
          project: 'project-gid',
          token: 'personal-access-token',
        },
      }

      mockConfigManager.setMockSyncConfig(fullConfig)

      const result = await configLoader.loadConfig()

      expect(result).toEqual(fullConfig)
    })
  })

  describe('configuration validation edge cases', () => {
    test('should handle undefined nested properties', async () => {
      const configWithUndefined = {
        platform: 'github',
        autoSync: true,
        github: undefined,
        jira: null,
      }

      mockConfigManager.setMockSyncConfig(configWithUndefined)

      const result = await configLoader.loadConfig()

      expect(result.platform).toBe('github')
      expect(result.autoSync).toBe(true)
      expect(result.github).toBeUndefined()
      expect(result.jira).toBeNull()
    })

    test('should handle extra properties in config', async () => {
      const configWithExtra = {
        platform: 'github',
        autoSync: true,
        conflictStrategy: 'manual',
        extraProperty: 'should be ignored',
        github: {
          owner: 'test',
          repo: 'test',
          auth: 'cli' as const,
          extraGithubProp: 'ignored',
        },
      }

      mockConfigManager.setMockSyncConfig(configWithExtra)

      const result = await configLoader.loadConfig()

      // The convertFromCoreConfig method passes through the data as-is
      expect(result.platform).toBe('github')
      expect(result.autoSync).toBe(true)
      expect(result.conflictStrategy).toBe('manual')
      expect(result.github?.owner).toBe('test')
      expect(result.github?.repo).toBe('test')
      expect(result.github?.auth).toBe('cli')
    })
  })

  describe('GitHub labels configuration', () => {
    test('should load config with basic labels', async () => {
      const configWithLabels = {
        platform: 'github',
        autoSync: true,
        conflictStrategy: 'manual',
        github: {
          owner: 'test-org',
          repo: 'test-repo',
          auth: 'cli' as const,
          labels: {
            spec: 'spec',
            plan: 'plan',
            research: 'research',
          },
        },
      }

      mockConfigManager.setMockSyncConfig(configWithLabels)

      const result = await configLoader.loadConfig()

      expect(result.github?.labels).toEqual({
        common: 'speckit',
        contracts: 'contracts',
        datamodel: 'data-model',
        quickstart: 'quickstart',
        task: 'task',
        spec: 'spec',
        plan: 'plan',
        research: 'research',
      })
    })

    test('should load config with namespace-style labels', async () => {
      const configWithNamespaceLabels = {
        platform: 'github',
        autoSync: true,
        github: {
          owner: 'test-org',
          repo: 'test-repo',
          auth: 'cli' as const,
          labels: {
            spec: 'speckit:spec',
            plan: 'speckit:plan',
            research: 'speckit:research',
            task: 'speckit:task',
            common: 'speckit',
          },
        },
      }

      mockConfigManager.setMockSyncConfig(configWithNamespaceLabels)

      const result = await configLoader.loadConfig()

      expect(result.github?.labels).toEqual({
        spec: 'speckit:spec',
        plan: 'speckit:plan',
        research: 'speckit:research',
        task: 'speckit:task',
        common: 'speckit',
      })
    })

    test('should load config with array labels', async () => {
      const configWithArrayLabels = {
        platform: 'github',
        autoSync: true,
        github: {
          owner: 'test-org',
          repo: 'test-repo',
          auth: 'cli' as const,
          labels: {
            spec: ['speckit', 'spec'],
            plan: ['speckit', 'plan', 'implementation'],
            research: 'speckit:research',
            common: ['speckit', 'epic'],
          },
        },
      }

      mockConfigManager.setMockSyncConfig(configWithArrayLabels)

      const result = await configLoader.loadConfig()

      expect(result.github?.labels).toEqual({
        spec: ['speckit', 'spec'],
        plan: ['speckit', 'plan', 'implementation'],
        research: 'speckit:research',
        common: ['speckit', 'epic'],
      })
    })

    test('should handle config without labels', async () => {
      const configWithoutLabels = {
        platform: 'github',
        autoSync: true,
        github: {
          owner: 'test-org',
          repo: 'test-repo',
          auth: 'cli' as const,
        },
      }

      mockConfigManager.setMockSyncConfig(configWithoutLabels)

      const result = await configLoader.loadConfig()

      expect(result.github?.labels).toBeUndefined()
    })
  })
})
