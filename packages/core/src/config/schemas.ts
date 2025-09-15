import { z } from 'zod'

// Base configuration schema
export const baseConfigSchema = z.object({
  version: z.string().default('1.0'),
  plugins: z.record(z.string(), z.unknown()).default({}),
})

export const pluginsConfigSchema = z.record(z.string(), z.any())

// Full configuration schema
export const configSchema = z.object({
  version: z.string().default('1.0'),
  plugins: pluginsConfigSchema.default({}),
})

// Type exports
export type BaseConfig = z.infer<typeof baseConfigSchema>
export type PluginsConfig = z.infer<typeof pluginsConfigSchema>
export type SpecKitConfig = z.infer<typeof configSchema>

// Configuration validation
export function validateConfig(config: unknown): SpecKitConfig {
  return configSchema.parse(config)
}
