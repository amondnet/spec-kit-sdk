import { describe, expect, test } from 'bun:test'
import {
  RequiredSpecIdFrontmatterSchema,
  safeParseFrontmatter,
  safeParseSpecId,
  SpecFileFrontmatterSchema,
  validateFrontmatter,
  validateFrontmatterWithSpecId,
  validateSpecIdOnly,
} from '../../src/schemas/spec'

describe('Schema UUID Validation', () => {
  const validUuidV4 = '123e4567-e89b-42d3-a456-426614174000'
  const validUuidV4Alt = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
  const invalidUuid = 'not-a-uuid'
  const malformedUuid = '550e8400-e29b-41d4-a716-44665544000' // missing digit
  const wrongVersionUuid = '550e8400-e29b-31d4-a716-446655440000' // version 3
  const emptyString = ''

  describe('validateSpecIdOnly', () => {
    test('validates correct UUID v4 format', () => {
      expect(validateSpecIdOnly(validUuidV4)).toBe(validUuidV4)
      expect(validateSpecIdOnly(validUuidV4Alt)).toBe(validUuidV4Alt)
    })

    test('accepts uppercase UUIDs', () => {
      const uppercaseUuid = 'F47AC10B-58CC-4372-A567-0E02B2C3D479'
      expect(validateSpecIdOnly(uppercaseUuid)).toBe(uppercaseUuid)
    })

    test('throws ZodError for invalid UUIDs', () => {
      expect(() => validateSpecIdOnly(invalidUuid)).toThrow()
      expect(() => validateSpecIdOnly(malformedUuid)).toThrow()
      expect(() => validateSpecIdOnly(emptyString)).toThrow()
      expect(() => validateSpecIdOnly(wrongVersionUuid)).toThrow()
    })

    test('throws ZodError for non-string input', () => {
      expect(() => validateSpecIdOnly(123)).toThrow()
      expect(() => validateSpecIdOnly(null)).toThrow()
      expect(() => validateSpecIdOnly(undefined)).toThrow()
      expect(() => validateSpecIdOnly({})).toThrow()
    })
  })

  describe('safeParseSpecId', () => {
    test('returns success for valid UUIDs', () => {
      const result = safeParseSpecId(validUuidV4)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(validUuidV4)
      }
    })

    test('returns error for invalid UUIDs', () => {
      const results = [
        safeParseSpecId(invalidUuid),
        safeParseSpecId(malformedUuid),
        safeParseSpecId(emptyString),
        safeParseSpecId(wrongVersionUuid),
        safeParseSpecId(123),
        safeParseSpecId(null),
        safeParseSpecId(undefined),
      ]

      results.forEach((result) => {
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeDefined()
        }
      })
    })

    test('provides detailed error messages', () => {
      const result = safeParseSpecId(invalidUuid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('SpecFileFrontmatterSchema with UUID', () => {
    test('validates complete frontmatter with valid UUID', () => {
      const frontmatter = {
        spec_id: validUuidV4,
        sync_hash: 'abc123def456',
        last_sync: '2023-01-01T00:00:00Z',
        sync_status: 'draft' as const,
        issue_type: 'parent' as const,
        auto_sync: true,
        github: {
          issue_number: 123,
          labels: ['feature'],
        },
      }

      const result = SpecFileFrontmatterSchema.parse(frontmatter)
      expect(result.spec_id).toBe(validUuidV4)
      expect(result.sync_status).toBe('draft')
    })

    test('validates frontmatter without spec_id (optional)', () => {
      const frontmatter = {
        sync_status: 'draft' as const,
        auto_sync: true,
      }

      const result = SpecFileFrontmatterSchema.parse(frontmatter)
      expect(result.spec_id).toBeUndefined()
      expect(result.sync_status).toBe('draft')
    })

    test('rejects frontmatter with invalid UUID', () => {
      const frontmatter = {
        spec_id: invalidUuid,
        sync_status: 'draft' as const,
      }

      expect(() => SpecFileFrontmatterSchema.parse(frontmatter)).toThrow()
    })

    test('rejects frontmatter with non-v4 UUID', () => {
      const frontmatter = {
        spec_id: wrongVersionUuid,
        sync_status: 'draft' as const,
      }

      expect(() => SpecFileFrontmatterSchema.parse(frontmatter)).toThrow()
    })

    test('safe parsing returns error for invalid UUID', () => {
      const frontmatter = {
        spec_id: invalidUuid,
        sync_status: 'draft' as const,
      }

      const result = safeParseFrontmatter(frontmatter)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue =>
          issue.path.includes('spec_id'),
        )).toBe(true)
      }
    })
  })

  describe('RequiredSpecIdFrontmatterSchema', () => {
    test('validates frontmatter with required valid UUID', () => {
      const frontmatter = {
        spec_id: validUuidV4,
        sync_status: 'draft' as const,
      }

      const result = RequiredSpecIdFrontmatterSchema.parse(frontmatter)
      expect(result.spec_id).toBe(validUuidV4)
    })

    test('rejects frontmatter without spec_id', () => {
      const frontmatter = {
        sync_status: 'draft' as const,
      }

      expect(() => RequiredSpecIdFrontmatterSchema.parse(frontmatter)).toThrow()
    })

    test('rejects frontmatter with invalid spec_id', () => {
      const frontmatter = {
        spec_id: invalidUuid,
        sync_status: 'draft' as const,
      }

      expect(() => RequiredSpecIdFrontmatterSchema.parse(frontmatter)).toThrow()
    })

    test('rejects frontmatter with empty spec_id', () => {
      const frontmatter = {
        spec_id: '',
        sync_status: 'draft' as const,
      }

      expect(() => RequiredSpecIdFrontmatterSchema.parse(frontmatter)).toThrow()
    })
  })

  describe('validateFrontmatterWithSpecId', () => {
    test('validates and returns frontmatter with valid spec_id', () => {
      const frontmatter = {
        spec_id: validUuidV4,
        sync_status: 'draft' as const,
        auto_sync: true,
      }

      const result = validateFrontmatterWithSpecId(frontmatter)
      expect(result.spec_id).toBe(validUuidV4)
      expect(result.sync_status).toBe('draft')
      expect(result.auto_sync).toBe(true)
    })

    test('throws error when spec_id is missing', () => {
      const frontmatter = {
        sync_status: 'draft' as const,
      }

      expect(() => validateFrontmatterWithSpecId(frontmatter)).toThrow('spec_id is required but was not provided')
    })

    test('throws ZodError when spec_id is invalid', () => {
      const frontmatter = {
        spec_id: invalidUuid,
        sync_status: 'draft' as const,
      }

      expect(() => validateFrontmatterWithSpecId(frontmatter)).toThrow()
    })

    test('throws error when spec_id is empty string', () => {
      const frontmatter = {
        spec_id: '',
        sync_status: 'draft' as const,
      }

      expect(() => validateFrontmatterWithSpecId(frontmatter)).toThrow()
    })

    test('type safety - result has guaranteed spec_id', () => {
      const frontmatter = {
        spec_id: validUuidV4,
        sync_status: 'draft' as const,
      }

      const result = validateFrontmatterWithSpecId(frontmatter)

      // TypeScript should know that result.spec_id is string, not string | undefined
      expect(typeof result.spec_id).toBe('string')
      expect(result.spec_id.length).toBe(36) // No need for optional chaining
    })
  })

  describe('error message quality', () => {
    test('provides helpful error messages for invalid UUIDs', () => {
      const testCases = [
        { input: 'not-a-uuid', expectedInMessage: 'Invalid UUID format' },
        { input: '123', expectedInMessage: 'Invalid UUID format' },
        { input: malformedUuid, expectedInMessage: 'UUID must be a valid v4 UUID format' },
        { input: wrongVersionUuid, expectedInMessage: 'UUID must be a valid v4 UUID format' },
      ]

      testCases.forEach(({ input, expectedInMessage }) => {
        try {
          validateSpecIdOnly(input)
          fail(`Expected validation to throw for input: ${input}`)
        }
        catch (error: any) {
          expect(error.message).toContain(expectedInMessage)
        }
      })
    })

    test('provides context in frontmatter validation errors', () => {
      const frontmatter = {
        spec_id: invalidUuid,
        sync_status: 'draft' as const,
      }

      const result = safeParseFrontmatter(frontmatter)
      expect(result.success).toBe(false)

      if (!result.success) {
        const specIdError = result.error.issues.find(issue =>
          issue.path.includes('spec_id'),
        )
        expect(specIdError).toBeDefined()
        expect(specIdError?.message).toContain('Invalid UUID format')
      }
    })
  })

  describe('performance with various UUID formats', () => {
    test('handles many UUID validations efficiently', () => {
      const uuids = Array.from({ length: 1000 }, (_, i) =>
        `${i.toString().padStart(8, '0')}-1234-4567-8901-${(i * 2).toString().padStart(12, '0')}`)

      const startTime = Date.now()

      uuids.forEach((uuid) => {
        const result = safeParseSpecId(uuid)
        expect(result.success).toBe(true)
      })

      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(1000) // Should be fast
    })

    test('validates complex frontmatter objects efficiently', () => {
      const complexFrontmatter = {
        spec_id: validUuidV4,
        sync_hash: 'a'.repeat(12),
        last_sync: '2023-01-01T00:00:00.000Z',
        sync_status: 'synced' as const,
        issue_type: 'parent' as const,
        auto_sync: true,
        github: {
          issue_number: 123,
          parent_issue: 456,
          updated_at: '2023-01-01T00:00:00.000Z',
          labels: Array.from({ length: 10 }, (_, i) => `label-${i}`),
          assignees: Array.from({ length: 5 }, (_, i) => `user-${i}`),
          milestone: 789,
        },
        jira: {
          issue_key: 'PROJ-123',
          epic_key: 'PROJ-100',
          issue_type: 'Story',
          updated: '2023-01-01T00:00:00.000Z',
        },
        asana: {
          task_gid: '1234567890',
          project_gid: '9876543210',
          parent_task: '5555555555',
          modified_at: '2023-01-01T00:00:00.000Z',
        },
      }

      const startTime = Date.now()

      for (let i = 0; i < 100; i++) {
        const result = validateFrontmatter(complexFrontmatter)
        expect(result.spec_id).toBe(validUuidV4)
      }

      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(500) // Should be fast
    })
  })

  describe('integration scenarios', () => {
    test('round-trip validation maintains data integrity', () => {
      const originalFrontmatter = {
        spec_id: validUuidV4,
        sync_hash: 'abc123def456',
        sync_status: 'synced' as const,
        github: { issue_number: 123 },
      }

      // Validate and parse
      const validated = validateFrontmatter(originalFrontmatter)

      // Validate spec_id specifically
      const specId = validateSpecIdOnly(validated.spec_id!)

      // Ensure the data is unchanged
      expect(validated).toEqual(originalFrontmatter)
      expect(specId).toBe(validUuidV4)
    })

    test('schema evolution compatibility', () => {
      // Simulate frontmatter with extra properties (future compatibility)
      const futureCompatibleFrontmatter = {
        spec_id: validUuidV4,
        sync_status: 'draft' as const,
        future_property: 'should be ignored',
        nested_future: {
          property: 'also ignored',
        },
      }

      // Current schema should accept and ignore unknown properties
      const result = SpecFileFrontmatterSchema.parse(futureCompatibleFrontmatter)
      expect(result.spec_id).toBe(validUuidV4)
      expect(result.sync_status).toBe('draft')
      // Future properties should be stripped out by Zod
      expect((result as any).future_property).toBeUndefined()
    })
  })
})
