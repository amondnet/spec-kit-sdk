import type { SpecDocument, SyncOptions, SyncStatus } from '../../types/index.js'
import type { AdapterCapabilities, RemoteRef } from '../base.adapter.js'
import crypto from 'node:crypto'
import { SyncAdapter } from '../base.adapter.js'
import { GitHubClient } from './api.js'
import { SpecToIssueMapper } from './mapper.js'
import { embedUuidInIssueBody, extractUuidFromIssueBody } from './uuid-utils.js'

export class GitHubAdapter extends SyncAdapter {
  readonly platform = 'github' as const
  private client: GitHubClient
  private mapper: SpecToIssueMapper

  constructor(private config: { owner: string, repo: string, auth?: string, labels?: any, assignees?: string | string[], assignee?: string | string[] }) {
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

    const uuid = mainFile.frontmatter.spec_id
    const issueNumber = mainFile.frontmatter.github?.issue_number

    // Priority 1: UUID search (if UUID exists)
    let existingIssue = null
    if (uuid) {
      existingIssue = await this.client.searchIssueByUuid(uuid)
    }

    // Priority 2: Issue number fallback (if UUID search didn't find anything)
    if (!existingIssue && issueNumber) {
      existingIssue = await this.client.getIssue(issueNumber)

      // Validate UUID consistency if both exist (unless force mode)
      if (existingIssue && uuid && !options?.force) {
        const remoteUuid = extractUuidFromIssueBody(existingIssue.body)
        if (remoteUuid && remoteUuid !== uuid) {
          throw new Error(`UUID mismatch: local spec_id=${uuid}, remote spec_id=${remoteUuid}. `
            + `Use --force to override, or update the local spec_id to match the remote.`)
        }
      }
    }

    if (existingIssue) {
      // Update existing issue
      const title = this.mapper.generateTitle(spec.name, 'spec')
      const baseBody = this.mapper.generateBody(mainFile.markdown, spec)
      const body = uuid ? embedUuidInIssueBody(baseBody, uuid) : baseBody

      await this.client.updateIssue(existingIssue.number, { title, body })

      return {
        id: existingIssue.number,
        type: 'parent',
        url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${existingIssue.number}`,
      }
    }
    else {
      // Create new issue
      const title = this.mapper.generateTitle(spec.name, 'spec')
      const baseBody = this.mapper.generateBody(mainFile.markdown, spec)
      const body = uuid ? embedUuidInIssueBody(baseBody, uuid) : baseBody
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

    const uuid = mainFile.frontmatter.spec_id
    const issueNumber = mainFile.frontmatter.github?.issue_number

    // Find existing issue using UUID-first matching
    let issue = null
    let remoteId: string | number | undefined

    // Priority 1: UUID search
    if (uuid) {
      issue = await this.client.searchIssueByUuid(uuid)
      if (issue) {
        remoteId = issue.number
      }
    }

    // Priority 2: Issue number fallback
    if (!issue && issueNumber) {
      issue = await this.client.getIssue(issueNumber)
      if (issue) {
        remoteId = issue.number

        // Check for UUID mismatch
        if (uuid) {
          const remoteUuid = extractUuidFromIssueBody(issue.body)
          if (remoteUuid && remoteUuid !== uuid) {
            return {
              status: 'conflict',
              hasChanges: true,
              remoteId,
              conflicts: [`UUID mismatch: local=${uuid}, remote=${remoteUuid}`],
            }
          }
        }
      }
    }

    if (!issue) {
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

    // Simple conflict detection based on modification dates
    const lastSync = mainFile.frontmatter.last_sync ? new Date(mainFile.frontmatter.last_sync) : null
    const hasRemoteChanges = !lastSync // GitHub API doesn't provide updated_at easily

    if (hasLocalChanges && hasRemoteChanges) {
      return {
        status: 'conflict',
        hasChanges: true,
        remoteId,
        lastSync,
        conflicts: ['Both local and remote have changes'],
      }
    }

    if (hasLocalChanges) {
      return {
        status: 'draft',
        hasChanges: true,
        remoteId,
        lastSync,
      }
    }

    return {
      status: 'synced',
      hasChanges: false,
      remoteId,
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
    // Separate new issues from updates using UUID-first matching logic
    const specsWithExistingIssues: SpecDocument[] = []
    const specsToCreate: SpecDocument[] = []

    // Check each spec to determine if it has an existing issue
    for (const spec of specs) {
      const mainFile = spec.files.get('spec.md')
      if (!mainFile)
        continue

      const uuid = mainFile.frontmatter.spec_id
      const issueNumber = mainFile.frontmatter.github?.issue_number

      let hasExistingIssue = false

      // Priority 1: UUID search
      if (uuid) {
        const existingIssue = await this.client.searchIssueByUuid(uuid)
        if (existingIssue) {
          hasExistingIssue = true
        }
      }

      // Priority 2: Issue number fallback
      if (!hasExistingIssue && issueNumber) {
        const existingIssue = await this.client.getIssue(issueNumber)
        if (existingIssue) {
          hasExistingIssue = true
        }
      }

      if (hasExistingIssue) {
        specsWithExistingIssues.push(spec)
      }
      else {
        specsToCreate.push(spec)
      }
    }

    const toCreate = specsToCreate
    const toUpdate = specsWithExistingIssues

    const results: RemoteRef[] = []

    // Handle batch updates for existing issues
    if (toUpdate.length > 0) {
      const issueNumbers = toUpdate
        .map(spec => spec.files.get('spec.md')?.frontmatter.github?.issue_number)
        .filter((num): num is number => num !== undefined)

      // Batch update common fields like labels and assignees
      const labels = this.getLabels('spec')
      const assignees = this.getAssignees() // Get common assignees from config

      // Only perform batch update if there are common fields to update
      if (labels.length > 0 || assignees.length > 0) {
        await this.client.batchUpdateIssues(issueNumbers, { labels, assignees })
      }

      // Individual updates for content changes (title/body)
      for (const spec of toUpdate) {
        const mainFile = spec.files.get('spec.md')
        if (!mainFile)
          continue

        const uuid = mainFile.frontmatter.spec_id
        const issueNumber = mainFile.frontmatter.github?.issue_number

        // Find the actual issue using UUID-first matching
        let existingIssue = null
        if (uuid) {
          existingIssue = await this.client.searchIssueByUuid(uuid)
        }
        if (!existingIssue && issueNumber) {
          existingIssue = await this.client.getIssue(issueNumber)
        }

        if (existingIssue) {
          const title = this.mapper.generateTitle(spec.name, 'spec')
          const baseBody = this.mapper.generateBody(mainFile.markdown, spec)
          const body = uuid ? embedUuidInIssueBody(baseBody, uuid) : baseBody
          await this.client.updateIssue(existingIssue.number, { title, body })

          results.push({
            id: existingIssue.number,
            type: 'parent',
            url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${existingIssue.number}`,
          })
        }
      }
    }

    // Handle new issue creation with controlled concurrency
    if (toCreate.length > 0) {
      // Get labels once (they're the same for all specs)
      const labels = this.getLabels('spec')

      // Ensure all labels exist once before creating any issues
      if (labels.length > 0) {
        await this.client.ensureLabelsExist(labels)
      }

      // Import p-limit dynamically to avoid linting issues
      const pLimit = (await import('p-limit')).default
      const limit = pLimit(5) // Limit concurrent operations to prevent rate limiting

      const createPromises = toCreate.map(spec =>
        limit(async () => {
          const mainFile = spec.files.get('spec.md')
          if (!mainFile) {
            throw new Error(`No spec.md file found in ${spec.name}`)
          }

          const uuid = mainFile.frontmatter.spec_id
          const title = this.mapper.generateTitle(spec.name, 'spec')
          const baseBody = this.mapper.generateBody(mainFile.markdown, spec)
          const body = uuid ? embedUuidInIssueBody(baseBody, uuid) : baseBody
          const labels = this.getLabels('spec')

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

  private getLabels(fileType: string): string[] {
    const labelConfig = this.config.labels || {}
    const commonLabels = this.normalizeLabels(labelConfig.common)
    const typeLabels = this.normalizeLabels(labelConfig[fileType] || fileType)

    return [...commonLabels, ...typeLabels]
  }

  private getAssignees(): string[] {
    // Get common assignees from config if specified
    const assigneeConfig = this.config.assignees || this.config.assignee
    return this.normalizeLabels(assigneeConfig)
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
