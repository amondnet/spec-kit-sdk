import type { SpecDocument, SyncOptions, SyncStatus } from '../../types/index.js'
import type { AdapterCapabilities, RemoteRef } from '../base.adapter.js'
import crypto from 'node:crypto'
import { SyncAdapter } from '../base.adapter.js'
import { GitHubClient } from './api.js'
import { SpecToIssueMapper } from './mapper.js'

export class GitHubAdapter extends SyncAdapter {
  readonly platform = 'github' as const
  private client: GitHubClient
  private mapper: SpecToIssueMapper

  constructor(private config: { owner: string, repo: string, auth?: string, labels?: any }) {
    super()
    this.client = new GitHubClient(config.owner, config.repo)
    this.mapper = new SpecToIssueMapper()
  }

  async authenticate(): Promise<boolean> {
    return await this.client.checkAuth()
  }

  async checkAuth(): Promise<boolean> {
    return await this.client.checkAuth()
  }

  async push(spec: SpecDocument, options?: SyncOptions): Promise<RemoteRef> {
    const mainFile = spec.files.get('spec.md')
    if (!mainFile) {
      throw new Error(`No spec.md file found in ${spec.name}`)
    }

    const issueNumber = mainFile.frontmatter.github?.issue_number

    if (issueNumber && !options?.force) {
      // Update existing issue
      const title = this.mapper.generateTitle(spec.name, 'spec')
      const body = this.mapper.generateBody(mainFile.markdown, spec)

      await this.client.updateIssue(issueNumber, { title, body })

      return {
        id: issueNumber,
        type: 'parent',
        url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`,
      }
    }
    else {
      // Create new issue
      const title = this.mapper.generateTitle(spec.name, 'spec')
      const body = this.mapper.generateBody(mainFile.markdown, spec)
      const labels = this.getLabels('spec')

      // Ensure labels exist before creating the issue
      await this.client.ensureLabelsExist(labels)

      const newIssueNumber = await this.client.createIssue(title, body, labels)

      // Create subtasks if supported
      if (this.capabilities().supportsSubtasks) {
        await this.createSubtasks(spec, newIssueNumber)
      }

      return {
        id: newIssueNumber,
        type: 'parent',
        url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${newIssueNumber}`,
      }
    }
  }

  async pull(ref: RemoteRef, _?: SyncOptions): Promise<SpecDocument> {
    const issue = await this.client.getIssue(ref.id as number)
    if (!issue) {
      throw new Error(`Issue #${ref.id} not found`)
    }

    return this.mapper.issueToSpec(issue)
  }

  async getStatus(spec: SpecDocument): Promise<SyncStatus> {
    const mainFile = spec.files.get('spec.md')
    if (!mainFile) {
      return {
        status: 'unknown',
        hasChanges: false,
      }
    }

    const issueNumber = mainFile.frontmatter.github?.issue_number
    if (!issueNumber) {
      return {
        status: 'draft',
        hasChanges: true,
      }
    }

    // Calculate current content hash
    const currentHash = crypto
      .createHash('sha256')
      .update(mainFile.markdown)
      .digest('hex')
      .substring(0, 8)

    const storedHash = mainFile.frontmatter.sync_hash
    const hasLocalChanges = currentHash !== storedHash

    // Check if remote has changes
    const issue = await this.client.getIssue(issueNumber)
    if (!issue) {
      return {
        status: 'conflict',
        hasChanges: true,
        remoteId: issueNumber,
        conflicts: ['Remote issue not found'],
      }
    }

    // Simple conflict detection based on modification dates
    const lastSync = mainFile.frontmatter.last_sync ? new Date(mainFile.frontmatter.last_sync) : null
    const hasRemoteChanges = !lastSync // GitHub API doesn't provide updated_at easily

    if (hasLocalChanges && hasRemoteChanges) {
      return {
        status: 'conflict',
        hasChanges: true,
        remoteId: issueNumber,
        lastSync,
        conflicts: ['Both local and remote have changes'],
      }
    }

    if (hasLocalChanges) {
      return {
        status: 'draft',
        hasChanges: true,
        remoteId: issueNumber,
        lastSync,
      }
    }

    return {
      status: 'synced',
      hasChanges: false,
      remoteId: issueNumber,
      lastSync,
    }
  }

  async resolveConflict(local: SpecDocument, remote: SpecDocument, strategy?: string): Promise<SpecDocument> {
    switch (strategy) {
      case 'theirs':
        return remote
      case 'ours':
        return local
      default:
        throw new Error('Manual conflict resolution required')
    }
  }

