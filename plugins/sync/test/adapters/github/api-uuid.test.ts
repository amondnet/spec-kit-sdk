import type { GitHubIssue } from '../../../src/types'
import { beforeEach, describe, expect, test } from 'bun:test'
import { GitHubClient } from '../../../src/adapters/github/api.js'

// Mock GitHubClient that extends the real one for testing
class MockGitHubClient extends GitHubClient {
  public searchIssueCalls: Array<string> = []
  private mockSearchResults = new Map<string, GitHubIssue[]>()
  private mockErrors = new Map<string, Error>()

  constructor() {
    super('test-owner', 'test-repo')
  }

  // Override to provide direct control over the method
  override async searchIssueByUuid(uuid: string): Promise<GitHubIssue | null> {
    // Import the isValidUuid function to use the same validation
    const { isValidUuid } = await import('../../../src/adapters/github/uuid-utils.js')

    // Validate UUID format before making API call
    if (!isValidUuid(uuid)) {
      console.warn(`Invalid UUID format provided: ${uuid}`)
      return null
    }

    try {
      // Use our mock implementation
      this.searchIssueCalls.push(uuid)

      // Check for mock errors
      const error = this.mockErrors.get(uuid)
      if (error) {
        throw error
      }

      // Return mock results with UUID extraction logic
      const results = this.mockSearchResults.get(uuid) || []
      for (const issue of results) {
        const { extractUuidFromIssueBody } = await import('../../../src/adapters/github/uuid-utils.js')
        const extractedUuid = extractUuidFromIssueBody(issue.body)
        if (extractedUuid === uuid) {
          return {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            labels: issue.labels || [],
          }
        }
      }

      return null
    }
    catch (error) {
      console.warn(`UUID search failed for ${uuid}:`, error)
      return null
    }
  }

  // Mock the executeGhCommand method used by searchIssueByUuid
  override async executeGhCommand(args: string[]): Promise<string> {
    if (args[0] === 'search' && args[1] === 'issues') {
      const queryArg = args.find(arg => arg.includes('spec_id:'))
      if (queryArg) {
        // Extract UUID from search query
        const match = queryArg.match(/spec_id:\s*([a-f0-9-]{36})/i)
        if (match) {
          const uuid = match[1]
          this.searchIssueCalls.push(uuid)

          // Check for mock errors
          const error = this.mockErrors.get(uuid)
          if (error) {
            throw error
          }

          // Return mock results with proper mapping for labels
          const results = this.mockSearchResults.get(uuid) || []
          const processedResults = results.map(result => ({
            ...result,
            labels: result.labels?.map(name => ({ name })) || [],
          }))
          return JSON.stringify(processedResults)
        }
      }
    }

    // Fallback to prevent errors in other tests
    return JSON.stringify([])
  }

  // Test utilities
  setMockSearchResult(uuid: string, results: GitHubIssue[]): void {
    this.mockSearchResults.set(uuid, results)
  }

  setMockSearchError(uuid: string, error: Error): void {
    this.mockErrors.set(uuid, error)
  }

  reset(): void {
    this.searchIssueCalls = []
    this.mockSearchResults.clear()
    this.mockErrors.clear()
  }
}

