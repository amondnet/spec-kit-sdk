import type { SpecDocument, SpecFile } from '../../src/types/index.js'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { GitHubAdapter } from '../../src/adapters/github/github.adapter.js'
import { EnhancedMockGitHubClient } from '../mocks/github-client.mock.js'
import { MockSpecToIssueMapper } from '../mocks/spec-mapper.mock.js'

describe('GitHubAdapter - Comprehensive Tests', () => {
  let adapter: GitHubAdapter
  let mockClient: EnhancedMockGitHubClient
  let mockMapper: MockSpecToIssueMapper

  beforeEach(() => {
    mockClient = new EnhancedMockGitHubClient('test-owner', 'test-repo')
    mockMapper = MockSpecToIssueMapper.createRealisticMocks()

    adapter = new GitHubAdapter({
      owner: 'test-owner',
      repo: 'test-repo',
      labels: {
        spec: 'speckit:spec',
        common: 'speckit',
      },
    })

    // Replace private dependencies with mocks
    // @ts-expect-error - accessing private property for testing
    adapter.client = mockClient
    // @ts-expect-error - accessing private property for testing
    adapter.mapper = mockMapper
  })

  afterEach(() => {
    mockClient.reset()
    mockMapper.reset()
  })

  describe('Constructor and Configuration', () => {
    test('should initialize with correct configuration', () => {
      const testAdapter = new GitHubAdapter({
        owner: 'my-org',
        repo: 'my-repo',
        auth: 'token123',
        labels: { common: 'test' },
        assignees: ['user1', 'user2'],
      })

      expect(testAdapter.platform).toBe('github')

      // @ts-expect-error - accessing private property for testing
      expect(testAdapter.config.owner).toBe('my-org')
      // @ts-expect-error - accessing private property for testing
      expect(testAdapter.config.repo).toBe('my-repo')
      // @ts-expect-error - accessing private property for testing
      expect(testAdapter.config.auth).toBe('token123')
    })

    test('should handle assignee and assignees config', () => {
      const testAdapter1 = new GitHubAdapter({
        owner: 'test',
        repo: 'test',
        assignee: 'single-user',
      })

      const testAdapter2 = new GitHubAdapter({
        owner: 'test',
        repo: 'test',
        assignees: ['user1', 'user2'],
      })

      // @ts-expect-error - accessing private property for testing
      expect(testAdapter1.config.assignee).toBe('single-user')
      // @ts-expect-error - accessing private property for testing
      expect(testAdapter2.config.assignees).toEqual(['user1', 'user2'])
    })
  })

  describe('Authentication', () => {
    test('should authenticate successfully', async () => {
      mockClient.setMockAuthResult(true)

      const result = await adapter.authenticate()

      expect(result).toBe(true)
      expect(mockClient.checkAuthCalls).toBe(1)
    })

    test('should handle authentication failure', async () => {
      mockClient.setMockAuthResult(false)

      const result = await adapter.authenticate()

      expect(result).toBe(false)
      expect(mockClient.checkAuthCalls).toBe(1)
    })

    test('should handle auth check errors', async () => {
      const authError = new Error('Auth check failed')
      mockClient.setMethodError('checkAuth', authError)

      await expect(adapter.authenticate()).rejects.toThrow('Auth check failed')
    })

    test('checkAuth should delegate to client', async () => {
      mockClient.setMockAuthResult(true)

      const result = await adapter.checkAuth()

      expect(result).toBe(true)
      expect(mockClient.checkAuthCalls).toBe(1)
    })
  })

  describe('Push Operations', () => {
    test('should create new issue when no issue_number exists', async () => {
      const spec = createMockSpec('test-feature', { withIssueNumber: false })
      mockClient.setMockCreateIssueResult(123)

      const result = await adapter.push(spec)

      expect(result).toEqual({
        id: 123,
        type: 'parent',
        url: 'https://github.com/test-owner/test-repo/issues/123',
      })

      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0]?.title).toBe('Feature Specification: Test Feature')
      expect(mockClient.createIssueCalls[0]?.labels).toEqual(['speckit', 'speckit:spec'])
      expect(mockClient.createIssueCalls[0]?.body).toContain('# test-feature')
      expect(mockClient.createIssueCalls[0]?.body).toContain('**Spec:** `test-feature`')

      expect(mockClient.ensureLabelsExistCalls).toHaveLength(1)
      expect(mockClient.ensureLabelsExistCalls[0]).toEqual(['speckit', 'speckit:spec'])

      expect(mockMapper.generateTitleCalls).toHaveLength(1)
      expect(mockMapper.generateBodyCalls).toHaveLength(1)
    })

    test('should update existing issue when issue_number exists', async () => {
      const spec = createMockSpec('test-feature', { withIssueNumber: true, issueNumber: 456 })

      const result = await adapter.push(spec)

      expect(result).toEqual({
        id: 456,
        type: 'parent',
        url: 'https://github.com/test-owner/test-repo/issues/456',
      })

      expect(mockClient.updateIssueCalls).toHaveLength(1)
      expect(mockClient.updateIssueCalls[0]?.number).toBe(456)
      expect(mockClient.updateIssueCalls[0]?.updates.title).toBe('Feature Specification: Test Feature')
      expect(mockClient.updateIssueCalls[0]?.updates.body).toContain('# test-feature')
      expect(mockClient.updateIssueCalls[0]?.updates.body).toContain('**Spec:** `test-feature`')

      expect(mockClient.createIssueCalls).toHaveLength(0)
    })

    test('should force create new issue when force option is true', async () => {
      const spec = createMockSpec('test-feature', { withIssueNumber: true, issueNumber: 456 })
      mockClient.setMockCreateIssueResult(789)

      const result = await adapter.push(spec, { force: true })

      expect(result.id).toBe(789)
      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.updateIssueCalls).toHaveLength(0)
    })

    test('should throw error when spec.md is missing', async () => {
      const spec: SpecDocument = {
        name: 'missing-spec',
        path: 'specs/missing-spec',
        files: new Map(),
      }

      await expect(adapter.push(spec)).rejects.toThrow('No spec.md file found in missing-spec')
    })

    test('should create subtasks when capabilities support it', async () => {
      const spec = createMockSpecWithSubtasks('feature-with-subtasks')
      mockClient.setMockCreateIssueResult(100)

      await adapter.push(spec)

      expect(mockClient.createIssueCalls).toHaveLength(1) // Main issue
      expect(mockClient.createSubtaskCalls).toHaveLength(2) // plan.md, research.md

      expect(mockClient.createSubtaskCalls[0]?.parentNumber).toBe(100)
      expect(mockClient.createSubtaskCalls[1]?.parentNumber).toBe(100)
    })

    test('should handle push errors gracefully', async () => {
      const spec = createMockSpec('error-spec')
      const pushError = new Error('GitHub API error')
      mockClient.setMethodError('createIssue', pushError)

      await expect(adapter.push(spec)).rejects.toThrow('GitHub API error')
    })
  })

  describe('Pull Operations', () => {
    test('should pull and convert issue to spec', async () => {
      const mockIssue = {
        number: 123,
        title: 'Feature Specification: User Auth',
        body: '# User Authentication\n\nImplement user auth...',
        state: 'OPEN' as const,
        labels: ['spec'],
      }

      mockClient.setMockIssue(123, mockIssue)

      const result = await adapter.pull({ id: 123, type: 'parent' })

      expect(mockClient.getIssueCalls).toContain(123)
      expect(mockMapper.issueToSpecCalls).toHaveLength(1)
      expect(mockMapper.issueToSpecCalls[0]).toEqual(mockIssue)

      expect(result.name).toBe('feature-specification-user-auth')
      expect(result.files.has('spec.md')).toBe(true)
    })

    test('should throw error when issue not found', async () => {
      await expect(adapter.pull({ id: 999, type: 'parent' })).rejects.toThrow('Issue #999 not found')

      expect(mockClient.getIssueCalls).toContain(999)
    })

    test('should handle pull errors', async () => {
      const pullError = new Error('Failed to fetch issue')
      mockClient.setMethodError('getIssue', pullError)

      await expect(adapter.pull({ id: 123, type: 'parent' })).rejects.toThrow('Failed to fetch issue')
    })
  })

  describe('Subtask Operations', () => {
    test('should create subtask with correct labels', async () => {
      const parentRef = { id: 100, type: 'parent' as const }
      mockClient.setMockCreateSubtaskResult(200)

      const result = await adapter.createSubtask(parentRef, 'Plan Title', 'Plan body', 'plan')

      expect(result).toEqual({
        id: 200,
        type: 'subtask',
        url: 'https://github.com/test-owner/test-repo/issues/200',
      })

      expect(mockClient.createSubtaskCalls).toHaveLength(1)
      expect(mockClient.createSubtaskCalls[0]).toEqual({
        parentNumber: 100,
        title: 'Plan Title',
        body: 'Plan body',
        labels: ['speckit', 'plan'],
      })

      expect(mockClient.ensureLabelsExistCalls).toHaveLength(1)
    })

    test('should get subtasks for parent', async () => {
      mockClient.setMockSubtasks(100, [200, 201, 202])

      const result = await adapter.getSubtasks({ id: 100, type: 'parent' })

      expect(result).toHaveLength(3)
      expect(result).toEqual([
        { id: 200, type: 'subtask', url: 'https://github.com/test-owner/test-repo/issues/200' },
        { id: 201, type: 'subtask', url: 'https://github.com/test-owner/test-repo/issues/201' },
        { id: 202, type: 'subtask', url: 'https://github.com/test-owner/test-repo/issues/202' },
      ])

      expect(mockClient.getSubtasksCalls).toContain(100)
    })

    test('should return empty array when no subtasks', async () => {
      const result = await adapter.getSubtasks({ id: 999, type: 'parent' })

      expect(result).toEqual([])
      expect(mockClient.getSubtasksCalls).toContain(999)
    })
  })

  describe('Issue Management Operations', () => {
    test('should add comment to issue', async () => {
      const ref = { id: 123, type: 'parent' as const }

      await adapter.addComment(ref, 'This is a test comment')

      expect(mockClient.addCommentCalls).toHaveLength(1)
      expect(mockClient.addCommentCalls[0]).toEqual({
        issueNumber: 123,
        body: 'This is a test comment',
      })
    })

    test('should close issue', async () => {
      const ref = { id: 123, type: 'parent' as const }

      await adapter.close(ref)

      expect(mockClient.closeIssueCalls).toContain(123)
    })

    test('should reopen issue', async () => {
      const ref = { id: 123, type: 'parent' as const }

      await adapter.reopen(ref)

      expect(mockClient.reopenIssueCalls).toContain(123)
    })
  })

  describe('Capabilities', () => {
    test('should return correct capabilities', () => {
      const capabilities = adapter.capabilities()

      expect(capabilities).toEqual({
        supportsBatch: true,
        supportsSubtasks: true,
        supportsLabels: true,
        supportsAssignees: true,
        supportsMilestones: true,
        supportsComments: true,
        supportsConflictResolution: true,
      })
    })
  })
})

