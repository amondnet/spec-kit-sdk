import type { SpecFile, SpecFileFrontmatter } from '../../src/types'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  calculateContentHash,
  createDefaultFrontmatter,
  generateSpecId,
  hasContentChanged,
  mergeFrontmatter,
  parseMarkdownWithFrontmatter,
  stringifyMarkdownWithFrontmatter,
  updateFrontmatter,
} from '../../src/core/frontmatter.js'

const TEST_DATA_DIR = path.join(import.meta.dirname, '../fixtures/test-data')

describe('frontmatter utilities', () => {
  let validSpecContent: string
  let invalidSpecContent: string
  let minimalSpecContent: string
  let noFrontmatterContent: string

  beforeEach(async () => {
    validSpecContent = await fs.readFile(path.join(TEST_DATA_DIR, 'valid-spec.md'), 'utf-8')
    invalidSpecContent = await fs.readFile(path.join(TEST_DATA_DIR, 'invalid-frontmatter.md'), 'utf-8')
    minimalSpecContent = await fs.readFile(path.join(TEST_DATA_DIR, 'minimal-spec.md'), 'utf-8')
    noFrontmatterContent = await fs.readFile(path.join(TEST_DATA_DIR, 'no-frontmatter.md'), 'utf-8')
  })

  describe('generateSpecId', () => {
    test('should generate valid UUID v4', () => {
      const id1 = generateSpecId()
      const id2 = generateSpecId()

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(id1).toMatch(uuidRegex)
      expect(id2).toMatch(uuidRegex)
      expect(id1).not.toBe(id2)
    })

    test('should generate unique IDs', () => {
      const ids = Array.from({ length: 100 }, () => generateSpecId())
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(100)
    })
  })

  describe('parseMarkdownWithFrontmatter', () => {
    test('should parse valid frontmatter correctly', () => {
      const result = parseMarkdownWithFrontmatter(validSpecContent, '/test/valid-spec.md')

      expect(result).toEqual({
        path: '/test/valid-spec.md',
        filename: 'valid-spec.md',
        content: expect.stringContaining('# Feature Specification: Test Feature'),
        frontmatter: {
          spec_id: '550e8400-e29b-41d4-a716-446655440000',
          sync_hash: 'abc123def456',
          last_sync: '2024-01-01T10:00:00.000Z',
          sync_status: 'synced',
          issue_type: 'parent',
          auto_sync: true,
          github: {
            issue_number: 123,
            parent_issue: null,
            updated_at: '2024-01-01T09:00:00.000Z',
            labels: ['enhancement', 'frontend'],
            assignees: ['developer1'],
            milestone: 1,
          },
        },
        markdown: expect.stringContaining('# Feature Specification: Test Feature'),
      })
    })

    test('should handle minimal frontmatter', () => {
      const result = parseMarkdownWithFrontmatter(minimalSpecContent, '/test/minimal-spec.md')

      expect(result.frontmatter).toEqual({
        spec_id: '12345678-1234-4567-8901-123456789012',
      })
      expect(result.markdown).toContain('# Minimal Spec')
    })

    test('should handle missing frontmatter', () => {
      const result = parseMarkdownWithFrontmatter(noFrontmatterContent, '/test/no-frontmatter.md')

      expect(result.frontmatter).toEqual({})
      expect(result.markdown).toContain('# Spec Without Frontmatter')
    })

    test('should throw on invalid frontmatter', () => {
      expect(() => {
        parseMarkdownWithFrontmatter(invalidSpecContent, '/test/invalid.md')
      }).toThrow()
    })

    test('should extract filename correctly', () => {
      const result1 = parseMarkdownWithFrontmatter(validSpecContent, '/path/to/spec.md')
      expect(result1.filename).toBe('spec.md')

      const result2 = parseMarkdownWithFrontmatter(validSpecContent, 'simple.md')
      expect(result2.filename).toBe('simple.md')

      const result3 = parseMarkdownWithFrontmatter(validSpecContent, '/complex/nested/path/file.md')
      expect(result3.filename).toBe('file.md')
    })
  })

  describe('stringifyMarkdownWithFrontmatter', () => {
    test('should serialize spec file back to markdown', () => {
      const specFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: '# Test Content',
        frontmatter: {
          spec_id: '12345678-1234-4567-8901-123456789012',
          sync_status: 'draft',
          auto_sync: true,
        },
        markdown: '# Test Content',
      }

      const result = stringifyMarkdownWithFrontmatter(specFile)

      expect(result).toContain('---')
      expect(result).toContain('spec_id: 12345678-1234-4567-8901-123456789012')
      expect(result).toContain('sync_status: draft')
      expect(result).toContain('auto_sync: true')
      expect(result).toContain('# Test Content')
    })

    test('should handle empty frontmatter', () => {
      const specFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: '# Test Content',
        frontmatter: {},
        markdown: '# Test Content',
      }

      const result = stringifyMarkdownWithFrontmatter(specFile)
      expect(result).toBe('# Test Content\n')
    })
  })

  describe('calculateContentHash', () => {
    test('should generate consistent hashes', () => {
      const content = 'test content'
      const hash1 = calculateContentHash(content)
      const hash2 = calculateContentHash(content)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(12)
      expect(hash1).toMatch(/^[a-f0-9]{12}$/)
    })

    test('should generate different hashes for different content', () => {
      const hash1 = calculateContentHash('content 1')
      const hash2 = calculateContentHash('content 2')

      expect(hash1).not.toBe(hash2)
    })

    test('should handle empty content', () => {
      const hash = calculateContentHash('')
      expect(hash).toHaveLength(12)
      expect(hash).toMatch(/^[a-f0-9]{12}$/)
    })

    test('should handle unicode content', () => {
      const hash = calculateContentHash('测试内容 🚀 émojis')
      expect(hash).toHaveLength(12)
      expect(hash).toMatch(/^[a-f0-9]{12}$/)
    })
  })

  describe('updateFrontmatter', () => {
    test('should update frontmatter with provided changes', () => {
      const originalFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: {
          spec_id: '12345678-1234-4567-8901-123456789012',
          sync_status: 'draft',
        },
        markdown: 'test markdown content',
      }

      const updates = {
        sync_status: 'synced' as const,
        auto_sync: true,
      }

      const result = updateFrontmatter(originalFile, updates)

      expect(result.frontmatter.sync_status).toBe('synced')
      expect(result.frontmatter.auto_sync).toBe(true)
      expect(result.frontmatter.spec_id).toBe('12345678-1234-4567-8901-123456789012')
      expect(result.frontmatter.last_sync).toBeDefined()
      expect(result.frontmatter.sync_hash).toBeDefined()
    })

    test('should not generate spec_id if missing (generation moved to SpecScanner)', () => {
      const originalFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: {},
        markdown: 'test content',
      }

      const result = updateFrontmatter(originalFile, {})

      // spec_id generation now happens in SpecScanner, not updateFrontmatter
      expect(result.frontmatter.spec_id).toBeUndefined()
    })

    test('should preserve existing spec_id', () => {
      const existingId = '11111111-2222-3333-4444-555555555555'
      const originalFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: { spec_id: existingId },
        markdown: 'test content',
      }

      const result = updateFrontmatter(originalFile, {})

      expect(result.frontmatter.spec_id).toBe(existingId)
    })

    test('should update last_sync timestamp', () => {
      const originalFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: {},
        markdown: 'test content',
      }

      const beforeUpdate = Date.now()
      const result = updateFrontmatter(originalFile, {})
      const afterUpdate = Date.now()

      const lastSyncTime = new Date(result.frontmatter.last_sync!).getTime()
      expect(lastSyncTime).toBeGreaterThanOrEqual(beforeUpdate)
      expect(lastSyncTime).toBeLessThanOrEqual(afterUpdate)
    })

    test('should calculate sync_hash from markdown content', () => {
      const originalFile: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: {},
        markdown: 'specific markdown content',
      }

      const result = updateFrontmatter(originalFile, {})
      const expectedHash = calculateContentHash('specific markdown content')

      expect(result.frontmatter.sync_hash).toBe(expectedHash)
    })
  })

  describe('hasContentChanged', () => {
    test('should return true when content has changed', () => {
      const file: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: {
          sync_hash: calculateContentHash('old content'),
        },
        markdown: 'new content',
      }

      expect(hasContentChanged(file)).toBe(true)
    })

    test('should return false when content is unchanged', () => {
      const content = 'unchanged content'
      const file: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content,
        frontmatter: {
          sync_hash: calculateContentHash(content),
        },
        markdown: content,
      }

      expect(hasContentChanged(file)).toBe(false)
    })

    test('should return true when sync_hash is missing', () => {
      const file: SpecFile = {
        path: '/test/spec.md',
        filename: 'spec.md',
        content: 'content',
        frontmatter: {},
        markdown: 'content',
      }

      expect(hasContentChanged(file)).toBe(true)
    })
  })

  describe('mergeFrontmatter', () => {
    test('should merge platform-specific data', () => {
      const local: SpecFileFrontmatter = {
        spec_id: '11111111-1111-4111-8111-111111111111',
        sync_status: 'draft',
        github: {
          issue_number: 123,
          labels: ['local-label'],
        },
        jira: {
          issue_key: 'LOCAL-123',
        },
      }

      const remote: SpecFileFrontmatter = {
        spec_id: '22222222-2222-4222-8222-222222222222',
        sync_status: 'synced',
        issue_type: 'subtask',
        github: {
          issue_number: 456,
          assignees: ['remote-user'],
        },
        asana: {
          task_gid: 'remote-task-123',
        },
      }

      const result = mergeFrontmatter(local, remote)

      expect(result.spec_id).toBe(local.spec_id!)
      expect(result.issue_type).toBe('subtask')
      expect(result.github).toEqual({
        issue_number: 456,
        labels: ['local-label'],
        assignees: ['remote-user'],
      })
      expect(result.jira).toEqual({
        issue_key: 'LOCAL-123',
      })
      expect(result.asana).toEqual({
        task_gid: 'remote-task-123',
      })
    })

    test('should handle sync status based on timestamps', () => {
      const localTime = '2024-01-01T12:00:00.000Z'
      const remoteTime = '2024-01-01T10:00:00.000Z'

      const local: SpecFileFrontmatter = {
        last_sync: localTime,
      }

      const remote: SpecFileFrontmatter = {
        last_sync: remoteTime,
      }

      const result = mergeFrontmatter(local, remote)
      expect(result.sync_status).toBe('conflict')
    })

    test('should set synced status when remote is newer', () => {
      const localTime = '2024-01-01T10:00:00.000Z'
      const remoteTime = '2024-01-01T12:00:00.000Z'

      const local: SpecFileFrontmatter = {
        last_sync: localTime,
      }

      const remote: SpecFileFrontmatter = {
        last_sync: remoteTime,
      }

      const result = mergeFrontmatter(local, remote)
      expect(result.sync_status).toBe('synced')
    })

    test('should handle missing timestamps', () => {
      const local: SpecFileFrontmatter = {
        spec_id: '11111111-1111-4111-8111-111111111111',
      }

      const remote: SpecFileFrontmatter = {
        issue_type: 'parent',
      }

      const result = mergeFrontmatter(local, remote)
      expect(result.sync_status).toBeUndefined()
    })
  })

  describe('createDefaultFrontmatter', () => {
    test('should create default frontmatter without issue', () => {
      const result = createDefaultFrontmatter()

      expect(result.spec_id).toBeDefined()
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(result.issue_type).toBe('parent')
      expect(result.sync_status).toBe('draft')
      expect(result.auto_sync).toBe(true)
      expect(result.last_sync).toBeDefined()
      expect(result.github).toBeUndefined()
    })

    test('should create subtask frontmatter with parent', () => {
      const result = createDefaultFrontmatter(456, 123)

      expect(result.issue_type).toBe('subtask')
      expect(result.github).toEqual({
        issue_number: 456,
        parent_issue: 123,
      })
    })

    test('should create parent frontmatter with issue number', () => {
      const result = createDefaultFrontmatter(789)

      expect(result.issue_type).toBe('parent')
      expect(result.github).toEqual({
        issue_number: 789,
        parent_issue: undefined,
      })
    })

    test('should generate unique spec IDs', () => {
      const result1 = createDefaultFrontmatter()
      const result2 = createDefaultFrontmatter()

      expect(result1.spec_id).not.toBe(result2.spec_id)
    })

    test('should set current timestamp', () => {
      const before = Date.now()
      const result = createDefaultFrontmatter()
      const after = Date.now()

      const timestamp = new Date(result.last_sync!).getTime()
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })
})