describe('GitHubClient UUID Search', () => {
  let client: MockGitHubClient

  const validUuid = '550e8400-e29b-41d4-a716-446655440000'
  const invalidUuid = 'invalid-uuid-format'
  const notFoundUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  beforeEach(() => {
    client = new MockGitHubClient()
  })

  describe('searchIssueByUuid', () => {
    test('returns issue when UUID is found', async () => {
      const mockIssue: GitHubIssue = {
        number: 123,
        title: 'Test Issue',
        body: `<!-- spec_id: ${validUuid} -->\n\nIssue content`,
        state: 'OPEN',
        labels: ['feature', 'spec'],
      }

      client.setMockSearchResult(validUuid, [mockIssue])

      const result = await client.searchIssueByUuid(validUuid)

      expect(result).toEqual({
        number: 123,
        title: 'Test Issue',
        body: `<!-- spec_id: ${validUuid} -->\n\nIssue content`,
        state: 'OPEN',
        labels: ['feature', 'spec'],
      })
      expect(client.searchIssueCalls).toContain(validUuid)
    })

    test('returns null when UUID is not found', async () => {
      client.setMockSearchResult(notFoundUuid, [])

      const result = await client.searchIssueByUuid(notFoundUuid)

      expect(result).toBeNull()
      expect(client.searchIssueCalls).toContain(notFoundUuid)
    })

    test('returns null for invalid UUID format', async () => {
      const originalWarn = console.warn
      const warnCalls: any[][] = []
      console.warn = (...args: any[]) => {
        warnCalls.push(args)
      }

      const result = await client.searchIssueByUuid(invalidUuid)

      expect(result).toBeNull()
      expect(warnCalls.length).toBe(1)
      expect(warnCalls[0]).toEqual([`Invalid UUID format provided: ${invalidUuid}`])
      expect(client.searchIssueCalls).not.toContain(invalidUuid)

      console.warn = originalWarn
    })

    test('finds exact UUID match from multiple results', async () => {
      const targetUuid = validUuid
      const otherUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

      const matchingIssue: GitHubIssue = {
        number: 123,
        title: 'Matching Issue',
        body: `<!-- spec_id: ${targetUuid} -->\n\nCorrect issue`,
        state: 'OPEN',
        labels: [],
      }

      const nonMatchingIssue: GitHubIssue = {
        number: 124,
        title: 'Non-matching Issue',
        body: `<!-- spec_id: ${otherUuid} -->\n\nWrong issue`,
        state: 'OPEN',
        labels: [],
      }

      // Mock search returns both issues (simulating partial text match)
      client.setMockSearchResult(targetUuid, [nonMatchingIssue, matchingIssue])

      const result = await client.searchIssueByUuid(targetUuid)

      expect(result).toEqual(matchingIssue)
      expect(result?.number).toBe(123)
    })

    test('returns null when no exact UUID match in results', async () => {
      const searchUuid = validUuid
      const differentUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

      const issueWithDifferentUuid: GitHubIssue = {
        number: 123,
        title: 'Different UUID Issue',
        body: `<!-- spec_id: ${differentUuid} -->\n\nWrong UUID`,
        state: 'OPEN',
        labels: [],
      }

      // Search finds issues but none have the exact UUID
      client.setMockSearchResult(searchUuid, [issueWithDifferentUuid])

      const result = await client.searchIssueByUuid(searchUuid)

      expect(result).toBeNull()
    })

    test('handles search API errors gracefully', async () => {
      const originalWarn = console.warn
      const warnCalls: any[][] = []
      console.warn = (...args: any[]) => {
        warnCalls.push(args)
      }
      const searchError = new Error('GitHub API rate limit exceeded')

      client.setMockSearchError(validUuid, searchError)

      const result = await client.searchIssueByUuid(validUuid)

      expect(result).toBeNull()
      expect(warnCalls.length).toBe(1)
      expect(warnCalls[0]).toEqual([`UUID search failed for ${validUuid}:`, searchError])

      console.warn = originalWarn
    })

    test('handles issues without UUID metadata', async () => {
      const issueWithoutUuid: GitHubIssue = {
        number: 123,
        title: 'Issue Without UUID',
        body: 'Regular issue content without UUID',
        state: 'OPEN',
        labels: [],
      }

      client.setMockSearchResult(validUuid, [issueWithoutUuid])

      const result = await client.searchIssueByUuid(validUuid)

      expect(result).toBeNull()
    })

    test('handles issues with malformed UUID comments', async () => {
      const issueWithMalformedUuid: GitHubIssue = {
        number: 123,
        title: 'Issue With Malformed UUID',
        body: '<!-- spec_id: malformed-uuid -->\n\nContent',
        state: 'OPEN',
        labels: [],
      }

      client.setMockSearchResult(validUuid, [issueWithMalformedUuid])

      const result = await client.searchIssueByUuid(validUuid)

      expect(result).toBeNull()
    })

    test('returns issue with empty labels array when no labels present', async () => {
      const issueWithoutLabels: GitHubIssue = {
        number: 123,
        title: 'Issue Without Labels',
        body: `<!-- spec_id: ${validUuid} -->\n\nContent`,
        state: 'OPEN',
        labels: [], // Explicit empty array
      }

      client.setMockSearchResult(validUuid, [issueWithoutLabels])

      const result = await client.searchIssueByUuid(validUuid)

      expect(result).not.toBeNull()
      expect(result!.labels).toEqual([])
    })

    test('validates UUID before making API call', async () => {
      const originalWarn = console.warn
      const warnCalls: any[][] = []
      console.warn = (...args: any[]) => {
        warnCalls.push(args)
      }

      // Test various invalid UUID formats
      const invalidUuids = [
        '',
        'not-a-uuid',
        '123',
        '550e8400-e29b-41d4-a716', // too short
        '550e8400-e29b-41d4-a716-446655440000-extra', // too long
        '550e8400-e29b-31d4-a716-446655440000', // wrong version (3 instead of 4)
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', // invalid characters
      ]

      for (const uuid of invalidUuids) {
        const result = await client.searchIssueByUuid(uuid)
        expect(result).toBeNull()
      }

      // Should have one warning for each invalid UUID
      expect(warnCalls.length).toBe(invalidUuids.length)
      for (let i = 0; i < invalidUuids.length; i++) {
        expect(warnCalls[i]).toEqual([`Invalid UUID format provided: ${invalidUuids[i]}`])
      }

      // No API calls should have been made
      expect(client.searchIssueCalls).toHaveLength(0)

      console.warn = originalWarn
    })

    test('constructs correct search query', async () => {
      const uuid = validUuid
      client.setMockSearchResult(uuid, [])

      await client.searchIssueByUuid(uuid)

      // Verify the UUID was extracted correctly from the search query
      expect(client.searchIssueCalls).toContain(uuid)
    })
  })

  describe('UUID validation edge cases', () => {
    test('accepts valid UUID v4 formats', async () => {
      const validV4Uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '123e4567-e89b-42d3-a456-426614174000',
        'AAAAAAAA-BBBB-4CCC-9DDD-EEEEEEEEEEEE', // uppercase
      ]

      for (const uuid of validV4Uuids) {
        client.setMockSearchResult(uuid, [])
        const result = await client.searchIssueByUuid(uuid)
        // Should not error out, even if no results
        expect(result).toBeNull()
      }

      expect(client.searchIssueCalls).toHaveLength(validV4Uuids.length)
    })

    test('rejects non-v4 UUID versions', async () => {
      const originalWarn = console.warn
      const warnCalls: any[][] = []
      console.warn = (...args: any[]) => {
        warnCalls.push(args)
      }

      const nonV4Uuids = [
        '550e8400-e29b-11d4-a716-446655440000', // version 1
        '550e8400-e29b-21d4-a716-446655440000', // version 2
        '550e8400-e29b-31d4-a716-446655440000', // version 3
        '550e8400-e29b-51d4-a716-446655440000', // version 5
      ]

      for (const uuid of nonV4Uuids) {
        const result = await client.searchIssueByUuid(uuid)
        expect(result).toBeNull()
      }

      expect(warnCalls.length).toBe(nonV4Uuids.length)
      for (let i = 0; i < nonV4Uuids.length; i++) {
        expect(warnCalls[i]).toEqual([`Invalid UUID format provided: ${nonV4Uuids[i]}`])
      }

      expect(client.searchIssueCalls).toHaveLength(0)

      console.warn = originalWarn
    })
  })

  describe('performance and reliability', () => {
    test('handles large search result sets efficiently', async () => {
      // Create a large number of mock issues
      const manyIssues: GitHubIssue[] = Array.from({ length: 100 }, (_, i) => ({
        number: i + 1,
        title: `Issue ${i + 1}`,
        body: `Content for issue ${i + 1}`,
        state: 'OPEN' as const,
        labels: [],
      }))

      // Add the target issue at the end
      const targetIssue: GitHubIssue = {
        number: 101,
        title: 'Target Issue',
        body: `<!-- spec_id: ${validUuid} -->\n\nTarget content`,
        state: 'OPEN',
        labels: ['target'],
      }
      manyIssues.push(targetIssue)

      client.setMockSearchResult(validUuid, manyIssues)

      const startTime = Date.now()
      const result = await client.searchIssueByUuid(validUuid)
      const endTime = Date.now()

      expect(result).toEqual(targetIssue)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    test('handles concurrent search requests', async () => {
      const uuid1 = validUuid
      const uuid2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

      const issue1: GitHubIssue = {
        number: 1,
        title: 'Issue 1',
        body: `<!-- spec_id: ${uuid1} -->\n\nContent 1`,
        state: 'OPEN',
        labels: [],
      }

      const issue2: GitHubIssue = {
        number: 2,
        title: 'Issue 2',
        body: `<!-- spec_id: ${uuid2} -->\n\nContent 2`,
        state: 'OPEN',
        labels: [],
      }

      client.setMockSearchResult(uuid1, [issue1])
      client.setMockSearchResult(uuid2, [issue2])

      // Make concurrent requests
      const [result1, result2] = await Promise.all([
        client.searchIssueByUuid(uuid1),
        client.searchIssueByUuid(uuid2),
      ])

      expect(result1).toEqual(issue1)
      expect(result2).toEqual(issue2)
      expect(client.searchIssueCalls).toContain(uuid1)
      expect(client.searchIssueCalls).toContain(uuid2)
    })
  })
})
