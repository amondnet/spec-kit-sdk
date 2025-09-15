import type { GitHubIssue } from '../../types'
import { exec } from 'node:child_process'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export class GitHubClient {
  private static readonly MAX_CACHE_SIZE = 1000
  private checkedLabels = new Set<string>()
  private owner?: string
  private repo?: string
  private repoFlag?: string

  constructor(owner?: string, repo?: string) {
    this.owner = owner
    this.repo = repo
    if (owner && repo) {
      this.repoFlag = `--repo ${owner}/${repo}`
    }
  }

  /**
   * Gets the default repository from the current git repo using gh CLI.
   *
   * @returns Promise resolving to owner and repo name
   * @throws Error if unable to detect repository
   */
  private async getDefaultRepository(): Promise<{ owner: string, repo: string }> {
    try {
      const { stdout } = await execAsync('gh repo view --json owner,name')
      const parsed = JSON.parse(stdout.trim())

      // Validate JSON structure to prevent runtime errors
      if (typeof parsed?.owner?.login !== 'string' || typeof parsed?.name !== 'string') {
        throw new TypeError(`Unexpected JSON structure from 'gh repo view'. Expected {owner: {login: string}, name: string}, received: ${stdout.trim()}`)
      }

      return {
        owner: parsed.owner.login,
        repo: parsed.name,
      }
    }
    catch (error: any) {
      throw new Error(`Failed to auto-detect repository: ${error.message}`)
    }
  }

  /**
   * Gets the repository flag for gh CLI commands.
   * Uses configured values if available, otherwise auto-detects.
   *
   * @returns Promise resolving to the --repo flag string
   */
  private async getRepoFlag(): Promise<string> {
    if (this.repoFlag) {
      return this.repoFlag
    }

    // Auto-detect and cache the result
    const detected = await this.getDefaultRepository()
    this.owner = detected.owner
    this.repo = detected.repo
    this.repoFlag = `--repo ${detected.owner}/${detected.repo}`
    return this.repoFlag
  }

  private async execute(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command)
      if (stderr && !stderr.includes('gh issue view')) {
        console.warn('GitHub CLI warning:', stderr)
      }
      return stdout.trim()
    }
    catch (error: any) {
      throw new Error(`GitHub CLI error: ${error.message}`)
    }
  }

  /**
   * Executes a gh CLI command with repository flag.
   * Centralizes command construction to avoid repetition.
   *
   * @param args - Array of command arguments
   * @returns Promise resolving to the command output
   */
  async executeGhCommand(args: string[]): Promise<string> {
    const repoFlag = await this.getRepoFlag()
    const command = `gh ${repoFlag} ${args.map(arg => JSON.stringify(arg)).join(' ')}`
    return this.execute(command)
  }

  /**
   * Creates a new GitHub issue with the specified title, body, and labels.
   *
   * @param title - The title of the issue
   * @param body - The body content of the issue
   * @param labels - Optional array of labels to apply to the issue
   * @returns Promise resolving to the created issue number
   * @throws Error if issue creation fails or issue number cannot be parsed
   */
  async createIssue(
    title: string,
    body: string,
    labels?: string[],
  ): Promise<number> {
    // Write body to temp file to avoid shell escaping issues
    const tempFile = join(tmpdir(), `gh-issue-${Date.now()}.md`)
    try {
      writeFileSync(tempFile, body)

      const args = ['issue', 'create', '--title', title, '--body-file', tempFile]
      if (labels?.length) {
        args.push('--label', labels.join(','))
      }

      const result = await this.executeGhCommand(args)
      // The gh issue create command returns the issue URL, we need to extract the number
      const match = result.match(/\/(\d+)$/)
      if (!match || match.length < 2) {
        throw new Error(`Failed to parse issue number from: ${result}`)
      }
      return Number.parseInt(match[1] as string, 10)
    }
    finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile)
      }
      catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Batch updates multiple GitHub issues with the same changes.
   * Uses GitHub CLI's batch editing capabilities for improved performance.
   *
   * @param issueNumbers - Array of issue numbers to update
   * @param updates - Object containing optional labels, assignees, and milestone to update
   * @param updates.labels - Optional array of labels to add to the issues
   * @param updates.assignees - Optional array of assignees to add to the issues
   * @param updates.milestone - Optional milestone to set for the issues
   * @returns Promise resolving when all updates are complete
   */
  async batchUpdateIssues(
    issueNumbers: number[],
    updates: { labels?: string[], assignees?: string[], milestone?: string },
  ): Promise<void> {
    if (issueNumbers.length === 0) {
      return
    }

    // Build the command with all issue numbers
    const args = ['issue', 'edit', ...issueNumbers.map(String)]

    if (updates.labels?.length) {
      args.push('--add-label', updates.labels.join(','))
    }
    if (updates.assignees?.length) {
      args.push('--add-assignee', updates.assignees.join(','))
    }
    if (updates.milestone) {
      args.push('--milestone', updates.milestone)
    }

    // Only execute if there are actual updates (base args: 'issue' 'edit' + issue numbers)
    if (args.length > 2 + issueNumbers.length) {
      await this.executeGhCommand(args)
    }
  }

  /**
   * Updates an existing GitHub issue with new title, body, or labels.
   *
   * @param number - The issue number to update
   * @param updates - Object containing optional title, body, and labels to update
   * @param updates.title - Optional new title for the issue
   * @param updates.body - Optional new body content for the issue
   * @param updates.labels - Optional array of labels to add to the issue
   * @throws Error if the update operation fails
   */
  async updateIssue(
    number: number,
    updates: { title?: string, body?: string, labels?: string[] },
  ): Promise<void> {
    let tempFile: string | undefined

    try {
      const args = ['issue', 'edit', String(number)]

      if (updates.title) {
        args.push('--title', updates.title)
      }
      if (updates.body) {
        // Write body to temp file to avoid shell escaping issues
        tempFile = join(tmpdir(), `gh-issue-edit-${Date.now()}.md`)
        writeFileSync(tempFile, updates.body)
        args.push('--body-file', tempFile)
      }
      if (updates.labels) {
        args.push('--add-label', updates.labels.join(','))
      }

      if (args.length > 3) {
        await this.executeGhCommand(args)
      }
    }
    finally {
      // Clean up temp file if created
      if (tempFile) {
        try {
          unlinkSync(tempFile)
        }
        catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Retrieves a GitHub issue by its number.
   *
   * @param number - The issue number to retrieve
   * @returns Promise resolving to the issue data, or null if not found
   */
  async getIssue(number: number): Promise<GitHubIssue | null> {
    try {
      const args = ['issue', 'view', String(number), '--json', 'number,title,body,state,labels,assignees,milestone']
      const result = await this.executeGhCommand(args)
      const parsed = JSON.parse(result)

      return {
        number: parsed.number,
        title: parsed.title,
        body: parsed.body,
        state: parsed.state,
        labels: parsed.labels?.map((l: any) => l.name),
        assignees: parsed.assignees?.map((a: any) => a.login),
        milestone: parsed.milestone?.number,
      }
    }
    catch {
      return null
    }
  }

  /**
   * Lists GitHub issues, optionally filtered by labels.
   *
   * @param labels - Optional array of labels to filter issues by
   * @returns Promise resolving to an array of issues
   */
  async listIssues(labels?: string[]): Promise<GitHubIssue[]> {
    const args = ['issue', 'list', '--json', 'number,title,body,state,labels', '--limit', '100']
    if (labels?.length) {
      args.push('--label', labels.join(','))
    }

    const result = await this.executeGhCommand(args)
    const parsed = JSON.parse(result)

    return parsed.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels?.map((l: any) => l.name),
    }))
  }

  /**
   * Creates a subtask issue linked to a parent issue.
   * Requires the gh-sub-issue extension to be installed for linking functionality.
   *
   * @param parentNumber - The parent issue number
   * @param title - The title of the subtask
   * @param body - The body content of the subtask
   * @param labels - Optional array of labels (defaults to ['subtask'])
   * @returns Promise resolving to the created subtask issue number
   */
  async createSubtask(
    parentNumber: number,
    title: string,
    body: string,
    labels?: string[],
  ): Promise<number> {
    // First create the issue
    const subtaskLabels = labels || ['subtask']
    const subtaskNumber = await this.createIssue(title, body, subtaskLabels)

    // Then link it as a subtask using gh-sub-issue extension
    try {
      const args = ['sub-issue', 'add', String(parentNumber), String(subtaskNumber)]
      await this.executeGhCommand(args)
    }
    catch {
      console.warn(`Note: gh-sub-issue extension may not be installed. Subtask created but not linked.`)
    }

    return subtaskNumber
  }

  /**
   * Retrieves all subtask issue numbers for a parent issue.
   * Requires the gh-sub-issue extension to be installed.
   *
   * @param parentNumber - The parent issue number
   * @returns Promise resolving to an array of subtask issue numbers, or empty array if extension not available
   */
  async getSubtasks(parentNumber: number): Promise<number[]> {
    try {
      const args = ['sub-issue', 'list', String(parentNumber), '--json', 'number']
      const result = await this.executeGhCommand(args)
      const parsed = JSON.parse(result)
      return parsed.map((item: any) => item.number)
    }
    catch {
      // If gh-sub-issue is not installed, return empty array
      return []
    }
  }

  /**
   * Adds a comment to an existing GitHub issue.
   *
   * @param issueNumber - The issue number to comment on
   * @param body - The comment body text
   * @throws Error if comment creation fails
   */
  async addComment(issueNumber: number, body: string): Promise<void> {
    // Write body to temp file to avoid shell escaping issues
    const tempFile = join(tmpdir(), `gh-comment-${Date.now()}.md`)
    try {
      writeFileSync(tempFile, body)
      const args = ['issue', 'comment', String(issueNumber), '--body-file', tempFile]
      await this.executeGhCommand(args)
    }
    finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile)
      }
      catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Closes a GitHub issue.
   *
   * @param number - The issue number to close
   * @throws Error if the close operation fails
   */
  async closeIssue(number: number): Promise<void> {
    const args = ['issue', 'close', String(number)]
    await this.executeGhCommand(args)
  }

  /**
   * Reopens a closed GitHub issue.
   *
   * @param number - The issue number to reopen
   * @throws Error if the reopen operation fails
   */
  async reopenIssue(number: number): Promise<void> {
    const args = ['issue', 'reopen', String(number)]
    await this.executeGhCommand(args)
  }

  /**
   * Checks if the user is authenticated with GitHub CLI.
   *
   * @returns Promise resolving to true if authenticated, false otherwise
   */
  async checkAuth(): Promise<boolean> {
    try {
      const command = 'gh auth status'
      await this.execute(command)
      return true
    }
    catch {
      return false
    }
  }

  private getDefaultLabelColors(): Record<string, string> {
    return {
      spec: '0052CC', // blue
      plan: '5319E7', // purple
      research: '006B75', // teal
      task: 'FBCA04', // yellow
      quickstart: '0E8A16', // green
      datamodel: 'D93F0B', // orange
      contracts: 'B60205', // red
      subtask: '7B68EE', // medium slate blue
      common: 'CCCCCC', // gray
    }
  }

  /**
   * Ensures that the specified labels exist in the repository, creating them if necessary.
   * Uses caching to avoid redundant API calls for already-checked labels.
   *
   * @param labels - Array of label names to ensure exist
   */
  async ensureLabelsExist(labels: string[]): Promise<void> {
    // Filter out labels that have already been checked
    const uncheckedLabels = labels.filter(label => !this.checkedLabels.has(label))
    if (uncheckedLabels.length === 0) {
      return
    }

    try {
      // Get existing labels
      const existingLabelsOutput = await this.executeGhCommand(['label', 'list', '--json', 'name'])
      const existingLabels = JSON.parse(existingLabelsOutput).map((label: { name: string }) => label.name)

      // Create case-insensitive set for efficient lookup
      const existingLabelsSet = new Set(existingLabels.map((l: string) => l.toLowerCase()))
      const labelColors = this.getDefaultLabelColors()
      const missingLabels = uncheckedLabels.filter(label => !existingLabelsSet.has(label.toLowerCase()))

      // Create missing labels in parallel for better performance
      await Promise.all(missingLabels.map(async (label) => {
        const color = labelColors[label] || labelColors.common || 'CCCCCC'
        try {
          const args = ['label', 'create', label, '--color', color, '--force']
          await this.executeGhCommand(args)
          console.log(`Created label: ${label}`)
        }
        catch (error: any) {
          // Check if label already exists (non-critical error)
          if (!error.message?.includes('already exists')) {
            console.error(`Failed to create label '${label}':`, error.message)
          }
        }
      }))

      // Mark all unchecked labels as checked
      uncheckedLabels.forEach(label => this.checkedLabels.add(label))

      // Clear cache if it exceeds size limit to prevent unbounded memory growth
      if (this.checkedLabels.size > GitHubClient.MAX_CACHE_SIZE) {
        this.checkedLabels.clear()
        console.warn(`Label cache cleared due to size limit (${GitHubClient.MAX_CACHE_SIZE})`)
      }
    }
    catch (error) {
      console.warn('Failed to ensure labels exist:', error)
      // Don't fail the entire operation if label creation fails
    }
  }
}
