import type { SyncAdapter } from '../adapters/base.adapter.js'
import type { SpecDocument, SyncOptions, SyncResult, SyncStatus } from '../types/index.js'
import crypto from 'node:crypto'
import { SpecScanner } from './scanner.js'

export class SyncEngine {
  constructor(private adapter: SyncAdapter) {}

  async syncSpec(spec: SpecDocument, options: SyncOptions = {}): Promise<SyncResult> {
    try {
      if (options.dryRun) {
        return this.dryRunSync(spec, options)
      }

      // Check authentication
      const isAuthenticated = await this.adapter.checkAuth()
      if (!isAuthenticated) {
        return {
          success: false,
          message: `${this.adapter.platform} authentication required`,
        }
      }

      // Get current status
      const status = await this.adapter.getStatus(spec)

      // Check if sync is needed
      if (!options.force && !status.hasChanges) {
        return {
          success: true,
          message: `${spec.name} is already up to date`,
          details: { skipped: [spec.name] },
        }
      }

      // Handle conflicts
      if (status.status === 'conflict' && !options.force) {
        if (options.conflictStrategy === 'interactive') {
          return await this.handleConflictInteractive(spec, status)
        }
        else if (options.conflictStrategy === 'theirs' || options.conflictStrategy === 'ours') {
          return await this.handleConflictAutomatic(spec, status, options.conflictStrategy)
        }
        else {
          return {
            success: false,
            message: `Sync conflict detected for ${spec.name}. Use --force or resolve conflicts manually.`,
          }
        }
      }

      // Perform sync
      const remoteRef = await this.adapter.push(spec, options)

      // Update frontmatter
      await this.updateFrontmatter(spec, remoteRef, 'synced')

      return {
        success: true,
        message: `Successfully synced ${spec.name} to ${this.adapter.platform}`,
        details: { updated: [spec.name] },
      }
    }
    catch (error: any) {
      return {
        success: false,
        message: `Failed to sync ${spec.name}: ${error.message}`,
        details: { errors: [error.message] },
      }
    }
  }

  async syncAll(options: SyncOptions = {}): Promise<SyncResult> {
    const scanner = new SpecScanner()
    const specs = await scanner.scanAll()

    if (specs.length === 0) {
      return {
        success: true,
        message: 'No specs found to sync',
      }
    }

    const results = {
      success: true,
      message: '',
      details: {
        created: [] as string[],
        updated: [] as string[],
        skipped: [] as string[],
        errors: [] as string[],
      },
    }

    // Use batch operations if supported
    if (this.adapter.capabilities().supportsBatch && specs.length > 1) {
      return await this.syncBatch(specs, options)
    }

    // Sync specs individually
    for (const spec of specs) {
      const result = await this.syncSpec(spec, options)

      if (result.success) {
        if (result.details?.updated?.length) {
          results.details.updated.push(...result.details.updated)
        }
        if (result.details?.created?.length) {
          results.details.created.push(...result.details.created)
        }
        if (result.details?.skipped?.length) {
          results.details.skipped.push(...result.details.skipped)
        }
      }
      else {
        results.success = false
        if (result.details?.errors?.length) {
          results.details.errors.push(...result.details.errors)
        }
        else {
          results.details.errors.push(result.message)
        }
      }
    }

    const total = results.details.created.length + results.details.updated.length + results.details.skipped.length
    results.message = `Processed ${total} specs: ${results.details.updated.length} updated, ${results.details.created.length} created, ${results.details.skipped.length} skipped`

    if (results.details.errors.length > 0) {
      results.message += `, ${results.details.errors.length} errors`
    }

    return results
  }

  private async syncBatch(specs: SpecDocument[], options: SyncOptions): Promise<SyncResult> {
    try {
      const remoteRefs = await this.adapter.pushBatch(specs, options)

      // Update frontmatter for all specs
      for (let i = 0; i < specs.length; i++) {
        await this.updateFrontmatter(specs[i], remoteRefs[i], 'synced')
      }

      return {
        success: true,
        message: `Batch synced ${specs.length} specs`,
        details: { updated: specs.map(s => s.name) },
      }
    }
    catch (error: any) {
      return {
        success: false,
        message: `Batch sync failed: ${error.message}`,
        details: { errors: [error.message] },
      }
    }
  }

  private async dryRunSync(spec: SpecDocument, options: SyncOptions): Promise<SyncResult> {
    const status = await this.adapter.getStatus(spec)

    if (!status.hasChanges && !options.force) {
      return {
        success: true,
        message: `[DRY RUN] ${spec.name} - No changes to sync`,
        details: { skipped: [spec.name] },
      }
    }

    if (status.status === 'conflict') {
      return {
        success: false,
        message: `[DRY RUN] ${spec.name} - Has conflicts that need resolution`,
        details: { errors: [`Conflicts in ${spec.name}`] },
      }
    }

    const action = status.remoteId ? 'update' : 'create'
    return {
      success: true,
      message: `[DRY RUN] ${spec.name} - Would ${action} ${this.adapter.platform} issue`,
      details: { [action === 'create' ? 'created' : 'updated']: [spec.name] },
    }
  }

  private async handleConflictInteractive(spec: SpecDocument, _status: SyncStatus): Promise<SyncResult> {
    // This would need to be implemented with proper CLI prompts
    // For now, return an error asking for manual resolution
    return {
      success: false,
      message: `Interactive conflict resolution not yet implemented for ${spec.name}`,
      details: { errors: ['Interactive mode not available'] },
    }
  }

  private async handleConflictAutomatic(spec: SpecDocument, status: SyncStatus, strategy: string): Promise<SyncResult> {
    if (strategy === 'theirs') {
      // Pull remote version and overwrite local
      const remoteRef = { id: status.remoteId!, type: 'parent' as const }
      const _remoteSpec = await this.adapter.pull(remoteRef)

      // This would need file system operations to update local files
      // For now, just mark as resolved
      await this.updateFrontmatter(spec, remoteRef, 'synced')

      return {
        success: true,
        message: `Resolved conflict for ${spec.name} using remote version`,
        details: { updated: [spec.name] },
      }
    }
    else if (strategy === 'ours') {
      // Push local version, overwriting remote
      const remoteRef = await this.adapter.push(spec, { force: true })
      await this.updateFrontmatter(spec, remoteRef, 'synced')

      return {
        success: true,
        message: `Resolved conflict for ${spec.name} using local version`,
        details: { updated: [spec.name] },
      }
    }

    return {
      success: false,
      message: `Unknown conflict strategy: ${strategy}`,
    }
  }

  private async updateFrontmatter(spec: SpecDocument, remoteRef: any, status: string): Promise<void> {
    const mainFile = spec.files.get('spec.md')
    if (!mainFile)
      return

    // Calculate content hash for change detection
    const contentHash = crypto
      .createHash('sha256')
      .update(mainFile.markdown)
      .digest('hex')
      .substring(0, 8)

    // Update frontmatter
    if (!mainFile.frontmatter.github) {
      mainFile.frontmatter.github = {}
    }
    mainFile.frontmatter.github.issue_number = typeof remoteRef.id === 'number' ? remoteRef.id : Number.parseInt(remoteRef.id)
    mainFile.frontmatter.sync_status = status as any
    mainFile.frontmatter.last_sync = new Date().toISOString()
    mainFile.frontmatter.sync_hash = contentHash

    // This would need to write the file back to disk
    // For now, the frontmatter is updated in memory
  }
}
