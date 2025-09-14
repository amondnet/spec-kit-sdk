import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SyncConfig } from '../types/index.js';

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: SyncConfig | null = null;

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  async loadConfig(customPath?: string): Promise<SyncConfig> {
    if (this.config) {
      return this.config;
    }

    const configPaths = [
      customPath,
      '.specify/sync.config.yaml',
      '.specify/sync.config.yml',
      '.specify/sync.config.json',
      '.spec-kit/sync.config.yaml',
      '.spec-kit/sync.config.yml',
      '.spec-kit/sync.config.json',
    ].filter(Boolean) as string[];

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, 'utf-8');

          if (configPath.endsWith('.json')) {
            this.config = JSON.parse(content);
          } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
            // Would need yaml parser, for now support JSON in yaml files
            this.config = JSON.parse(content);
          }

          if (this.config) {
            return this.validateConfig(this.config);
          }
        } catch (error) {
          console.warn(`Failed to load config from ${configPath}:`, error);
        }
      }
    }

    // Return default config
    this.config = this.getDefaultConfig();
    return this.config;
  }

  private getDefaultConfig(): SyncConfig {
    return {
      platform: 'github',
      autoSync: true,
      conflictStrategy: 'manual',
      github: {
        owner: process.env.GITHUB_OWNER || '',
        repo: process.env.GITHUB_REPO || '',
        auth: 'cli'
      }
    };
  }

  private validateConfig(config: SyncConfig): SyncConfig {
    // Basic validation
    if (!config.platform) {
      config.platform = 'github';
    }

    if (!['github', 'jira', 'asana'].includes(config.platform)) {
      throw new Error(`Unsupported platform: ${config.platform}`);
    }

    if (!config.conflictStrategy) {
      config.conflictStrategy = 'manual';
    }

    if (!['manual', 'theirs', 'ours', 'interactive'].includes(config.conflictStrategy)) {
      throw new Error(`Invalid conflict strategy: ${config.conflictStrategy}`);
    }

    // Platform-specific validation
    if (config.platform === 'github' && config.github) {
      if (!config.github.owner || !config.github.repo) {
        throw new Error('GitHub configuration requires owner and repo');
      }
    }

    if (config.platform === 'jira' && config.jira) {
      if (!config.jira.host || !config.jira.project) {
        throw new Error('Jira configuration requires host and project');
      }
    }

    if (config.platform === 'asana' && config.asana) {
      if (!config.asana.workspace || !config.asana.project || !config.asana.token) {
        throw new Error('Asana configuration requires workspace, project, and token');
      }
    }

    return config;
  }

  getConfig(): SyncConfig | null {
    return this.config;
  }

  clearCache(): void {
    this.config = null;
  }
}