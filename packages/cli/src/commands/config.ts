import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as process from 'node:process'
import { ConfigManager } from '@spec-kit/core'
import { Command } from 'commander'
import { cyan, green, red, yellow } from 'picocolors'

export function createConfigCommand(): Command {
  const cmd = new Command('config')
  cmd.description('Manage Spec-Kit configuration')

  cmd.command('show')
    .description('Show current configuration')
    .option('-p, --path <path>', 'Custom config file path')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager()
        const config = await configManager.load({ customPath: options.path })

        console.log(yellow('Current configuration:'))
        console.log(JSON.stringify(config, null, 2))
      }
      catch (error) {
        console.error(red('Failed to load configuration:'), error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  cmd.command('init')
    .description('Initialize a new configuration file')
    .option('-p, --path <path>', 'Custom config file path', '.specify/config.yml')
    .option('-f, --force', 'Overwrite existing config file')
    .action(async (options) => {
      try {
        const configPath = options.path
        const fullPath = join(process.cwd(), configPath)

        if (existsSync(fullPath) && !options.force) {
          console.error(red(`Configuration file already exists: ${configPath}`))
          console.log(yellow('Use --force to overwrite'))
          process.exit(1)
        }

        // Create directory if it doesn't exist
        const dir = dirname(fullPath)
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }

        // Create default config
        const defaultConfig = `version: "1.0"

plugins:
  sync:
    platform: github
    autoSync: true
    conflictStrategy: manual
    github:
      owner: \${GITHUB_OWNER}
      repo: \${GITHUB_REPO}
      auth: cli
      # token: \${GITHUB_TOKEN}  # Optional: for token-based auth
`

        writeFileSync(fullPath, defaultConfig, 'utf-8')
        console.log(green(`✓ Created configuration file: ${configPath}`))
        console.log(cyan('Next steps:'))
        console.log(cyan('1. Set your GITHUB_OWNER and GITHUB_REPO environment variables'))
        console.log(cyan('2. Configure additional plugins as needed'))
        console.log(cyan(`3. Edit ${configPath} to customize your settings`))
      }
      catch (error) {
        console.error(red('Failed to create configuration file:'), error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  cmd.command('validate')
    .description('Validate configuration file')
    .option('-p, --path <path>', 'Custom config file path')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager()
        await configManager.load({ customPath: options.path })
        console.log(green('✓ Configuration is valid'))
      }
      catch (error) {
        console.error(red('✗ Configuration validation failed:'))
        console.error(red(error instanceof Error ? error.message : String(error)))
        process.exit(1)
      }
    })

  cmd.command('plugins')
    .description('List configured plugins')
    .option('-p, --path <path>', 'Custom config file path')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager()
        const plugins = await configManager.getConfiguredPlugins({ customPath: options.path })

        if (plugins.length === 0) {
          console.log(yellow('No plugins configured'))
          return
        }

        console.log(green('Configured plugins:'))
        for (const plugin of plugins) {
          console.log(`  • ${cyan(plugin)}`)
        }
      }
      catch (error) {
        console.error(red('Failed to list plugins:'), error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  return cmd
}