  override async pushBatch(specs: SpecDocument[], _options?: SyncOptions): Promise<RemoteRef[]> {
    // Separate new issues from updates
    const toCreate = specs.filter(spec => !spec.files.get('spec.md')?.frontmatter.github?.issue_number)
    const toUpdate = specs.filter(spec => spec.files.get('spec.md')?.frontmatter.github?.issue_number)

    const results: RemoteRef[] = []

    // Handle batch updates for existing issues
    if (toUpdate.length > 0) {
      const issueNumbers = toUpdate
        .map(spec => spec.files.get('spec.md')?.frontmatter.github?.issue_number)
        .filter((num): num is number => num !== undefined)

      // Batch update common fields like labels
      const labels = this.getLabels('spec')
      if (labels.length > 0) {
        await this.client.batchUpdateIssues(issueNumbers, { labels })
      }

      // Individual updates for content changes (title/body)
      for (const spec of toUpdate) {
        const mainFile = spec.files.get('spec.md')
        const issueNumber = mainFile?.frontmatter.github?.issue_number
        if (issueNumber && mainFile) {
          const title = this.mapper.generateTitle(spec.name, 'spec')
          const body = this.mapper.generateBody(mainFile.markdown, spec)
          await this.client.updateIssue(issueNumber, { title, body })

          results.push({
            id: issueNumber,
            type: 'parent',
            url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`,
          })
        }
      }
    }

    // Handle new issue creation with controlled concurrency
    if (toCreate.length > 0) {
      // Import p-limit dynamically to avoid linting issues
      const pLimit = (await import('p-limit')).default
      const limit = pLimit(5) // Limit concurrent operations to prevent rate limiting

      const createPromises = toCreate.map(spec =>
        limit(async () => {
          const mainFile = spec.files.get('spec.md')
          if (!mainFile) {
            throw new Error(`No spec.md file found in ${spec.name}`)
          }

          const title = this.mapper.generateTitle(spec.name, 'spec')
          const body = this.mapper.generateBody(mainFile.markdown, spec)
          const labels = this.getLabels('spec')

          // Ensure labels exist before creating the issue
          await this.client.ensureLabelsExist(labels)

          const newIssueNumber = await this.client.createIssue(title, body, labels)

          // Create subtasks if supported
          if (this.capabilities().supportsSubtasks) {
            await this.createSubtasks(spec, newIssueNumber)
          }

          return {
            id: newIssueNumber,
            type: 'parent' as const,
            url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${newIssueNumber}`,
          }
        }),
      )

      const createdRefs = await Promise.all(createPromises)
      results.push(...createdRefs)
    }

    return results
  }

  capabilities(): AdapterCapabilities {
    return {
      supportsBatch: true,
      supportsSubtasks: true,
      supportsLabels: true,
      supportsAssignees: true,
      supportsMilestones: true,
      supportsComments: true,
      supportsConflictResolution: true,
    }
  }

  override async createSubtask(parent: RemoteRef, title: string, body: string, fileType: string = 'task'): Promise<RemoteRef> {
    const labels = this.getLabels(fileType)

    // Ensure labels exist before creating the subtask
    await this.client.ensureLabelsExist(labels)

    const subtaskNumber = await this.client.createSubtask(parent.id as number, title, body, labels)

    return {
      id: subtaskNumber,
      type: 'subtask',
      url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${subtaskNumber}`,
    }
  }

  override async getSubtasks(parent: RemoteRef): Promise<RemoteRef[]> {
    const subtaskNumbers = await this.client.getSubtasks(parent.id as number)

    return subtaskNumbers.map(num => ({
      id: num,
      type: 'subtask' as const,
      url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${num}`,
    }))
  }

  override async addComment(ref: RemoteRef, body: string): Promise<void> {
    await this.client.addComment(ref.id as number, body)
  }

  override async close(ref: RemoteRef): Promise<void> {
    await this.client.closeIssue(ref.id as number)
  }

  override async reopen(ref: RemoteRef): Promise<void> {
    await this.client.reopenIssue(ref.id as number)
  }

  async batchUpdateIssues(
    issueNumbers: number[],
    updates: { labels?: string[], assignees?: string[], milestone?: string },
  ): Promise<void> {
    return this.client.batchUpdateIssues(issueNumbers, updates)
  }

  private getLabels(fileType: string): string[] {
    const labelConfig = this.config.labels || {}
    const commonLabels = this.normalizeLabels(labelConfig.common)
    const typeLabels = this.normalizeLabels(labelConfig[fileType] || fileType)

    return [...commonLabels, ...typeLabels]
  }

  private normalizeLabels(labels?: string | string[]): string[] {
    if (!labels)
      return []
    return Array.isArray(labels) ? labels : [labels]
  }

  private async createSubtasks(spec: SpecDocument, parentIssueNumber: number): Promise<void> {
    const subtaskFiles = [
      'plan.md',
      'research.md',
      'quickstart.md',
      'data-model.md',
      'tasks.md',
    ]

    // Collect all labels that will be needed
    const allLabels = new Set<string>()
    for (const filename of subtaskFiles) {
      const file = spec.files.get(filename)
      if (file) {
        const fileType = filename.replace('.md', '').replace('-', '')
        const labels = this.getLabels(fileType)
        labels.forEach(label => allLabels.add(label))
      }
    }

    // Ensure all labels exist before creating any subtasks
    await this.client.ensureLabelsExist([...allLabels])

    for (const filename of subtaskFiles) {
      const file = spec.files.get(filename)
      if (file) {
        const fileType = filename.replace('.md', '').replace('-', '')
        const title = this.mapper.generateTitle(spec.name, fileType)
        const body = this.mapper.generateBody(file.markdown, spec)
        const labels = this.getLabels(fileType)

        await this.client.createSubtask(parentIssueNumber, title, body, labels)
      }
    }
  }
}
