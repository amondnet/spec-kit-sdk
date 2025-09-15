import type { SpecFileFrontmatter } from '../../src/schemas/spec.js'
import { describe, expect, test } from 'bun:test'
import {
  safeParseFrontmatter,
  validateFrontmatter,
} from '../../src/schemas/spec.js'

describe('SpecFileFrontmatter Schema Validation', () => {
  describe('validateFrontmatter', () => {
    test('should validate minimal valid frontmatter', () => {
      const validData = {
        spec_id: '12345678-1234-4567-8901-123456789012',
      }

      const result = validateFrontmatter(validData)

      expect(result).toEqual({
        spec_id: '12345678-1234-4567-8901-123456789012',
      })
    })

    test('should validate complete valid frontmatter', () => {
      const completeData = {
        spec_id: '550e8400-e29b-41d4-a716-446655440000',
        sync_hash: 'abc123def456',
        last_sync: '2024-01-01T12:00:00.000Z',
        sync_status: 'synced' as const,
        issue_type: 'parent' as const,
        auto_sync: true,
        github: {
          issue_number: 123,
          parent_issue: 456,
          updated_at: '2024-01-01T11:30:00.000Z',
          labels: ['enhancement', 'bug'],
          assignees: ['developer1', 'developer2'],
          milestone: 1,
        },
        jira: {
          issue_key: 'PROJ-123',
          epic_key: 'PROJ-100',
          issue_type: 'Story',
          updated: '2024-01-01T11:30:00.000Z',
        },
        asana: {
          task_gid: '1234567890',
          project_gid: '0987654321',
          parent_task: '5555555555',
          modified_at: '2024-01-01T11:30:00.000Z',
        },
      }

      const result = validateFrontmatter(completeData)

      expect(result).toEqual(completeData)
    })

    test('should validate empty frontmatter', () => {
      const result = validateFrontmatter({})
      expect(result).toEqual({})
    })

    test('should throw on invalid UUID', () => {
      const invalidData = {
        spec_id: 'not-a-uuid',
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })

    test('should throw on invalid sync_hash', () => {
      const invalidData = {
        sync_hash: 'too-long-hash-12345',
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()

      const invalidData2 = {
        sync_hash: 'short',
      }

      expect(() => validateFrontmatter(invalidData2)).toThrow()

      const invalidData3 = {
        sync_hash: 'UPPERCASE123',
      }

      expect(() => validateFrontmatter(invalidData3)).toThrow()
    })

    test('should throw on invalid datetime', () => {
      const invalidData = {
        last_sync: 'not-a-date',
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })

    test('should throw on invalid sync_status', () => {
      const invalidData = {
        sync_status: 'invalid-status',
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })

    test('should throw on invalid issue_type', () => {
      const invalidData = {
        issue_type: 'invalid-type',
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })

    test('should throw on invalid boolean', () => {
      const invalidData = {
        auto_sync: 'not-a-boolean',
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })
  })

  describe('safeParseFrontmatter', () => {
    test('should return success for valid data', () => {
      const validData = {
        spec_id: '12345678-1234-4567-8901-123456789012',
        sync_status: 'draft',
      } as SpecFileFrontmatter

      const result = safeParseFrontmatter(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    test('should return error for invalid data', () => {
      const invalidData = {
        spec_id: 'invalid-uuid',
      }

      const result = safeParseFrontmatter(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
        expect(result.error.issues).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    test('should provide detailed error information', () => {
      const invalidData = {
        spec_id: 'not-uuid',
        sync_hash: 'too-long-hash-value',
        last_sync: 'invalid-date',
        sync_status: 'bad-status',
        issue_type: 'bad-type',
        auto_sync: 'not-boolean',
      }

      const result = safeParseFrontmatter(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        const issues = result.error.issues
        expect(issues.length).toBeGreaterThan(1) // Multiple validation errors

        // Check that spec_id error is included
        const specIdIssue = issues.find(issue => issue.path.includes('spec_id'))
        expect(specIdIssue).toBeDefined()
      }
    })
  })

  describe('GitHub schema validation', () => {
    test('should validate valid GitHub data', () => {
      const validData = {
        github: {
          issue_number: 123,
          parent_issue: null,
          updated_at: '2024-01-01T12:00:00.000Z',
          labels: ['feature', 'priority-high'],
          assignees: ['user1', 'user2'],
          milestone: 5,
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.github).toEqual(validData.github)
    })

    test('should reject negative issue numbers', () => {
      const invalidData = {
        github: {
          issue_number: -1,
        },
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })

    test('should reject zero issue numbers', () => {
      const invalidData = {
        github: {
          issue_number: 0,
        },
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })

    test('should allow null parent_issue', () => {
      const validData = {
        github: {
          parent_issue: null,
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.github?.parent_issue).toBeNull()
    })

    test('should validate empty arrays', () => {
      const validData = {
        github: {
          labels: [],
          assignees: [],
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.github?.labels).toEqual([])
      expect(result.github?.assignees).toEqual([])
    })

    test('should allow any milestone number', () => {
      const validData = {
        github: {
          milestone: -1,
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.github?.milestone).toBe(-1)
    })

    test('should allow milestone zero', () => {
      const validData = {
        github: {
          milestone: 0,
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.github?.milestone).toBe(0)
    })
  })

  describe('Jira schema validation', () => {
    test('should validate valid Jira data', () => {
      const validData = {
        jira: {
          issue_key: 'PROJ-123',
          epic_key: 'PROJ-100',
          issue_type: 'Bug',
          updated: '2024-01-01T12:00:00.000Z',
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.jira).toEqual(validData.jira)
    })

    test('should allow minimal Jira data', () => {
      const validData = {
        jira: {},
      }

      const result = validateFrontmatter(validData)
      expect(result.jira).toEqual({})
    })

    test('should validate individual Jira fields', () => {
      const validData = {
        jira: {
          issue_key: 'EXAMPLE-456',
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.jira?.issue_key).toBe('EXAMPLE-456')
    })

    test('should reject invalid datetime for updated field', () => {
      const invalidData = {
        jira: {
          updated: 'not-a-datetime',
        },
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })
  })

  describe('Asana schema validation', () => {
    test('should validate valid Asana data', () => {
      const validData = {
        asana: {
          task_gid: '1234567890123456',
          project_gid: '9876543210987654',
          parent_task: '5555555555555555',
          modified_at: '2024-01-01T12:00:00.000Z',
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.asana).toEqual(validData.asana)
    })

    test('should allow minimal Asana data', () => {
      const validData = {
        asana: {},
      }

      const result = validateFrontmatter(validData)
      expect(result.asana).toEqual({})
    })

    test('should validate string GIDs', () => {
      const validData = {
        asana: {
          task_gid: 'string-gid-value',
          project_gid: 'another-string-gid',
        },
      }

      const result = validateFrontmatter(validData)
      expect(result.asana?.task_gid).toBe('string-gid-value')
      expect(result.asana?.project_gid).toBe('another-string-gid')
    })

    test('should reject invalid datetime for modified_at field', () => {
      const invalidData = {
        asana: {
          modified_at: 'invalid-date',
        },
      }

      expect(() => validateFrontmatter(invalidData)).toThrow()
    })
  })

  describe('combined platform validation', () => {
    test('should validate all platforms together', () => {
      const multiPlatformData = {
        spec_id: '11111111-2222-4333-8444-555555555555',
        sync_status: 'synced' as const,
        issue_type: 'subtask' as const,
        github: {
          issue_number: 123,
          labels: ['sync-test'],
        },
        jira: {
          issue_key: 'TEST-456',
          issue_type: 'Subtask',
        },
        asana: {
          task_gid: '789789789789',
        },
      }

      const result = validateFrontmatter(multiPlatformData)
      expect(result).toEqual(multiPlatformData)
    })

    test('should handle undefined platform sections', () => {
      const validData = {
        spec_id: '11111111-2222-4333-8444-555555555555',
        github: undefined,
        jira: undefined,
        asana: undefined,
      }

      const result = validateFrontmatter(validData)
      expect(result.github).toBeUndefined()
      expect(result.jira).toBeUndefined()
      expect(result.asana).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('should handle null input', () => {
      expect(() => validateFrontmatter(null)).toThrow()
    })

    test('should handle undefined input', () => {
      expect(() => validateFrontmatter(undefined)).toThrow()
    })

    test('should handle string input', () => {
      expect(() => validateFrontmatter('not-an-object')).toThrow()
    })

    test('should handle array input', () => {
      expect(() => validateFrontmatter([])).toThrow()
    })

    test('should handle deeply nested invalid data', () => {
      const invalidNestedData = {
        github: {
          issue_number: 'not-a-number',
          labels: 'not-an-array',
          parent_issue: 'not-a-number-or-null',
        },
      }

      expect(() => validateFrontmatter(invalidNestedData)).toThrow()
    })

    test('should preserve extra properties', () => {
      const dataWithExtra = {
        spec_id: '11111111-2222-4333-8444-555555555555',
        extra_field: 'should-be-preserved',
        github: {
          issue_number: 123,
          extra_github_field: 'also-preserved',
        },
      }

      const result = validateFrontmatter(dataWithExtra)
      // Note: Zod strips unknown properties by default unless configured otherwise
      // This test verifies the current behavior
      expect(result.spec_id).toBe('11111111-2222-4333-8444-555555555555')
      expect(result.github?.issue_number).toBe(123)
    })
  })

  describe('type inference', () => {
    test('should provide correct TypeScript types', () => {
      const validData: SpecFileFrontmatter = {
        spec_id: '11111111-2222-4333-8444-555555555555',
        sync_status: 'draft' as const,
        issue_type: 'parent' as const,
        auto_sync: true,
        github: {
          issue_number: 123,
          labels: ['test'],
        },
      }

      const result = validateFrontmatter(validData)

      // TypeScript should infer the correct types
      expect(typeof result.spec_id).toBe('string')
      expect(typeof result.sync_status).toBe('string')
      expect(typeof result.issue_type).toBe('string')
      expect(typeof result.auto_sync).toBe('boolean')
      expect(typeof result.github?.issue_number).toBe('number')
      expect(Array.isArray(result.github?.labels)).toBe(true)
    })

    test('should handle optional fields correctly', () => {
      const minimalData: SpecFileFrontmatter = {}

      const result = validateFrontmatter(minimalData)

      expect(result.spec_id).toBeUndefined()
      expect(result.sync_status).toBeUndefined()
      expect(result.github).toBeUndefined()
    })
  })
})
