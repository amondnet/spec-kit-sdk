import { SyncAdapter, type RemoteRef, type AdapterCapabilities } from '../../src/adapters/base.adapter.js'
import type { SpecDocument, SyncStatus, SyncOptions } from '../../src/types/index.js'

export class MockSyncAdapter extends SyncAdapter {
  readonly platform = 'github' as const

  // Mock state for testing
  private mockAuthenticated = true
  private mockSpecs = new Map<string, any>()
  private mockConflicts = new Set<string>()
  private mockChanges = new Set<string>()
  private mockShouldThrowError = false
  private mockErrorMessage = ''

  setAuthenticated(authenticated: boolean): void {
    this.mockAuthenticated = authenticated
  }

  setHasChanges(specName: string, hasChanges: boolean): void {
    if (hasChanges) {
      this.mockChanges.add(specName)
    } else {
      this.mockChanges.delete(specName)
    }
  }

  setConflict(specName: string, hasConflict: boolean): void {
    if (hasConflict) {
      this.mockConflicts.add(specName)
    } else {
      this.mockConflicts.delete(specName)
    }
  }

  setRemoteSpec(specName: string, remoteData: any): void {
    this.mockSpecs.set(specName, remoteData)
  }

  setShouldThrowError(shouldThrow: boolean, errorMessage?: string): void {
    this.mockShouldThrowError = shouldThrow
    this.mockErrorMessage = errorMessage || ''
  }

  async authenticate(): Promise<boolean> {
    return this.mockAuthenticated
  }

  async checkAuth(): Promise<boolean> {
    return this.mockAuthenticated
  }

  async getStatus(spec: SpecDocument): Promise<SyncStatus> {
    const hasChanges = this.mockChanges.has(spec.name)
    const hasConflict = this.mockConflicts.has(spec.name)
    const remoteData = this.mockSpecs.get(spec.name)

    return {
      status: hasConflict ? 'conflict' : remoteData ? 'synced' : 'draft',
      lastSync: remoteData?.lastSync ? new Date(remoteData.lastSync) : undefined,
      hasChanges,
      remoteId: remoteData?.id,
      conflicts: hasConflict ? ['content mismatch'] : undefined,
    }
  }

  async push(spec: SpecDocument, options: SyncOptions = {}): Promise<RemoteRef> {
    // Check if this is a call that should throw an error
    if (this.mockShouldThrowError) {
      throw new Error(this.mockErrorMessage || 'Mock error')
    }

    const specFile = spec.files.get('spec.md')
    if (!specFile) {
      throw new Error('No spec.md file found')
    }

    const remoteId = this.mockSpecs.get(spec.name)?.id || Math.floor(Math.random() * 1000)

    this.mockSpecs.set(spec.name, {
      id: remoteId,
      title: specFile.markdown.split('\n').find(line => line.startsWith('# '))?.slice(2) || 'Untitled',
      lastSync: new Date().toISOString(),
    })

    this.mockChanges.delete(spec.name)
    this.mockConflicts.delete(spec.name)

    return {
      id: remoteId,
      type: 'parent'
    }
  }

  override async pushBatch(specs: SpecDocument[], options: SyncOptions = {}): Promise<RemoteRef[]> {
    const refs: RemoteRef[] = []

    for (const spec of specs) {
      refs.push(await this.push(spec, options))
    }

    return refs
  }

  async pull(remoteRef: RemoteRef): Promise<SpecDocument> {
    if (this.mockShouldThrowError) {
      throw new Error(this.mockErrorMessage || 'Mock pull error')
    }

    const mockData = Array.from(this.mockSpecs.values()).find(data => data.id === remoteRef.id)

    if (!mockData) {
      throw new Error(`Remote spec with ID ${remoteRef.id} not found`)
    }

    return {
      path: `/mock/${mockData.title}`,
      name: mockData.title.toLowerCase().replace(/\s+/g, '-'),
      files: new Map([
        ['spec.md', {
          path: `/mock/${mockData.title}/spec.md`,
          filename: 'spec.md',
          content: `# ${mockData.title}\n\nMocked content from remote.`,
          frontmatter: {
            spec_id: '99999999-9999-9999-9999-999999999999',
            last_sync: mockData.lastSync,
            sync_status: 'synced' as const,
          },
          markdown: `# ${mockData.title}\n\nMocked content from remote.`,
        }]
      ])
    }
  }

  async resolveConflict(local: SpecDocument, remote: SpecDocument, strategy?: string): Promise<SpecDocument> {
    if (strategy === 'theirs') {
      return remote
    }
    return local
  }

  capabilities(): AdapterCapabilities {
    return {
      supportsBatch: true,
      supportsSubtasks: true,
      supportsLabels: true,
      supportsAssignees: true,
      supportsMilestones: false,
      supportsComments: false,
      supportsConflictResolution: true,
    }
  }

  // Helper methods for testing
  reset(): void {
    this.mockAuthenticated = true
    this.mockSpecs.clear()
    this.mockConflicts.clear()
    this.mockChanges.clear()
    this.mockShouldThrowError = false
    this.mockErrorMessage = ''
  }

  getAllSpecs(): Map<string, any> {
    return new Map(this.mockSpecs)
  }
}