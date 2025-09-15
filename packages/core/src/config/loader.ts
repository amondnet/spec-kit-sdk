import type { SpecKitConfig } from './schemas.js'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import yaml from 'js-yaml'
import { validateConfig } from './schemas.js'

export interface ConfigLoadOptions {
  customPath?: string
  workingDir?: string
  envPrefix?: string
}

export class ConfigLoader {
  private static instance: ConfigLoader
  private configCache = new Map<string, SpecKitConfig>()

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  async loadConfig(options: ConfigLoadOptions = {}): Promise<SpecKitConfig> {
    const {
      customPath,
      workingDir = process.cwd(),
      envPrefix = 'SPEC_KIT',
    } = options

    // Create cache key
    const cacheKey = JSON.stringify({ customPath, workingDir, envPrefix })

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!
    }

    const configPaths = this.getConfigPaths(customPath, workingDir)
    let config: SpecKitConfig | null = null

    // Try to load from each config path
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          config = await this.loadConfigFromFile(configPath, envPrefix)
          break
        }
        catch (error) {
          console.warn(`Failed to load config from ${configPath}:`, error)
        }
      }
    }

    // If no config found, use default
    if (!config) {
      config = this.getDefaultConfig()
    }

    // Validate and cache
    const validatedConfig = validateConfig(config)
    this.configCache.set(cacheKey, validatedConfig)

    return validatedConfig
  }

  private getConfigPaths(customPath?: string, workingDir?: string): string[] {
    const baseDir = workingDir || process.cwd()

    const paths = [
      customPath,
      // Centralized config locations
      join(baseDir, '.specify', 'config.yml'),
      join(baseDir, '.specify', 'config.yaml'),
      join(baseDir, '.specify', 'config.json'),
      join(baseDir, '.spec-kit', 'config.yml'),
      join(baseDir, '.spec-kit', 'config.yaml'),
      join(baseDir, '.spec-kit', 'config.json'),
      // Legacy locations for backward compatibility
      join(baseDir, 'spec-kit.config.yml'),
      join(baseDir, 'spec-kit.config.yaml'),
      join(baseDir, 'spec-kit.config.json'),
    ].filter(Boolean) as string[]

    return paths.map(path => resolve(path))
  }

  private async loadConfigFromFile(configPath: string, envPrefix: string): Promise<SpecKitConfig> {
    const content = readFileSync(configPath, 'utf-8')
    let rawConfig: unknown

    if (configPath.endsWith('.json')) {
      rawConfig = JSON.parse(content)
    }
    else if (configPath.endsWith('.yml') || configPath.endsWith('.yaml')) {
      rawConfig = yaml.load(content)
    }
    else {
      throw new Error(`Unsupported config file format: ${configPath}`)
    }

    // Interpolate environment variables
    const interpolatedConfig = this.interpolateEnvironmentVariables(rawConfig, envPrefix)

    return validateConfig(interpolatedConfig)
  }

  private interpolateEnvironmentVariables(obj: unknown, envPrefix: string): unknown {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        // Try with prefix first, then without
        const prefixedName = `${envPrefix}_${varName}`
        return process.env[prefixedName] || process.env[varName] || match
      })
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateEnvironmentVariables(item, envPrefix))
    }

    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateEnvironmentVariables(value, envPrefix)
      }
      return result
    }

    return obj
  }

  private getDefaultConfig(): SpecKitConfig {
    return {
      version: '1.0',
      plugins: {
        sync: {
          platform: 'github',
          autoSync: true,
          conflictStrategy: 'manual',
          github: {
            owner: process.env.GITHUB_OWNER || process.env.SPEC_KIT_GITHUB_OWNER || '',
            repo: process.env.GITHUB_REPO || process.env.SPEC_KIT_GITHUB_REPO || '',
            auth: 'cli',
          },
        },
      },
    }
  }

  clearCache(): void {
    this.configCache.clear()
  }

  getCacheKey(options: ConfigLoadOptions = {}): string {
    const {
      customPath,
      workingDir = process.cwd(),
      envPrefix = 'SPEC_KIT',
    } = options
    return JSON.stringify({ customPath, workingDir, envPrefix })
  }
}
