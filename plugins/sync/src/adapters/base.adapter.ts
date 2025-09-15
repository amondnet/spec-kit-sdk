import type { SpecDocument, SyncOptions, SyncStatus } from '../types/index.js'

export interface RemoteRef {
  id: string | number
  url?: string
  type: 'parent' | 'subtask'
}

export interface AdapterCapabilities {
  supportsBatch: boolean
  supportsSubtasks: boolean
  supportsLabels: boolean
  supportsAssignees: boolean
  supportsMilestones: boolean
  supportsComments: boolean
  supportsConflictResolution: boolean
}

export abstract class SyncAdapter {
  abstract readonly platform: 'github' | 'jira' | 'asana' | 'linear' | 'notion'

  // Authentication
  abstract authenticate(): Promise<boolean>
  abstract checkAuth(): Promise<boolean>

  // Core operations
  abstract push(spec: SpecDocument, options?: SyncOptions): Promise<RemoteRef>
  abstract pull(ref: RemoteRef, options?: SyncOptions): Promise<SpecDocument>

  // Batch operations (optional, fallback to individual operations)
  async pushBatch(specs: SpecDocument[], options?: SyncOptions): Promise<RemoteRef[]> {
    const results: RemoteRef[] = []
    for (const spec of specs) {
      results.push(await this.push(spec, options))
    }
    return results
  }

  async pullBatch(refs: RemoteRef[], options?: SyncOptions): Promise<SpecDocument[]> {
    const results: SpecDocument[] = []
    for (const ref of refs) {
      results.push(await this.pull(ref, options))
    }
    return results
  }

  // Status and metadata
  abstract getStatus(spec: SpecDocument): Promise<SyncStatus>
  abstract resolveConflict(local: SpecDocument, remote: SpecDocument, strategy?: string): Promise<SpecDocument>

  // Platform capabilities
  abstract capabilities(): AdapterCapabilities

  // Subtask management (if supported)
  async createSubtask?(_parent: RemoteRef, _title: string, _body: string): Promise<RemoteRef> {
    throw new Error('Subtasks not supported by this adapter')
  }

  async getSubtasks?(_parent: RemoteRef): Promise<RemoteRef[]> {
    return []
  }

  // Comment management (if supported)
  async addComment?(_ref: RemoteRef, _body: string): Promise<void> {
    throw new Error('Comments not supported by this adapter')
  }

  // State management (if supported)
  async close?(_ref: RemoteRef): Promise<void> {
    throw new Error('State management not supported by this adapter')
  }

  async reopen?(_ref: RemoteRef): Promise<void> {
    throw new Error('State management not supported by this adapter')
  }
}
