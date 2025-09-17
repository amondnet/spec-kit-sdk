import type { SpecDocument, SpecFile } from '../../src/types/index.js'
import { beforeEach, describe, expect, test } from 'bun:test'
import { GitHubAdapter } from '../../src/adapters/github/github.adapter.js'
import { embedUuidInIssueBody } from '../../src/adapters/github/uuid-utils.js'
import { EnhancedMockGitHubClient } from '../mocks/github-client.mock.js'

describe('GitHubAdapter UUID-first matching', () => {
  let adapter: GitHubAdapter
  let mockClient: EnhancedMockGitHubClient

  beforeEach(() => {
    mockClient = new EnhancedMockGitHubClient()
    adapter = new GitHubAdapter({
      owner: 'test-owner',
      repo: 'test-repo',
    })

    // Replace the client with our mock
    // @ts-expect-error - accessing private property for testing
    adapter.client = mockClient
  })

  describe('UUID-first matching in push()', () => {
    test('should find existing issue by UUID when spec_id is present', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const existingIssueNumber = 123

      // Create a mock issue with embedded UUID
      const issueBody = embedUuidInIssueBody('Existing issue body', uuid)
      mockClient.setMockIssue(existingIssueNumber, {
        number: existingIssueNumber,
        title: 'Existing Issue',
        body: issueBody,
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpec = createMockSpecWithUuid('test-feature', uuid)

      const result = await adapter.push(mockSpec)

      // Should have searched by UUID
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.searchIssueByUuidCalls[0]).toBe(uuid)

      // Should have updated the existing issue
      expect(mockClient.updateIssueCalls).toHaveLength(1)
      expect(mockClient.updateIssueCalls[0]?.number).toBe(existingIssueNumber)

      // Should not have created a new issue
      expect(mockClient.createIssueCalls).toHaveLength(0)

      // Should return the existing issue
      expect(result.id).toBe(existingIssueNumber)
    })

    test('should fallback to issue_number when UUID search finds nothing', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const issueNumber = 456

      // Create a mock issue without UUID (fallback scenario)
      mockClient.setMockIssue(issueNumber, {
        number: issueNumber,
        title: 'Existing Issue',
        body: 'Regular issue body without UUID',
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpec = createMockSpecWithUuidAndIssueNumber('test-feature', uuid, issueNumber)

      const result = await adapter.push(mockSpec)

      // Should have searched by UUID first
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.searchIssueByUuidCalls[0]).toBe(uuid)

      // Should have fallen back to getIssue
      expect(mockClient.getIssueCalls).toHaveLength(1)
      expect(mockClient.getIssueCalls[0]).toBe(issueNumber)

      // Should have updated the existing issue
      expect(mockClient.updateIssueCalls).toHaveLength(1)
      expect(mockClient.updateIssueCalls[0]?.number).toBe(issueNumber)

      // Should not have created a new issue
      expect(mockClient.createIssueCalls).toHaveLength(0)

      expect(result.id).toBe(issueNumber)
    })

    test('should detect UUID mismatch and throw error', async () => {
      const localUuid = '550e8400-e29b-41d4-a716-446655440000'
      const remoteUuid = '550e8400-e29b-41d4-a716-446655440001'
      const issueNumber = 789

      // Create a mock issue with different UUID
      const issueBody = embedUuidInIssueBody('Remote issue body', remoteUuid)
      mockClient.setMockIssue(issueNumber, {
        number: issueNumber,
        title: 'Remote Issue',
        body: issueBody,
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpec = createMockSpecWithUuidAndIssueNumber('test-feature', localUuid, issueNumber)

      await expect(adapter.push(mockSpec)).rejects.toThrow(
        /UUID mismatch: local spec_id=550e8400-e29b-41d4-a716-446655440000, remote spec_id=550e8400-e29b-41d4-a716-446655440001/,
      )

      // Should have searched by UUID first (found nothing)
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.searchIssueByUuidCalls[0]).toBe(localUuid)

      // Should have fallen back to getIssue
      expect(mockClient.getIssueCalls).toHaveLength(1)
      expect(mockClient.getIssueCalls[0]).toBe(issueNumber)

      // Should not have updated or created anything due to error
      expect(mockClient.updateIssueCalls).toHaveLength(0)
      expect(mockClient.createIssueCalls).toHaveLength(0)
    })

    test('should create new issue with embedded UUID when no existing issue found', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const newIssueNumber = 100

      mockClient.setMockCreateIssueResult(newIssueNumber)

      const mockSpec = createMockSpecWithUuid('test-feature', uuid)

      const result = await adapter.push(mockSpec)

      // Should have searched by UUID
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.searchIssueByUuidCalls[0]).toBe(uuid)

      // Should have created a new issue
      expect(mockClient.createIssueCalls).toHaveLength(1)

      // The created issue body should contain the embedded UUID
      const createCall = mockClient.createIssueCalls[0]
      expect(createCall?.body).toContain(`<!-- spec_id: ${uuid} -->`)

      // Should not have updated anything
      expect(mockClient.updateIssueCalls).toHaveLength(0)

      expect(result.id).toBe(newIssueNumber)
    })

    test('should work without UUID (legacy behavior)', async () => {
      const issueNumber = 654
      const newIssueNumber = 101

      // Test case 1: Update existing issue without UUID
      mockClient.setMockIssue(issueNumber, {
        number: issueNumber,
        title: 'Existing Issue',
        body: 'Regular issue body',
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpecWithIssueNumber = createMockSpecWithIssueNumber('test-feature', issueNumber)

      const result1 = await adapter.push(mockSpecWithIssueNumber)

      // Should not have searched by UUID (no UUID provided)
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(0)

      // Should have used getIssue directly
      expect(mockClient.getIssueCalls).toHaveLength(1)
      expect(mockClient.getIssueCalls[0]).toBe(issueNumber)

      expect(result1.id).toBe(issueNumber)

      // Reset for next test
      mockClient.reset()
      mockClient.setMockCreateIssueResult(newIssueNumber)

      // Test case 2: Create new issue without UUID
      const mockSpecWithoutIdentifiers = createMockSpec('new-feature')

      const result2 = await adapter.push(mockSpecWithoutIdentifiers)

      // Should not have searched by UUID
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(0)

      // Should have created a new issue
      expect(mockClient.createIssueCalls).toHaveLength(1)

      // The created issue body should NOT contain UUID comments
      const createCall = mockClient.createIssueCalls[0]
      expect(createCall?.body).not.toContain('<!-- spec_id:')

      expect(result2.id).toBe(newIssueNumber)
    })

    test('should force update even when UUID mismatch exists', async () => {
      const localUuid = '550e8400-e29b-41d4-a716-446655440000'
      const remoteUuid = '550e8400-e29b-41d4-a716-446655440001'
      const issueNumber = 789

      // Create a mock issue with different UUID
      const issueBody = embedUuidInIssueBody('Remote issue body', remoteUuid)
      mockClient.setMockIssue(issueNumber, {
        number: issueNumber,
        title: 'Remote Issue',
        body: issueBody,
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpec = createMockSpecWithUuidAndIssueNumber('test-feature', localUuid, issueNumber)

      // Force push should work despite UUID mismatch - creates new issue when force=true
      const result = await adapter.push(mockSpec, { force: true })

      // Should still have checked UUIDs
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.getIssueCalls).toHaveLength(1)

      // Should have created a new issue (force mode bypasses mismatch validation and existing issue)
      expect(mockClient.createIssueCalls).toHaveLength(1)

      // Should not have updated the existing issue
      expect(mockClient.updateIssueCalls).toHaveLength(0)

      expect(result.id).toBe(100) // Default mock creation ID
    })
  })

  describe('UUID-first matching in getStatus()', () => {
    test('should find issue by UUID for status check', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const issueNumber = 123

      // Create a mock issue with embedded UUID
      const issueBody = embedUuidInIssueBody('Existing issue body', uuid)
      mockClient.setMockIssue(issueNumber, {
        number: issueNumber,
        title: 'Existing Issue',
        body: issueBody,
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpec = createMockSpecWithUuid('test-feature', uuid)
      // Set sync hash to match the hash calculation and provide last_sync to avoid hasRemoteChanges
      const mainFile = mockSpec.files.get('spec.md')!
      const crypto = await import('node:crypto')
      const contentHash = crypto
        .createHash('sha256')
        .update(mainFile.markdown)
        .digest('hex')
        .substring(0, 8)
      mainFile.frontmatter.sync_hash = contentHash
      mainFile.frontmatter.last_sync = new Date().toISOString()

      const status = await adapter.getStatus(mockSpec)

      // Should have searched by UUID
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.searchIssueByUuidCalls[0]).toBe(uuid)

      // Should have found the issue
      expect(status.status).toBe('synced')
      expect(status.remoteId).toBe(issueNumber)
    })

    test('should detect UUID mismatch in status check', async () => {
      const localUuid = '550e8400-e29b-41d4-a716-446655440000'
      const remoteUuid = '550e8400-e29b-41d4-a716-446655440001'
      const issueNumber = 456

      // Create a mock issue with different UUID
      const issueBody = embedUuidInIssueBody('Remote issue body', remoteUuid)
      mockClient.setMockIssue(issueNumber, {
        number: issueNumber,
        title: 'Remote Issue',
        body: issueBody,
        state: 'OPEN',
        labels: ['spec'],
      })

      const mockSpec = createMockSpecWithUuidAndIssueNumber('test-feature', localUuid, issueNumber)

      const status = await adapter.getStatus(mockSpec)

      // Should have detected UUID mismatch
      expect(status.status).toBe('conflict')
      expect(status.conflicts).toContain(`UUID mismatch: local=${localUuid}, remote=${remoteUuid}`)
      expect(status.remoteId).toBe(issueNumber)
    })

    test('should return draft status when no issue found', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'

      const mockSpec = createMockSpecWithUuid('test-feature', uuid)

      const status = await adapter.getStatus(mockSpec)

      // Should have searched by UUID
      expect(mockClient.searchIssueByUuidCalls).toHaveLength(1)
      expect(mockClient.searchIssueByUuidCalls[0]).toBe(uuid)

      // Should return draft status
      expect(status.status).toBe('draft')
      expect(status.hasChanges).toBe(true)
      expect(status.remoteId).toBeUndefined()
    })
  })
})

// Helper functions
function createMockSpec(name: string): SpecDocument {
  const specFile: SpecFile = {
    path: `specs/${name}/spec.md`,
    filename: 'spec.md',
    frontmatter: {
      issue_type: 'parent',
      sync_status: 'draft',
      auto_sync: true,
    },
    content: `# ${name}\n\nThis is a test spec.`,
    markdown: `# ${name}\n\nThis is a test spec.`,
  }

  return {
    name,
    path: `specs/${name}`,
    files: new Map([['spec.md', specFile]]),
  }
}

function createMockSpecWithUuid(name: string, uuid: string): SpecDocument {
  const spec = createMockSpec(name)
  const mainFile = spec.files.get('spec.md')!
  mainFile.frontmatter.spec_id = uuid
  return spec
}

function createMockSpecWithIssueNumber(name: string, issueNumber: number): SpecDocument {
  const spec = createMockSpec(name)
  const mainFile = spec.files.get('spec.md')!
  mainFile.frontmatter.github = { issue_number: issueNumber }
  return spec
}

function createMockSpecWithUuidAndIssueNumber(name: string, uuid: string, issueNumber: number): SpecDocument {
  const spec = createMockSpec(name)
  const mainFile = spec.files.get('spec.md')!
  mainFile.frontmatter.spec_id = uuid
  mainFile.frontmatter.github = { issue_number: issueNumber }
  return spec
}
