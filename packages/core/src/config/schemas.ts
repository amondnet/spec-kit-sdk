import { z } from 'zod'

// Base configuration schema
export const baseConfigSchema = z.object({
  version: z.string().default('1.0'),
  plugins: z.record(z.string(), z.unknown()).default({}),
})

export const pluginsConfigSchema = z.record(z.string(), z.any())

// CLI configuration schema
export const cliConfigSchema = z.object({
  mode: z.enum(['official-first', 'bun-first']).default('bun-first'),
  official: z.object({
    repository: z.string().default('git+https://github.com/github/spec-kit.git'),
  }).optional(),
})

// Full configuration schema
export const configSchema = z.object({
  version: z.string().default('1.0'),
  cli: cliConfigSchema.optional(),
  plugins: pluginsConfigSchema.default({}),
})

// Type exports
export type BaseConfig = z.infer<typeof baseConfigSchema>
export type PluginsConfig = z.infer<typeof pluginsConfigSchema>
export type CLIConfig = z.infer<typeof cliConfigSchema>
export type SpecKitConfig = z.infer<typeof configSchema>

// Configuration validation
export function validateConfig(config: unknown): SpecKitConfig {
  return configSchema.parse(config)
}
