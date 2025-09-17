import { describe, expect, test } from 'bun:test'
import {
  embedUuidInIssueBody,
  extractUuidFromIssueBody,
  hasUuidMetadata,
  isValidUuid,
  removeUuidFromIssueBody,
} from '../../../src/adapters/github/uuid-utils'

describe('UUID Utils', () => {
  const _validUuid = '550e8400-e29b-41d4-a716-446655440000'
  const validUuidV4 = '123e4567-e89b-42d3-a456-426614174000'
  const invalidUuid = 'not-a-uuid'
  const malformedUuid = '550e8400-e29b-41d4-a716-44665544000'
  const wrongVersionUuid = '550e8400-e29b-31d4-a716-446655440000' // version 3, not 4

  describe('isValidUuid', () => {
    test('validates correct UUID v4 format', () => {
      expect(isValidUuid(validUuidV4)).toBe(true)
      expect(isValidUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true)
    })

    test('accepts UUID with uppercase letters', () => {
      expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
    })

    test('rejects invalid formats', () => {
      expect(isValidUuid(invalidUuid)).toBe(false)
      expect(isValidUuid(malformedUuid)).toBe(false)
      expect(isValidUuid('123-456-789')).toBe(false)
      expect(isValidUuid('')).toBe(false)
    })

    test('validates strict UUID v4 format', () => {
      // Should accept valid v4 UUID (4 in version position)
      expect(isValidUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true)

      // Should reject other versions due to strict v4 validation
      expect(isValidUuid(wrongVersionUuid)).toBe(false)
    })

    test('handles edge cases', () => {
      expect(isValidUuid('')).toBe(false)
      // TypeScript will prevent null/undefined at compile time, but testing runtime behavior
      expect(isValidUuid(null as any)).toBe(false)
      expect(isValidUuid(undefined as any)).toBe(false)
      expect(isValidUuid(123 as any)).toBe(false)
      expect(isValidUuid({} as any)).toBe(false)
    })
  })

  describe('embedUuidInIssueBody', () => {
    test('embeds UUID at beginning of body', () => {
      const body = 'This is the issue description'
      const result = embedUuidInIssueBody(body, validUuidV4)

      expect(result).toStartWith(`<!-- spec_id: ${validUuidV4} -->`)
      expect(result).toContain(body)
      expect(result).toMatch(/^<!-- spec_id: .+ -->\n\nThis is the issue description$/)
    })

    test('replaces existing UUID comment', () => {
      const existingUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      const bodyWithUuid = `<!-- spec_id: ${existingUuid} -->\n\nOriginal content`

      const result = embedUuidInIssueBody(bodyWithUuid, validUuidV4)

      expect(result).toContain(validUuidV4)
      expect(result).not.toContain(existingUuid)
      expect(result).toContain('Original content')

      // Should have only one UUID comment
      const uuidMatches = result.match(/<!-- spec_id:/g)
      expect(uuidMatches).toHaveLength(1)
    })

    test('handles empty body', () => {
      const result = embedUuidInIssueBody('', validUuidV4)

      expect(result).toBe(`<!-- spec_id: ${validUuidV4} -->\n\n`)
    })

    test('handles whitespace-only body', () => {
      const result = embedUuidInIssueBody('   \n\t  ', validUuidV4)

      expect(result).toBe(`<!-- spec_id: ${validUuidV4} -->\n\n`)
    })

    test('preserves body formatting', () => {
      const bodyWithFormatting = `# Title

## Section
- Item 1
- Item 2

**Bold text**`

      const result = embedUuidInIssueBody(bodyWithFormatting, validUuidV4)

      expect(result).toStartWith(`<!-- spec_id: ${validUuidV4} -->`)
      expect(result).toContain('# Title')
      expect(result).toContain('**Bold text**')
    })

    test('throws on invalid UUID', () => {
      expect(() => {
        embedUuidInIssueBody('body content', invalidUuid)
      }).toThrow('Invalid UUID format')

      expect(() => {
        embedUuidInIssueBody('body content', malformedUuid)
      }).toThrow('Invalid UUID format')

      expect(() => {
        embedUuidInIssueBody('body content', '')
      }).toThrow('Invalid UUID format')
    })
  })

  describe('extractUuidFromIssueBody', () => {
    test('extracts UUID from comment', () => {
      const body = `<!-- spec_id: ${validUuidV4} -->\n\nIssue description`
      const result = extractUuidFromIssueBody(body)

      expect(result).toBe(validUuidV4)
    })

    test('extracts UUID with different spacing', () => {
      const bodyVariations = [
        `<!--spec_id:${validUuidV4}-->\n\nContent`,
        `<!-- spec_id:${validUuidV4} -->\n\nContent`,
        `<!--  spec_id: ${validUuidV4}  -->\n\nContent`,
      ]

      bodyVariations.forEach((body) => {
        const result = extractUuidFromIssueBody(body)
        expect(result).toBe(validUuidV4)
      })
    })

    test('returns null when no UUID found', () => {
      const bodiesWithoutUuid = [
        'Regular issue description',
        '<!-- some other comment -->',
        '<!-- spec_id: invalid-uuid -->',
        '',
        'No UUID here at all',
      ]

      bodiesWithoutUuid.forEach((body) => {
        const result = extractUuidFromIssueBody(body)
        expect(result).toBeNull()
      })
    })

    test('handles malformed comments', () => {
      const malformedComments = [
        '<!-- spec_id: -->',
        '<!-- spec_id: not-a-uuid -->',
        `<!-- spec_id \${validUuidV4} -->`, // missing colon
        `<!-- spec_id: \${malformedUuid} -->`, // invalid UUID format
      ]

      malformedComments.forEach((body) => {
        const result = extractUuidFromIssueBody(body)
        expect(result).toBeNull()
      })
    })

    test('extracts first UUID when multiple present', () => {
      const firstUuid = validUuidV4
      const secondUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      const body = `<!-- spec_id: ${firstUuid} -->
<!-- spec_id: ${secondUuid} -->
Content`

      const result = extractUuidFromIssueBody(body)
      expect(result).toBe(firstUuid)
    })

    test('handles case insensitive UUID format', () => {
      const uppercaseUuid = validUuidV4.toUpperCase()
      const body = `<!-- spec_id: ${uppercaseUuid} -->\n\nContent`

      const result = extractUuidFromIssueBody(body)
      expect(result).toBe(uppercaseUuid)
    })

    test('handles UUID in middle of body', () => {
      const body = `Some content here

<!-- spec_id: ${validUuidV4} -->

More content below`

      const result = extractUuidFromIssueBody(body)
      expect(result).toBe(validUuidV4)
    })
  })

  describe('hasUuidMetadata', () => {
    test('detects UUID presence', () => {
      const bodyWithUuid = `<!-- spec_id: ${validUuidV4} -->\n\nContent`
      expect(hasUuidMetadata(bodyWithUuid)).toBe(true)
    })

    test('handles bodies without UUID', () => {
      const bodiesWithoutUuid = [
        'Regular content',
        '<!-- some other comment -->',
        '',
        '<!-- spec_id: invalid -->',
        'No metadata here',
      ]

      bodiesWithoutUuid.forEach((body) => {
        expect(hasUuidMetadata(body)).toBe(false)
      })
    })

    test('detects UUID regardless of position', () => {
      const bodies = [
        `<!-- spec_id: ${validUuidV4} -->\n\nContent`,
        `Content\n<!-- spec_id: ${validUuidV4} -->\nMore content`,
        `Some text\n\n<!-- spec_id: ${validUuidV4} -->`,
      ]

      bodies.forEach((body) => {
        expect(hasUuidMetadata(body)).toBe(true)
      })
    })
  })

  describe('removeUuidFromIssueBody', () => {
    test('removes UUID comment and preserves content', () => {
      const content = 'Issue description with details'
      const bodyWithUuid = `<!-- spec_id: ${validUuidV4} -->\n\n${content}`

      const result = removeUuidFromIssueBody(bodyWithUuid)
      expect(result).toBe(content)
      expect(result).not.toContain('spec_id')
    })

    test('handles body without UUID', () => {
      const originalBody = 'Regular issue content'
      const result = removeUuidFromIssueBody(originalBody)

      expect(result).toBe(originalBody)
    })

    test('removes UUID from middle of content', () => {
      const body = `First paragraph

<!-- spec_id: ${validUuidV4} -->

Second paragraph`

      const result = removeUuidFromIssueBody(body)
      expect(result).toBe('First paragraph\n\nSecond paragraph')
      expect(result).not.toContain('spec_id')
    })

    test('handles multiple UUID comments', () => {
      const body = `<!-- spec_id: ${validUuidV4} -->
Content here
<!-- spec_id: f47ac10b-58cc-4372-a567-0e02b2c3d479 -->
More content`

      const result = removeUuidFromIssueBody(body)
      expect(result).toContain('Content here')
      expect(result).toContain('More content')
      expect(result).not.toContain('spec_id')
    })

    test('trims whitespace after removal', () => {
      const bodyWithExtraWhitespace = `   <!-- spec_id: ${validUuidV4} -->   \n\n   Content   \n\n   `

      const result = removeUuidFromIssueBody(bodyWithExtraWhitespace)
      expect(result).toBe('Content')
    })

    test('handles empty body after UUID removal', () => {
      const onlyUuidBody = `<!-- spec_id: ${validUuidV4} -->`

      const result = removeUuidFromIssueBody(onlyUuidBody)
      expect(result).toBe('')
    })
  })

  describe('edge cases and error conditions', () => {
    test('handles very long UUIDs in comments', () => {
      const tooLongUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479-extra'
      const body = `<!-- spec_id: ${tooLongUuid} -->\n\nContent`

      expect(extractUuidFromIssueBody(body)).toBeNull()
      expect(hasUuidMetadata(body)).toBe(false)
    })

    test('handles special characters in body around UUID', () => {
      const body = `🎉 Welcome!
<!-- spec_id: ${validUuidV4} -->
**Bold** _italic_ \`code\``

      const result = extractUuidFromIssueBody(body)
      expect(result).toBe(validUuidV4)

      const cleaned = removeUuidFromIssueBody(body)
      expect(cleaned).toContain('🎉 Welcome!')
      expect(cleaned).toContain('**Bold**')
    })

    test('performance with large body content', () => {
      const largeContent = 'A'.repeat(10000)
      const bodyWithUuid = `<!-- spec_id: ${validUuidV4} -->\n\n${largeContent}`

      const startTime = Date.now()
      const extracted = extractUuidFromIssueBody(bodyWithUuid)
      const endTime = Date.now()

      expect(extracted).toBe(validUuidV4)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    test('handles nested comment-like strings', () => {
      const body = `<!-- spec_id: ${validUuidV4} -->

Content with <!-- fake comment --> inside

And more content`

      const result = extractUuidFromIssueBody(body)
      expect(result).toBe(validUuidV4)

      const cleaned = removeUuidFromIssueBody(body)
      expect(cleaned).toContain('<!-- fake comment -->')
    })
  })
})
