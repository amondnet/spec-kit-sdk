/**
 * Init command - Initialize a new Specify project
 */

import type { InitOptions, TemplateMetadata } from '../types'
import path from 'node:path'
import process from 'node:process'
import pc from 'picocolors'
import { AI_ASSISTANTS, SCRIPT_TYPES } from '../types'
import { consoleUtils } from '../ui/Console.js'
import { InteractiveSelect } from '../ui/InteractiveSelect.js'
import { StepTracker } from '../ui/StepTracker.js'
import { ArchiveUtils } from '../utils/Archive.js'
import { FileSystemUtils } from '../utils/FileSystem.js'
import { NetworkUtils } from '../utils/Network.js'
import { PlatformUtils } from '../utils/Platform.js'

// Live update helper for step tracker
class LiveDisplay {
  private intervalId?: NodeJS.Timeout
  private readonly tracker: StepTracker

  constructor(tracker: StepTracker) {
    this.tracker = tracker
  }

  start(): void {
    // Print initial state
    this.update()

    // Update every 100ms
    this.intervalId = setInterval(() => {
      this.update()
    }, 100)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    // Clear current display and show final state
    process.stdout.write('\x1B[2K\r') // Clear line
    consoleUtils.log(this.tracker.render())
  }

  private update(): void {
    // Move cursor up to overwrite previous output
    const lines = this.tracker.render().split('\n')
    if (lines.length > 0) {
      process.stdout.write(`\x1B[${lines.length}A`)
    }
    process.stdout.write('\x1B[2K') // Clear line
    consoleUtils.log(this.tracker.render())
  }
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Banner is shown by the main CLI handler

  // Validate arguments
  if (options.here && options.projectName) {
    consoleUtils.error('Cannot specify both project name and --here flag')
    process.exit(1)
  }

  if (!options.here && !options.projectName) {
    consoleUtils.error('Must specify either a project name or use --here flag')
    process.exit(1)
  }

  // Determine project directory
  const projectName = options.here ? path.basename(process.cwd()) : options.projectName!
  const projectPath = options.here ? process.cwd() : path.resolve(options.projectName!)

  // Check for existing directory
  if (!options.here && await FileSystemUtils.exists(projectPath)) {
    consoleUtils.error(`Directory '${options.projectName}' already exists`)
    process.exit(1)
  }

  // Check for non-empty current directory with --here
  if (options.here) {
    const items = await FileSystemUtils.listDirectory(projectPath)
    if (items.length > 0) {
      consoleUtils.warn(`Current directory is not empty (${items.length} items)`)
      consoleUtils.warn('Template files will be merged with existing content and may overwrite existing files')

      const response = await InteractiveSelect.confirm('Do you want to continue?')
      if (!response) {
        consoleUtils.warn('Operation cancelled')
        process.exit(0)
      }
    }
  }

  // Display project info
  consoleUtils.panel(
    `${options.here ? 'Initializing in current directory:' : 'Creating new project:'} ${pc.green(projectName)}${
      options.here ? `\nPath: ${pc.dim(projectPath)}` : ''}`,
    'Specify Project Setup',
    'cyan',
  )

  // Check git availability
  let gitAvailable = true
  if (!options.noGit) {
    gitAvailable = PlatformUtils.commandExists('git')
    if (!gitAvailable) {
      consoleUtils.warn('Git not found - will skip repository initialization')
    }
  }

  // AI assistant selection
  let selectedAI: string
  if (options.aiAssistant) {
    if (!(options.aiAssistant in AI_ASSISTANTS)) {
      consoleUtils.error(`Invalid AI assistant '${options.aiAssistant}'. Choose from: ${Object.keys(AI_ASSISTANTS).join(', ')}`)
      process.exit(1)
    }
    selectedAI = options.aiAssistant
  }
  else {
    const aiOptions: Record<string, string> = {}
    Object.entries(AI_ASSISTANTS).forEach(([key, assistant]) => {
      aiOptions[key] = assistant.name
    })
    selectedAI = await InteractiveSelect.select(aiOptions, 'Choose your AI assistant:', 'copilot')
  }

