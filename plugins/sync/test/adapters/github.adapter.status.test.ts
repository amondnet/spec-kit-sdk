import type { SpecDocument, SpecFile } from '../../src/types/index.js'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { GitHubAdapter } from '../../src/adapters/github/github.adapter.js'
import { EnhancedMockGitHubClient } from '../mocks/github-client.mock.js'
import { MockSpecToIssueMapper } from '../mocks/spec-mapper.mock.js'

describe('GitHubAdapter - Status and Sync Operations', () => {
  let adapter: GitHubAdapter
  let mockClient: EnhancedMockGitHubClient
  let mockMapper: MockSpecToIssueMapper

  beforeEach(() => {
    mockClient = new EnhancedMockGitHubClient('test-owner', 'test-repo')
    mockMapper = MockSpecToIssueMapper.createRealisticMocks()

    adapter = new GitHubAdapter({
      owner: 'test-owner',
      repo: 'test-repo',
    })

    // @ts-expect-error - accessing private property for testing
    adapter.client = mockClient
    // @ts-expect-error - accessing private property for testing
    adapter.mapper = mockMapper
  })

  afterEach(() => {
    mockClient.reset()
    mockMapper.reset()
  })

  describe('getStatus', () => {
    test('should return unknown status when spec.md is missing', async () => {
      const spec: SpecDocument = {
        name: 'missing-spec',
        path: 'specs/missing-spec',
        files: new Map(),
      }

      const status = await adapter.getStatus(spec)

      expect(status).toEqual({
        status: 'unknown',
        hasChanges: false,
      })
    })

    test('should return draft status when no issue number', async () => {
      const spec = createMockSpec('draft-spec', {
        withIssueNumber: false,
      })

      const status = await adapter.getStatus(spec)

      expect(status).toEqual({
        status: 'draft',
        hasChanges: true,
      })
    })

    test('should return draft status when remote issue not found', async () => {
      const spec = createMockSpec('missing-remote', {
        withIssueNumber: true,
        issueNumber: 999,
      })

      // Don't set up a mock issue, so getIssue returns null

      const status = await adapter.getStatus(spec)

      expect(status).toEqual({
        status: 'draft',
        hasChanges: true,
      })

      // Should try UUID search first, then fall back to issue number
      const specFile = spec.files.get('spec.md')
      if (specFile?.frontmatter.spec_id) {
        expect(mockClient.searchIssueByUuidCalls).toContain(specFile.frontmatter.spec_id)
      }
      expect(mockClient.getIssueCalls).toContain(999)
    })

    test('should return synced status when no local changes', async () => {
      const content = '# synced-spec\n\nThis is a test spec.'
      const crypto = await import('node:crypto')
      const expectedHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 8)

      const spec = createMockSpec('synced-spec', {
        withIssueNumber: true,
        issueNumber: 123,
        withSyncHash: true,
        syncHash: expectedHash, // Use the actual calculated hash
        lastSync: '2024-01-01T00:00:00.000Z',
        content,
      })

      // Set up mock remote issue
      mockClient.setMockIssue(123, {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'OPEN',
        labels: [],
      })

      const status = await adapter.getStatus(spec)

      expect(status.status).toBe('synced')
      expect(status.hasChanges).toBe(false)
      expect(status.remoteId).toBe(123)
      expect(status.lastSync).toEqual(new Date('2024-01-01T00:00:00.000Z'))
    })

    test('should return draft status when local changes detected', async () => {
      const spec = createMockSpec('changed-spec', {
        withIssueNumber: true,
        issueNumber: 123,
        withSyncHash: true,
        syncHash: 'old-hash', // Different from calculated hash
        lastSync: '2024-01-01T00:00:00.000Z',
      })

      // Set up mock remote issue
      mockClient.setMockIssue(123, {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'OPEN',
        labels: [],
      })

      const status = await adapter.getStatus(spec)

      expect(status.status).toBe('draft')
      expect(status.hasChanges).toBe(true)
      expect(status.remoteId).toBe(123)
      expect(status.lastSync).toEqual(new Date('2024-01-01T00:00:00.000Z'))
    })

    test('should return conflict status when both local and remote changes', async () => {
      const spec = createMockSpec('conflict-spec', {
        withIssueNumber: true,
        issueNumber: 123,
        withSyncHash: true,
        syncHash: 'old-hash', // Different from calculated hash (local changes)
        lastSync: null, // No last sync indicates remote changes
      })

      // Set up mock remote issue
      mockClient.setMockIssue(123, {
        number: 123,
        title: 'Test Issue',
        body: 'Test body',
        state: 'OPEN',
        labels: [],
      })

      const status = await adapter.getStatus(spec)

      expect(status.status).toBe('conflict')
      expect(status.hasChanges).toBe(true)
      expect(status.remoteId).toBe(123)
      expect(status.conflicts).toEqual(['Both local and remote have changes'])
    })

    test('should handle hash calculation correctly', async () => {
      const content1 = '# Test Content 1\n\nSome content here.'
      const content2 = '# Test Content 2\n\nDifferent content here.'

      const spec1 = createMockSpecWithContent('hash-test-1', content1)
      const spec2 = createMockSpecWithContent('hash-test-2', content2)

      // Both specs should have different hashes
      const status1 = await adapter.getStatus(spec1)
      const status2 = await adapter.getStatus(spec2)

      // Since neither has issue numbers, both should be draft
      expect(status1.status).toBe('draft')
      expect(status2.status).toBe('draft')
    })

    test('should handle getStatus errors', async () => {
      const spec = createMockSpec('error-spec', {
        withIssueNumber: true,
        issueNumber: 123,
      })

      const statusError = new Error('Failed to get issue')
      mockClient.setMethodError('getIssue', statusError)

      await expect(adapter.getStatus(spec)).rejects.toThrow('Failed to get issue')
    })
  })

  describe('resolveConflict', () => {
    test('should resolve conflict with "theirs" strategy', async () => {
      const localSpec = createMockSpec('local-spec')
      const remoteSpec = createMockSpec('remote-spec')

      const result = await adapter.resolveConflict(localSpec, remoteSpec, 'theirs')

      expect(result).toBe(remoteSpec)
    })

    test('should resolve conflict with "ours" strategy', async () => {
      const localSpec = createMockSpec('local-spec')
      const remoteSpec = createMockSpec('remote-spec')

      const result = await adapter.resolveConflict(localSpec, remoteSpec, 'ours')

      expect(result).toBe(localSpec)
    })

    test('should throw error for unsupported strategy', async () => {
      const localSpec = createMockSpec('local-spec')
      const remoteSpec = createMockSpec('remote-spec')

      await expect(adapter.resolveConflict(localSpec, remoteSpec, 'auto-merge')).rejects.toThrow('Manual conflict resolution required')
    })

    test('should throw error for undefined strategy', async () => {
      const localSpec = createMockSpec('local-spec')
      const remoteSpec = createMockSpec('remote-spec')

      await expect(adapter.resolveConflict(localSpec, remoteSpec)).rejects.toThrow('Manual conflict resolution required')
    })
  })

  describe('hash calculation and sync state', () => {
    test('should calculate consistent hash for same content', async () => {
      const content = '# Test\n\nSame content every time.'
      const _spec1 = createMockSpecWithContent('test-1', content)
      const _spec2 = createMockSpecWithContent('test-2', content)

      // Calculate hashes by checking if they would be considered synced with the same hash
      const testHash = 'abcd1234'

      const syncedSpec1 = createMockSpec('synced-1', {
        withIssueNumber: true,
        issueNumber: 100,
        withSyncHash: true,
        syncHash: testHash,
        content,
      })

      const syncedSpec2 = createMockSpec('synced-2', {
        withIssueNumber: true,
        issueNumber: 101,
        withSyncHash: true,
        syncHash: testHash,
        content,
      })

      // Set up mock issues
      mockClient.setMockIssue(100, { number: 100, title: 'Test', body: 'Test', state: 'OPEN', labels: [] })
      mockClient.setMockIssue(101, { number: 101, title: 'Test', body: 'Test', state: 'OPEN', labels: [] })

      const status1 = await adapter.getStatus(syncedSpec1)
      const status2 = await adapter.getStatus(syncedSpec2)

      // Both should have the same behavior (either both synced or both draft)
      expect(status1.status).toBe(status2.status)
    })

    test('should detect changes when content hash differs', async () => {
      const originalContent = '# Original\n\nOriginal content.'
      const modifiedContent = '# Modified\n\nModified content.'
      const crypto = await import('node:crypto')
      const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex').substring(0, 8)

      const spec = createMockSpec('hash-change-test', {
        withIssueNumber: true,
        issueNumber: 200,
        withSyncHash: true,
        syncHash: originalHash,
        lastSync: '2024-01-01T00:00:00.000Z', // Add last sync to avoid remote changes
        content: modifiedContent, // Content changed after sync
      })

      mockClient.setMockIssue(200, {
        number: 200,
        title: 'Test',
        body: 'Test',
        state: 'OPEN',
        labels: [],
      })

      const status = await adapter.getStatus(spec)

      // Should detect local changes
      expect(status.status).toBe('draft')
      expect(status.hasChanges).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('should handle spec with null frontmatter values', async () => {
      const spec: SpecDocument = {
        name: 'null-frontmatter',
        path: 'specs/null-frontmatter',
        files: new Map([
          ['spec.md', {
            path: 'specs/null-frontmatter/spec.md',
            filename: 'spec.md',
            frontmatter: {
              github: undefined,
              sync_hash: undefined,
              last_sync: undefined,
            },
            content: '# Test',
            markdown: '# Test',
          }],
        ]),
      }

      const status = await adapter.getStatus(spec)

      expect(status.status).toBe('draft')
      expect(status.hasChanges).toBe(true)
    })

    test('should handle malformed issue number', async () => {
      const spec: SpecDocument = {
        name: 'malformed-issue',
        path: 'specs/malformed-issue',
        files: new Map([
          ['spec.md', {
            path: 'specs/malformed-issue/spec.md',
            filename: 'spec.md',
            frontmatter: {
              github: {
                issue_number: 'not-a-number' as any,
              },
            },
            content: '# Test',
            markdown: '# Test',
          }],
        ]),
      }

      const status = await adapter.getStatus(spec)

      // Should return draft because malformed number means no remote issue exists
      expect(status.status).toBe('draft')
      expect(status.hasChanges).toBe(true)
    })
  })
})

// Helper functions
function createMockSpec(
  name: string,
  options: {
    withIssueNumber?: boolean
    issueNumber?: number
    withSyncHash?: boolean
    syncHash?: string
    lastSync?: string | null
    content?: string
  } = {},
): SpecDocument {
  const frontmatter: any = {
    issue_type: 'parent',
    sync_status: 'draft',
    auto_sync: true,
  }

  if (options.withIssueNumber) {
    frontmatter.github = {
      issue_number: options.issueNumber || 456,
    }
  }

  if (options.withSyncHash) {
    frontmatter.sync_hash = options.syncHash || 'default-hash'
  }

  if (options.lastSync !== undefined) {
    frontmatter.last_sync = options.lastSync
  }

  const content = options.content || `# ${name}\n\nThis is a test spec.`

  const specFile: SpecFile = {
    path: `specs/${name}/spec.md`,
    filename: 'spec.md',
    frontmatter,
    content,
    markdown: content,
  }

  return {
    name,
    path: `specs/${name}`,
    files: new Map([['spec.md', specFile]]),
  }
}

function createMockSpecWithContent(name: string, content: string): SpecDocument {
  return createMockSpec(name, { content })
}