// Helper functions
function createMockSpec(name: string, options: { withIssueNumber?: boolean, issueNumber?: number } = {}): SpecDocument {
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

  const specFile: SpecFile = {
    path: `specs/${name}/spec.md`,
    filename: 'spec.md',
    frontmatter,
    content: `# ${name}\n\nThis is a test spec.`,
    markdown: `# ${name}\n\nThis is a test spec.`,
  }

  return {
    name,
    path: `specs/${name}`,
    files: new Map([['spec.md', specFile]]),
  }
}

function createMockSpecWithSubtasks(name: string): SpecDocument {
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

  const planFile: SpecFile = {
    path: `specs/${name}/plan.md`,
    filename: 'plan.md',
    frontmatter: {
      issue_type: 'subtask',
      sync_status: 'draft',
      auto_sync: true,
    },
    content: `# Plan for ${name}\n\nImplementation plan.`,
    markdown: `# Plan for ${name}\n\nImplementation plan.`,
  }

  const researchFile: SpecFile = {
    path: `specs/${name}/research.md`,
    filename: 'research.md',
    frontmatter: {
      issue_type: 'subtask',
      sync_status: 'draft',
      auto_sync: true,
    },
    content: `# Research for ${name}\n\nResearch findings.`,
    markdown: `# Research for ${name}\n\nResearch findings.`,
  }

  return {
    name,
    path: `specs/${name}`,
    files: new Map([
      ['spec.md', specFile],
      ['plan.md', planFile],
      ['research.md', researchFile],
    ]),
  }
}
