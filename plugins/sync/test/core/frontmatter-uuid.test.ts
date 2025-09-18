import type { SpecFileFrontmatter } from '../../src/types'
import { describe, expect, test } from 'bun:test'
import {
  ensureValidSpecId,
  safeValidateSpecId,
  validateSpecId,
} from '../../src/core/frontmatter'

describe('Frontmatter UUID Validation', () => {
  const _validUuid = '550e8400-e29b-41d4-a716-446655440000'
  const validUuidV4 = '123e4567-e89b-42d3-a456-426614174000'
  const invalidUuid = 'not-a-uuid'
  const malformedUuid = '550e8400-e29b-41d4-a716-44665544000' // missing digit
  const wrongVersionUuid = '550e8400-e29b-31d4-a716-446655440000' // version 3

  describe('validateSpecId', () => {
    test('validates correct UUID v4 format', () => {
      expect(validateSpecId(validUuidV4)).toBe(validUuidV4)
      expect(validateSpecId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    })

    test('accepts UUID with uppercase letters', () => {
      const uppercaseUuid = 'F47AC10B-58CC-4372-A567-0E02B2C3D479'
      expect(validateSpecId(uppercaseUuid)).toBe(uppercaseUuid)
    })

    test('throws error for invalid UUID formats', () => {
      expect(() => validateSpecId(invalidUuid)).toThrow('Invalid spec_id format: not-a-uuid')
      expect(() => validateSpecId(malformedUuid)).toThrow('Invalid spec_id format')
      expect(() => validateSpecId('')).toThrow('Invalid spec_id format')
    })

    test('throws error for non-v4 UUIDs', () => {
      expect(() => validateSpecId(wrongVersionUuid)).toThrow('Invalid spec_id format')
    })

    test('throws error for non-string input', () => {
      expect(() => validateSpecId(123)).toThrow('spec_id must be a string')
      expect(() => validateSpecId(null)).toThrow('spec_id must be a string')
      expect(() => validateSpecId(undefined)).toThrow('spec_id must be a string')
      expect(() => validateSpecId({})).toThrow('spec_id must be a string')
      expect(() => validateSpecId([])).toThrow('spec_id must be a string')
    })

    test('handles edge cases', () => {
      expect(() => validateSpecId('  ')).toThrow('Invalid spec_id format')
      expect(() => validateSpecId('\n')).toThrow('Invalid spec_id format')
      expect(() => validateSpecId('\t')).toThrow('Invalid spec_id format')
    })
  })

  describe('safeValidateSpecId', () => {
    test('returns valid UUID for correct format', () => {
      expect(safeValidateSpecId(validUuidV4)).toBe(validUuidV4)
      expect(safeValidateSpecId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    })

    test('returns null for invalid formats without throwing', () => {
      expect(safeValidateSpecId(invalidUuid)).toBeNull()
      expect(safeValidateSpecId(malformedUuid)).toBeNull()
      expect(safeValidateSpecId('')).toBeNull()
      expect(safeValidateSpecId(wrongVersionUuid)).toBeNull()
    })

    test('returns null for non-string input without throwing', () => {
      expect(safeValidateSpecId(123)).toBeNull()
      expect(safeValidateSpecId(null)).toBeNull()
      expect(safeValidateSpecId(undefined)).toBeNull()
      expect(safeValidateSpecId({})).toBeNull()
      expect(safeValidateSpecId([])).toBeNull()
    })

    test('handles edge cases gracefully', () => {
      expect(safeValidateSpecId('  ')).toBeNull()
      expect(safeValidateSpecId('\n')).toBeNull()
      expect(safeValidateSpecId('\t')).toBeNull()
    })

    test('accepts uppercase UUIDs', () => {
      const uppercaseUuid = 'F47AC10B-58CC-4372-A567-0E02B2C3D479'
      expect(safeValidateSpecId(uppercaseUuid)).toBe(uppercaseUuid)
    })
  })

  describe('ensureValidSpecId', () => {
    test('preserves existing valid UUID', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {
        spec_id: validUuidV4,
        sync_status: 'draft',
      }

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBe(validUuidV4)
      expect(result.sync_status).toBe('draft')
    })

    test('generates new UUID for missing spec_id', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {
        sync_status: 'draft',
        auto_sync: true,
      }

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBeDefined()
      expect(typeof result.spec_id).toBe('string')
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(result.sync_status).toBe('draft')
      expect(result.auto_sync).toBe(true)
    })

    test('generates new UUID for invalid spec_id', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {
        spec_id: invalidUuid as any, // Type cast to bypass TypeScript checking
        sync_status: 'draft',
      }

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBeDefined()
      expect(result.spec_id).not.toBe(invalidUuid)
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(result.sync_status).toBe('draft')
    })

    test('generates new UUID for malformed spec_id', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {
        spec_id: malformedUuid as any,
        sync_status: 'draft',
      }

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBeDefined()
      expect(result.spec_id).not.toBe(malformedUuid)
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    test('generates new UUID for empty spec_id', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {
        spec_id: '' as any,
        sync_status: 'draft',
      }

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBeDefined()
      expect(result.spec_id).not.toBe('')
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    test('handles completely empty frontmatter', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {}

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBeDefined()
      expect(typeof result.spec_id).toBe('string')
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    test('preserves all other frontmatter properties', () => {
      const frontmatter: Partial<SpecFileFrontmatter> = {
        spec_id: validUuidV4,
        sync_status: 'synced',
        auto_sync: false,
        issue_type: 'parent',
        last_sync: '2023-01-01T00:00:00Z',
        sync_hash: 'abc123def456',
        github: {
          issue_number: 123,
          parent_issue: 456,
          labels: ['feature', 'spec'],
        },
        jira: {
          issue_key: 'PROJ-123',
          epic_key: 'PROJ-100',
        },
      }

      const result = ensureValidSpecId(frontmatter)

      expect(result.spec_id).toBe(validUuidV4)
      expect(result.sync_status).toBe('synced')
      expect(result.auto_sync).toBe(false)
      expect(result.issue_type).toBe('parent')
      expect(result.last_sync).toBe('2023-01-01T00:00:00Z')
      expect(result.sync_hash).toBe('abc123def456')
      expect(result.github).toEqual({
        issue_number: 123,
        parent_issue: 456,
        labels: ['feature', 'spec'],
      })
      expect(result.jira).toEqual({
        issue_key: 'PROJ-123',
        epic_key: 'PROJ-100',
      })
    })

    test('generates unique UUIDs on multiple calls', () => {
      const frontmatter1: Partial<SpecFileFrontmatter> = { sync_status: 'draft' }
      const frontmatter2: Partial<SpecFileFrontmatter> = { sync_status: 'draft' }

      const result1 = ensureValidSpecId(frontmatter1)
      const result2 = ensureValidSpecId(frontmatter2)

      expect(result1.spec_id).toBeDefined()
      expect(result2.spec_id).toBeDefined()
      expect(result1.spec_id).not.toBe(result2.spec_id)

      // Both should be valid UUIDs
      expect(result1.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(result2.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    test('handles null and undefined spec_id', () => {
      const frontmatterWithNull: Partial<SpecFileFrontmatter> = {
        spec_id: null as any,
        sync_status: 'draft',
      }

      const frontmatterWithUndefined: Partial<SpecFileFrontmatter> = {
        spec_id: undefined,
        sync_status: 'draft',
      }

      const result1 = ensureValidSpecId(frontmatterWithNull)
      const result2 = ensureValidSpecId(frontmatterWithUndefined)

      expect(result1.spec_id).toBeDefined()
      expect(result2.spec_id).toBeDefined()
      expect(result1.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(result2.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })

  describe('integration with existing frontmatter functions', () => {
    test('works with typical frontmatter workflow', () => {
      // Start with frontmatter without UUID
      let frontmatter: Partial<SpecFileFrontmatter> = {
        sync_status: 'draft',
        auto_sync: true,
      }

      // Ensure valid spec_id
      frontmatter = ensureValidSpecId(frontmatter)
      expect(frontmatter.spec_id).toBeDefined()

      // Validate the spec_id
      const validatedSpecId = validateSpecId(frontmatter.spec_id!)
      expect(validatedSpecId).toBe(frontmatter.spec_id)

      // Safe validation should also work
      const safeValidatedSpecId = safeValidateSpecId(frontmatter.spec_id!)
      expect(safeValidatedSpecId).toBe(frontmatter.spec_id)
    })

    test('handles edge case with non-standard frontmatter structure', () => {
      const weirdFrontmatter = {
        spec_id: 123 as any, // Wrong type
        extraProperty: 'should be preserved',
        nested: {
          property: 'also preserved',
        },
      }

      const result = ensureValidSpecId(weirdFrontmatter)

      expect(result.spec_id).toBeDefined()
      expect(result.spec_id).not.toBe(123)
      expect(result.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect((result as any).extraProperty).toBe('should be preserved')
      expect((result as any).nested).toEqual({ property: 'also preserved' })
    })
  })
})