  // Check agent tools unless ignored
  if (!options.ignoreAgentTools) {
    const assistant = AI_ASSISTANTS[selectedAI]
    if (assistant.command) {
      let isAvailable = false

      if (selectedAI === 'claude') {
        isAvailable = PlatformUtils.isClaudeAvailable()
      }
      else {
        isAvailable = PlatformUtils.commandExists(assistant.command)
      }

      if (!isAvailable) {
        consoleUtils.error(`${assistant.name} CLI is required for ${assistant.name} projects`)
        consoleUtils.error(`Install from: ${assistant.installUrl}`)
        consoleUtils.error('')
        consoleUtils.error('Tip: Use --ignore-agent-tools to skip this check')
        process.exit(1)
      }
    }
  }

  // Script type selection
  let selectedScript: string
  if (options.scriptType) {
    if (!(options.scriptType in SCRIPT_TYPES)) {
      consoleUtils.error(`Invalid script type '${options.scriptType}'. Choose from: ${Object.keys(SCRIPT_TYPES).join(', ')}`)
      process.exit(1)
    }
    selectedScript = options.scriptType
  }
  else {
    const defaultScript = PlatformUtils.getDefaultScriptType()
    selectedScript = await InteractiveSelect.select(SCRIPT_TYPES, 'Choose script type:', defaultScript)
  }

  consoleUtils.info(`Selected AI assistant: ${selectedAI}`)
  consoleUtils.info(`Selected script type: ${selectedScript}`)

  // Setup progress tracker
  const tracker = new StepTracker('Initialize Specify Project')

  // Add completed steps
  tracker.add('precheck', 'Check required tools')
  tracker.complete('precheck', 'ok')
  tracker.add('ai-select', 'Select AI assistant')
  tracker.complete('ai-select', selectedAI)
  tracker.add('script-select', 'Select script type')
  tracker.complete('script-select', selectedScript)

  // Add pending steps
  tracker.add('fetch', 'Fetch latest release')
  tracker.add('download', 'Download template')
  tracker.add('extract', 'Extract template')
  tracker.add('chmod', 'Set script permissions')
  tracker.add('cleanup', 'Cleanup')
  tracker.add('git', 'Initialize git repository')
  tracker.add('final', 'Finalize')

  // Start live display
  const liveDisplay = new LiveDisplay(tracker)
  liveDisplay.start()

  try {
    // Download and extract template
    await downloadAndExtractTemplate(
      projectPath,
      selectedAI,
      selectedScript,
      options.here || false,
      tracker,
      options,
    )

    // Ensure scripts are executable
    tracker.start('chmod')
    const { updated, failures } = await FileSystemUtils.ensureExecutableScripts(projectPath)
    if (failures.length > 0) {
      tracker.error('chmod', `${updated} updated, ${failures.length} failed`)
    }
    else {
      tracker.complete('chmod', `${updated} updated`)
    }

    // Git initialization
    if (!options.noGit) {
      tracker.start('git')
      if (await FileSystemUtils.isGitRepo(projectPath)) {
        tracker.complete('git', 'existing repo detected')
      }
      else if (gitAvailable) {
        if (await FileSystemUtils.initGitRepo(projectPath)) {
          tracker.complete('git', 'initialized')
        }
        else {
          tracker.error('git', 'init failed')
        }
      }
      else {
        tracker.skip('git', 'git not available')
      }
    }
    else {
      tracker.skip('git', '--no-git flag')
    }

    tracker.complete('final', 'project ready')
  }
  catch (error) {
    tracker.error('final', error instanceof Error ? error.message : 'Unknown error')
    liveDisplay.stop()
    consoleUtils.panel(`Initialization failed: ${error}`, 'Failure', 'red')

    if (options.debug) {
      const systemInfo = PlatformUtils.getSystemInfo()
      const infoLines = Object.entries(systemInfo).map(([key, value]) =>
        `${key.padEnd(15)} → ${pc.gray(value)}`,
      )
      consoleUtils.panel(infoLines.join('\n'), 'Debug Environment', 'cyan')
    }

    // Clean up on failure
    if (!options.here && await FileSystemUtils.exists(projectPath)) {
      await FileSystemUtils.remove(projectPath)
    }
    process.exit(1)
  }
  finally {
    liveDisplay.stop()
  }

  // Show final success message
  consoleUtils.log('')
  consoleUtils.success(pc.bold('Project ready.'))

  // Show next steps
  const steps: string[] = []
  let stepNum = 1

  if (!options.here) {
    steps.push(`${stepNum}. ${pc.bold(pc.green(`cd ${options.projectName}`))}`)
    stepNum++
  }
  else {
    steps.push(`${stepNum}. You're already in the project directory!`)
    stepNum++
  }

