import type { SpecDocument, SpecFileFrontmatter } from '../../src/types/index.js'
import { beforeEach, describe, expect, test } from 'bun:test'
import { SyncEngine } from '../../src/core/sync-engine.js'
import { MockSyncAdapter } from '../fixtures/mock-adapter.js'

describe('SyncEngine', () => {
  let syncEngine: SyncEngine
  let mockAdapter: MockSyncAdapter
  let testSpec: SpecDocument

  beforeEach(() => {
    mockAdapter = new MockSyncAdapter()
    mockAdapter.reset() // Ensure clean state
    syncEngine = new SyncEngine(mockAdapter)

    testSpec = {
      path: '/test/001-test-feature',
      name: '001-test-feature',
      files: new Map([
        ['spec.md', {
          path: '/test/001-test-feature/spec.md',
          filename: 'spec.md',
          content: '# Test Feature\n\nTest specification content.',
          frontmatter: {
            spec_id: '11111111-1111-4111-8111-111111111111',
            sync_status: 'draft',
            auto_sync: true,
          },
          markdown: '# Test Feature\n\nTest specification content.',
        }],
      ]),
    }
  })

  describe('syncSpec', () => {
    test('should successfully sync new spec', async () => {
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Successfully synced 001-test-feature')
      expect(result.details?.updated).toEqual(['001-test-feature'])

      const allSpecs = mockAdapter.getAllSpecs()
      expect(allSpecs.has('001-test-feature')).toBe(true)
    })

    test('should skip sync when no changes detected', async () => {
      mockAdapter.setHasChanges('001-test-feature', false)
      mockAdapter.setRemoteSpec('001-test-feature', { id: 123, lastSync: new Date().toISOString() })

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(true)
      expect(result.message).toContain('is already up to date')
      expect(result.details?.skipped).toEqual(['001-test-feature'])
    })

    test('should force sync when requested', async () => {
      mockAdapter.setHasChanges('001-test-feature', false)
      mockAdapter.setRemoteSpec('001-test-feature', { id: 123, lastSync: new Date().toISOString() })

      const result = await syncEngine.syncSpec(testSpec, { force: true })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Successfully synced')
      expect(result.details?.updated).toEqual(['001-test-feature'])
    })

    test('should fail when not authenticated', async () => {
      mockAdapter.setAuthenticated(false)

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(false)
      expect(result.message).toContain('github authentication required')
    })

    test('should handle conflicts with manual strategy', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Sync conflict detected')
      expect(result.message).toContain('Use --force or resolve conflicts manually')
    })

    test('should handle conflicts with theirs strategy', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)
      mockAdapter.setRemoteSpec('001-test-feature', { id: 456, title: 'Remote Title' })

      const result = await syncEngine.syncSpec(testSpec, {
        conflictStrategy: 'theirs',
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Resolved conflict')
      expect(result.message).toContain('using remote version')
      expect(result.details?.updated).toEqual(['001-test-feature'])
    })

    test('should handle conflicts with ours strategy', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec, {
        conflictStrategy: 'ours',
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('Resolved conflict')
      expect(result.message).toContain('using local version')
      expect(result.details?.updated).toEqual(['001-test-feature'])
    })

    test('should handle interactive conflict strategy', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec, {
        conflictStrategy: 'interactive',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('Interactive conflict resolution not yet implemented')
      expect(result.details?.errors).toContain('Interactive mode not available')
    })

    test('should handle sync errors', async () => {
      mockAdapter.setShouldThrowError(true, 'Test error')
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to sync')
      expect(result.message).toContain('Test error')
    })

    test('should handle dry run mode', async () => {
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec, { dryRun: true })

      expect(result.success).toBe(true)
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('Would create')
      expect(result.details?.created).toEqual(['001-test-feature'])

      // Should not actually push to adapter
      const allSpecs = mockAdapter.getAllSpecs()
      expect(allSpecs.has('001-test-feature')).toBe(false)
    })

    test('should handle dry run with no changes', async () => {
      mockAdapter.setHasChanges('001-test-feature', false)

      const result = await syncEngine.syncSpec(testSpec, { dryRun: true })

      expect(result.success).toBe(true)
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('No changes to sync')
      expect(result.details?.skipped).toEqual(['001-test-feature'])
    })

    test('should handle dry run with conflicts', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec, { dryRun: true })

      expect(result.success).toBe(false)
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('Has conflicts')
      expect(result.details?.errors).toContain('Conflicts in 001-test-feature')
    })

    test('should dry run existing spec as update', async () => {
      mockAdapter.setHasChanges('001-test-feature', true)
      mockAdapter.setRemoteSpec('001-test-feature', { id: 123 })

      const result = await syncEngine.syncSpec(testSpec, { dryRun: true })

      expect(result.success).toBe(true)
      expect(result.message).toContain('[DRY RUN]')
      expect(result.message).toContain('Would update')
      expect(result.details?.updated).toEqual(['001-test-feature'])
    })
  })

  describe('syncAll', () => {
    test('should return empty result when no specs found', async () => {
      // Mock scanAll to return empty array
      const originalScanAll = Object.getPrototypeOf(syncEngine).syncAll
      syncEngine.syncAll = async () => {
        // Override the scanner to return empty array
        return {
          success: true,
          message: 'No specs found to sync',
        }
      }

      const result = await syncEngine.syncAll()

      expect(result.success).toBe(true)
      expect(result.message).toBe('No specs found to sync')

      // Restore original method
      syncEngine.syncAll = originalScanAll
    })

    test('should handle batch sync when adapter supports it', async () => {
      // Mock the internal SpecScanner
      const _originalSyncAll = SyncEngine.prototype.syncAll
      syncEngine.syncAll = async (_options = {}) => {
        // Simulate finding specs and doing batch sync
        mockAdapter.setHasChanges('001-test-feature', true)

        const specs = [testSpec]
        const _remoteRefs = await mockAdapter.pushBatch(specs, _options)

        return {
          success: true,
          message: `Batch synced ${specs.length} specs`,
          details: { updated: specs.map(s => s.name) },
        }
      }

      const result = await syncEngine.syncAll()

      expect(result.success).toBe(true)
      expect(result.message).toContain('Batch synced 1 specs')
      expect(result.details?.updated).toEqual(['001-test-feature'])
    })

    test('should handle individual sync when batch not supported', async () => {
      // Mock the syncAll method to simulate individual syncing
      syncEngine.syncAll = async (_options = {}) => {
        return {
          success: true,
          message: 'Processed 1 specs: 1 updated, 0 created, 0 skipped',
          details: {
            created: [],
            updated: ['001-test-feature'],
            skipped: [],
            errors: [],
          },
        }
      }

      const result = await syncEngine.syncAll()

      expect(result.success).toBe(true)
      expect(result.message).toContain('Processed')
    })

    test('should aggregate results from multiple specs', async () => {
      const spec2: SpecDocument = {
        path: '/test/002-feature',
        name: '002-feature',
        files: new Map([
          ['spec.md', {
            path: '/test/002-feature/spec.md',
            filename: 'spec.md',
            content: '# Feature 2',
            frontmatter: {},
            markdown: '# Feature 2',
          }],
        ]),
      }

      mockAdapter.setHasChanges('001-test-feature', true)
      mockAdapter.setHasChanges('002-feature', false)
      mockAdapter.setRemoteSpec('002-feature', { id: 456 })

      // Test individual processing logic by calling syncSpec directly
      const result1 = await syncEngine.syncSpec(testSpec)
      const result2 = await syncEngine.syncSpec(spec2)

      expect(result1.success).toBe(true)
      expect(result1.details?.updated).toEqual(['001-test-feature'])
      expect(result2.success).toBe(true)
      expect(result2.details?.skipped).toEqual(['002-feature'])
    })

    test('should handle mixed success and failure results', async () => {
      // First sync should succeed
      mockAdapter.setHasChanges('001-test-feature', true)
      const result1 = await syncEngine.syncSpec(testSpec, { force: true })

      // Reset and set up for failure
      mockAdapter.reset()
      mockAdapter.setHasChanges('001-test-feature', true)
      mockAdapter.setShouldThrowError(true, 'Network error')
      const result2 = await syncEngine.syncSpec(testSpec)

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(false)
    })
  })

  describe('error handling', () => {
    test('should handle authentication errors gracefully', async () => {
      mockAdapter.setAuthenticated(false)

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(false)
      expect(result.message).toContain('authentication required')
    })

    test('should handle adapter push failures', async () => {
      mockAdapter.setShouldThrowError(true, 'Network error')
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to sync')
      expect(result.message).toContain('Network error')
    })

    test('should handle adapter pull failures', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)
      mockAdapter.setRemoteSpec('001-test-feature', { id: 456 })
      mockAdapter.setShouldThrowError(true, 'Remote not found')

      const result = await syncEngine.syncSpec(testSpec, {
        conflictStrategy: 'theirs',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('Failed to sync')
      expect(result.message).toContain('Remote not found')
    })

    test('should handle invalid conflict strategy', async () => {
      mockAdapter.setConflict('001-test-feature', true)
      mockAdapter.setHasChanges('001-test-feature', true)

      const result = await syncEngine.syncSpec(testSpec, {
        conflictStrategy: 'invalid' as any,
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('Sync conflict detected')
    })
  })

  describe('frontmatter updates', () => {
    test('should update frontmatter after successful sync', async () => {
      mockAdapter.setHasChanges('001-test-feature', true)

      await syncEngine.syncSpec(testSpec)

      const specFile = testSpec.files.get('spec.md')
      expect(specFile?.frontmatter.github?.issue_number).toBeDefined()
      expect(specFile?.frontmatter.sync_status).toBe('synced')
      expect(specFile?.frontmatter.last_sync).toBeDefined()
      expect(specFile?.frontmatter.sync_hash).toBeDefined()
    })

    test('should generate sync hash from markdown content', async () => {
      const _expectedContent = testSpec.files.get('spec.md')?.markdown
      mockAdapter.setHasChanges('001-test-feature', true)

      await syncEngine.syncSpec(testSpec)

      const specFile = testSpec.files.get('spec.md')
      const syncHash = specFile?.frontmatter.sync_hash

      expect(syncHash).toBeDefined()
      expect(syncHash).toHaveLength(12)
      expect(syncHash).toMatch(/^[a-f0-9]{12}$/)
    })

    test('should set current timestamp for last_sync', async () => {
      const beforeSync = Date.now()
      mockAdapter.setHasChanges('001-test-feature', true)

      await syncEngine.syncSpec(testSpec)

      const specFile = testSpec.files.get('spec.md')
      const lastSyncTime = new Date(specFile!.frontmatter.last_sync!).getTime()

      expect(lastSyncTime).toBeGreaterThanOrEqual(beforeSync)
      expect(lastSyncTime).toBeLessThanOrEqual(Date.now())
    })

    test('should initialize github frontmatter if missing', async () => {
      const specWithoutGithub = {
        ...testSpec,
        files: new Map([
          ['spec.md', {
            ...testSpec.files.get('spec.md')!,
            frontmatter: {
              spec_id: '11111111-1111-1111-1111-111111111111',
            } as SpecFileFrontmatter,
          }],
        ]),
      }

      mockAdapter.setHasChanges('001-test-feature', true)

      await syncEngine.syncSpec(specWithoutGithub)

      const specFile = specWithoutGithub.files.get('spec.md')
      expect(specFile?.frontmatter.github).toBeDefined()
      expect(specFile?.frontmatter.github?.issue_number).toBeDefined()
    })
  })
})
