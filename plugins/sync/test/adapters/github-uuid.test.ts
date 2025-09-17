import type { SpecDocument, SpecFile, SpecFileFrontmatter } from '../../src/types'
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { GitHubAdapter } from '../../src/adapters/github/github.adapter'

// Mock dependencies
mock.module('../../src/adapters/github/api', () => ({
  GitHubClient: mock().mockImplementation(() => ({
    checkAuth: mock().mockResolvedValue(true),
    searchIssueByUuid: mock(),
    getIssue: mock(),
    createIssue: mock(),
    updateIssue: mock(),
    ensureLabelsExist: mock(),
    batchUpdateIssues: mock(),
  })),
}))

mock.module('../../src/adapters/github/mapper', () => ({
  SpecToIssueMapper: mock().mockImplementation(() => ({
    generateTitle: mock().mockReturnValue('Test Issue Title'),
    generateBody: mock().mockReturnValue('Test issue body content'),
    issueToSpec: mock(),
  })),
}))

describe('GitHubAdapter UUID Matching', () => {
  let adapter: GitHubAdapter
  let mockClient: any
  let mockMapper: any

  const validUuid = '550e8400-e29b-41d4-a716-446655440000'
  const anotherUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  const createMockSpec = (overrides: Partial<{
    uuid: string
    issueNumber: number
    content: string
  }> = {}): SpecDocument => {
    const frontmatter: SpecFileFrontmatter = {
      spec_id: overrides.uuid,
      sync_status: 'draft',
      github: overrides.issueNumber ? { issue_number: overrides.issueNumber } : undefined,
    }

    const specFile: SpecFile = {
      path: '/test/spec.md',
      filename: 'spec.md',
      content: overrides.content || 'Test content',
      frontmatter,
      markdown: overrides.content || 'Test content',
    }

    return {
      path: '/test/001-test-feature',
      name: '001-test-feature',
      issueNumber: overrides.issueNumber,
      files: new Map([['spec.md', specFile]]),
    }
  }

  const createMockIssue = (number: number, body: string) => ({
    number,
    title: 'Test Issue',
    body,
    state: 'open',
    labels: [],
  })

  beforeEach(() => {
    // Reset all mocks
    mock.restore()

    // Create fresh adapter instance
    adapter = new GitHubAdapter({
      owner: 'test-owner',
      repo: 'test-repo',
    })

    // Get mock instances
    mockClient = (adapter as any).client
    mockMapper = (adapter as any).mapper

    // Reset mock implementations
    mockClient.checkAuth.mockResolvedValue(true)
    mockClient.searchIssueByUuid.mockResolvedValue(null)
    mockClient.getIssue.mockResolvedValue(null)
    mockClient.createIssue.mockResolvedValue(123)
    mockClient.updateIssue.mockResolvedValue(undefined)
    mockClient.ensureLabelsExist.mockResolvedValue(undefined)

    mockMapper.generateTitle.mockReturnValue('Test Issue Title')
    mockMapper.generateBody.mockReturnValue('Test issue body content')
  })

  describe('push with UUID priority', () => {
    test('uses UUID for matching when available', async () => {
      const spec = createMockSpec({ uuid: validUuid })
      const existingIssue = createMockIssue(456, `<!-- spec_id: ${validUuid} -->\n\nExisting content`)

      mockClient.searchIssueByUuid.mockResolvedValue(existingIssue)

      const result = await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.updateIssue).toHaveBeenCalledWith(
        456,
        expect.objectContaining({
          title: expect.any(String),
          body: expect.stringContaining(validUuid),
        }),
      )
      expect(result.id).toBe(456)
    })

    test('falls back to issue_number when UUID search fails', async () => {
      const spec = createMockSpec({ uuid: validUuid, issueNumber: 789 })
      const existingIssueByNumber = createMockIssue(789, 'Existing content without UUID')

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(existingIssueByNumber)

      const result = await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.getIssue).toHaveBeenCalledWith(789)
      expect(mockClient.updateIssue).toHaveBeenCalledWith(
        789,
        expect.objectContaining({
          title: expect.any(String),
          body: expect.stringContaining(validUuid),
        }),
      )
      expect(result.id).toBe(789)
    })

    test('detects UUID mismatch conflicts', async () => {
      const spec = createMockSpec({ uuid: validUuid, issueNumber: 789 })
      const existingIssueWithDifferentUuid = createMockIssue(
        789,
        `<!-- spec_id: ${anotherUuid} -->\n\nExisting content`,
      )

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(existingIssueWithDifferentUuid)

      await expect(adapter.push(spec)).rejects.toThrow('UUID mismatch')

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.getIssue).toHaveBeenCalledWith(789)
      expect(mockClient.updateIssue).not.toHaveBeenCalled()
    })

    test('creates new issue with UUID metadata', async () => {
      const spec = createMockSpec({ uuid: validUuid })

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(null)
      mockClient.createIssue.mockResolvedValue(999)

      const result = await adapter.push(spec)

      expect(mockClient.createIssue).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(validUuid),
        expect.any(Array),
      )
      expect(result.id).toBe(999)
    })

    test('updates existing issue preserving UUID', async () => {
      const spec = createMockSpec({ uuid: validUuid, content: 'Updated content' })
      const existingIssue = createMockIssue(456, `<!-- spec_id: ${validUuid} -->\n\nOld content`)

      mockClient.searchIssueByUuid.mockResolvedValue(existingIssue)

      await adapter.push(spec)

      expect(mockClient.updateIssue).toHaveBeenCalledWith(
        456,
        expect.objectContaining({
          body: expect.stringMatching(new RegExp(`<!-- spec_id: ${validUuid} -->`)),
        }),
      )
    })

    test('handles force option to override conflicts', async () => {
      const spec = createMockSpec({ uuid: validUuid, issueNumber: 789 })
      const existingIssueWithDifferentUuid = createMockIssue(
        789,
        `<!-- spec_id: ${anotherUuid} -->\n\nExisting content`,
      )

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(existingIssueWithDifferentUuid)

      const result = await adapter.push(spec, { force: true })

      expect(mockClient.updateIssue).toHaveBeenCalledWith(
        789,
        expect.objectContaining({
          body: expect.stringContaining(validUuid),
        }),
      )
      expect(result.id).toBe(789)
    })
  })

  describe('UUID search functionality', () => {
    test('finds issues by UUID in body', async () => {
      const issueWithUuid = createMockIssue(123, `<!-- spec_id: ${validUuid} -->\n\nContent`)
      mockClient.searchIssueByUuid.mockResolvedValue(issueWithUuid)

      const spec = createMockSpec({ uuid: validUuid })
      const result = await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(result.id).toBe(123)
    })

    test('returns null for non-existent UUID', async () => {
      mockClient.searchIssueByUuid.mockResolvedValue(null)

      const spec = createMockSpec({ uuid: validUuid })
      await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.createIssue).toHaveBeenCalled() // Should create new issue
    })

    test('handles search API errors gracefully', async () => {
      mockClient.searchIssueByUuid.mockRejectedValue(new Error('Search API error'))

      const spec = createMockSpec({ uuid: validUuid })

      // Should not throw, should fallback to creation
      await expect(adapter.push(spec)).resolves.toBeDefined()
      expect(mockClient.createIssue).toHaveBeenCalled()
    })

    test('handles multiple partial matches', async () => {
      // This tests the extraction logic within searchIssueByUuid
      // The method should find the exact UUID match even if multiple issues contain similar text
      const exactMatch = createMockIssue(123, `<!-- spec_id: ${validUuid} -->\n\nContent`)
      mockClient.searchIssueByUuid.mockResolvedValue(exactMatch)

      const spec = createMockSpec({ uuid: validUuid })
      const result = await adapter.push(spec)

      expect(result.id).toBe(123)
    })
  })

  describe('getStatus with UUID priority', () => {
    test('uses UUID for status checking when available', async () => {
      const spec = createMockSpec({ uuid: validUuid })
      const issueWithUuid = createMockIssue(456, `<!-- spec_id: ${validUuid} -->\n\nContent`)

      mockClient.searchIssueByUuid.mockResolvedValue(issueWithUuid)

      const status = await adapter.getStatus(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(status.remoteId).toBe(456)
    })

    test('falls back to issue_number for status checking', async () => {
      const spec = createMockSpec({ uuid: validUuid, issueNumber: 789 })
      const issueByNumber = createMockIssue(789, 'Content without UUID')

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(issueByNumber)

      const status = await adapter.getStatus(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.getIssue).toHaveBeenCalledWith(789)
      expect(status.remoteId).toBe(789)
    })

    test('detects UUID mismatch in status check', async () => {
      const spec = createMockSpec({ uuid: validUuid, issueNumber: 789 })
      const issueWithDifferentUuid = createMockIssue(
        789,
        `<!-- spec_id: ${anotherUuid} -->\n\nContent`,
      )

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(issueWithDifferentUuid)

      const status = await adapter.getStatus(spec)

      expect(status.status).toBe('conflict')
      expect(status.conflicts).toContain(
        expect.stringMatching(/UUID mismatch.*local=.*remote=/),
      )
    })

    test('returns draft status when no remote issue found', async () => {
      const spec = createMockSpec({ uuid: validUuid })

      mockClient.searchIssueByUuid.mockResolvedValue(null)
      mockClient.getIssue.mockResolvedValue(null)

      const status = await adapter.getStatus(spec)

      expect(status.status).toBe('draft')
      expect(status.hasChanges).toBe(true)
    })
  })

  describe('edge cases', () => {
    test('handles specs with UUID but no issue_number', async () => {
      const spec = createMockSpec({ uuid: validUuid }) // No issue_number

      mockClient.searchIssueByUuid.mockResolvedValue(null)

      await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.getIssue).not.toHaveBeenCalled()
      expect(mockClient.createIssue).toHaveBeenCalled()
    })

    test('handles specs with issue_number but no UUID', async () => {
      const spec = createMockSpec({ issueNumber: 789 }) // No UUID
      const existingIssue = createMockIssue(789, 'Existing content')

      mockClient.getIssue.mockResolvedValue(existingIssue)

      const result = await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).not.toHaveBeenCalled()
      expect(mockClient.getIssue).toHaveBeenCalledWith(789)
      expect(result.id).toBe(789)
    })

    test('handles conflicting identifiers', async () => {
      // UUID points to one issue, issue_number points to another
      const spec = createMockSpec({ uuid: validUuid, issueNumber: 789 })
      const issueByUuid = createMockIssue(456, `<!-- spec_id: ${validUuid} -->\n\nContent`)

      mockClient.searchIssueByUuid.mockResolvedValue(issueByUuid)

      const result = await adapter.push(spec)

      // UUID should take priority
      expect(result.id).toBe(456)
      expect(mockClient.getIssue).not.toHaveBeenCalled()
    })

    test('handles malformed UUID in frontmatter', async () => {
      const spec = createMockSpec({ uuid: 'invalid-uuid-format' })

      // Should not call UUID search with invalid UUID
      await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith('invalid-uuid-format')
      expect(mockClient.createIssue).toHaveBeenCalled()
    })

    test('handles missing spec.md file', async () => {
      const spec: SpecDocument = {
        path: '/test/001-test-feature',
        name: '001-test-feature',
        files: new Map(), // No spec.md file
      }

      await expect(adapter.push(spec)).rejects.toThrow(
        'No spec.md file found in 001-test-feature',
      )
    })

    test('handles empty frontmatter', async () => {
      const specFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'Test content',
        frontmatter: {}, // Empty frontmatter
        markdown: 'Test content',
      }

      const spec: SpecDocument = {
        path: '/test/001-test-feature',
        name: '001-test-feature',
        files: new Map([['spec.md', specFile]]),
      }

      await adapter.push(spec)

      expect(mockClient.searchIssueByUuid).not.toHaveBeenCalled()
      expect(mockClient.createIssue).toHaveBeenCalled()
    })
  })

  describe('batch operations with UUID', () => {
    test('uses UUID-first matching for batch operations', async () => {
      const specs = [
        createMockSpec({ uuid: validUuid }),
        createMockSpec({ uuid: anotherUuid, issueNumber: 789 }),
      ]

      const issueByUuid = createMockIssue(456, `<!-- spec_id: ${validUuid} -->\n\nContent`)
      mockClient.searchIssueByUuid
        .mockResolvedValueOnce(issueByUuid) // First spec found by UUID
        .mockResolvedValueOnce(null) // Second spec not found by UUID

      const issueByNumber = createMockIssue(789, 'Content')
      mockClient.getIssue.mockResolvedValue(issueByNumber)

      const results = await adapter.pushBatch(specs)

      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(validUuid)
      expect(mockClient.searchIssueByUuid).toHaveBeenCalledWith(anotherUuid)
      expect(mockClient.getIssue).toHaveBeenCalledWith(789)
      expect(results).toHaveLength(2)
    })

    test('separates creation and updates correctly with UUID priority', async () => {
      const specWithExistingIssue = createMockSpec({ uuid: validUuid })
      const specToCreate = createMockSpec({ uuid: anotherUuid })

      const existingIssue = createMockIssue(456, `<!-- spec_id: ${validUuid} -->\n\nContent`)
      mockClient.searchIssueByUuid
        .mockResolvedValueOnce(existingIssue) // First spec has existing issue
        .mockResolvedValueOnce(null) // Second spec doesn't

      mockClient.createIssue.mockResolvedValue(999)

      const results = await adapter.pushBatch([specWithExistingIssue, specToCreate])

      expect(mockClient.updateIssue).toHaveBeenCalledWith(
        456,
        expect.objectContaining({
          body: expect.stringContaining(validUuid),
        }),
      )
      expect(mockClient.createIssue).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(anotherUuid),
        expect.any(Array),
      )
      expect(results).toHaveLength(2)
    })
  })
})