  if (selectedAI === 'claude') {
    steps.push(`${stepNum}. Open in Visual Studio Code and start using / commands with Claude Code`)
    steps.push('   - Type / in any file to see available commands')
    steps.push('   - Use /specify to create specifications')
    steps.push('   - Use /plan to create implementation plans')
    steps.push('   - Use /tasks to generate tasks')
  }
  else if (selectedAI === 'gemini') {
    steps.push(`${stepNum}. Use / commands with Gemini CLI`)
    steps.push('   - Run gemini /specify to create specifications')
    steps.push('   - Run gemini /plan to create implementation plans')
    steps.push('   - Run gemini /tasks to generate tasks')
    steps.push('   - See GEMINI.md for all available commands')
  }
  else if (selectedAI === 'copilot') {
    steps.push(`${stepNum}. Open in Visual Studio Code and use ${pc.bold(pc.cyan('/specify'))}, ${pc.bold(pc.cyan('/plan'))}, ${pc.bold(pc.cyan('/tasks'))} commands with GitHub Copilot`)
  }

  stepNum++
  steps.push(`${stepNum}. Update ${pc.bold(pc.magenta('CONSTITUTION.md'))} with your project's non-negotiable principles`)

  consoleUtils.panel(steps.join('\n'), 'Next steps', 'cyan')
}

async function downloadAndExtractTemplate(
  projectPath: string,
  aiAssistant: string,
  scriptType: string,
  isCurrentDir: boolean,
  tracker: StepTracker,
  options: InitOptions,
): Promise<void> {
  const repoOwner = 'github'
  const repoName = 'spec-kit'

  // Fetch latest release
  tracker.start('fetch', 'contacting GitHub API')

  let release
  try {
    release = await NetworkUtils.getLatestGitHubRelease(repoOwner, repoName, {
      skipTLS: options.skipTLS,
      timeout: 30000,
    })
    tracker.complete('fetch', `release ${release.tag_name}`)
  }
  catch (error) {
    tracker.error('fetch', error instanceof Error ? error.message : 'Failed')
    throw error
  }

  // Find template asset
  const pattern = `spec-kit-template-${aiAssistant}-${scriptType}`
  const asset = NetworkUtils.findReleaseAsset(release, pattern)

  if (!asset) {
    tracker.error('fetch', `No template found for ${pattern}`)
    throw new Error(`No matching release asset found for pattern: ${pattern}`)
  }

  const metadata: TemplateMetadata = {
    filename: asset.name,
    size: asset.size,
    release: release.tag_name,
    assetUrl: asset.browser_download_url,
  }

  tracker.add('download', 'Download template')
  tracker.start('download', `${metadata.filename}`)

  // Download the file
  const tempZipPath = path.join(
    isCurrentDir ? projectPath : path.dirname(projectPath),
    `.${asset.name}_${Date.now()}`,
  )

  try {
    let downloadProgress = 0
    await NetworkUtils.downloadFile(asset.browser_download_url, tempZipPath, {
      skipTLS: options.skipTLS,
      timeout: 60000,
      onProgress: (downloaded, total) => {
        const percent = Math.round((downloaded / total) * 100)
        if (percent !== downloadProgress) {
          downloadProgress = percent
          tracker.start('download', `${metadata.filename} (${percent}%)`)
        }
      },
    })
    tracker.complete('download', `${metadata.filename} (${(metadata.size / 1024 / 1024).toFixed(1)} MB)`)
  }
  catch (error) {
    tracker.error('download', error instanceof Error ? error.message : 'Failed')
    throw error
  }

  // Extract template
  tracker.start('extract', 'extracting files')
  try {
    if (!isCurrentDir) {
      // Create project directory
      await FileSystemUtils.createDirectory(projectPath)
    }

    await ArchiveUtils.extract(tempZipPath, projectPath, {
      flattenSingleRoot: true,
      mergeWithExisting: isCurrentDir,
      verbose: options.debug,
    })

    tracker.complete('extract', 'complete')
  }
  catch (error) {
    tracker.error('extract', error instanceof Error ? error.message : 'Failed')
    // Clean up on failure
    if (!isCurrentDir && await FileSystemUtils.exists(projectPath)) {
      await FileSystemUtils.remove(projectPath)
    }
    throw error
  }
  finally {
    // Cleanup ZIP file
    tracker.start('cleanup', 'removing temporary files')
    try {
      await FileSystemUtils.remove(tempZipPath)
      tracker.complete('cleanup', 'done')
    }
    catch {
      tracker.error('cleanup', 'failed')
    }
  }
}
