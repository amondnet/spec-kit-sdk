import { beforeEach, describe, expect, test } from 'bun:test'
import type { SpecDocument, SpecFile } from '../../src/types/index.js'
import { GitHubAdapter } from '../../src/adapters/github/github.adapter.js'

// Mock GitHub client
class MockGitHubClient {
  public createIssueCalls: Array<{ title: string, body: string, labels: string[] }> = []
  public createSubtaskCalls: Array<{ parentNumber: number, title: string, body: string, labels?: string[] }> = []

  async createIssue(title: string, body: string, labels: string[]): Promise<number> {
    this.createIssueCalls.push({ title, body, labels })
    return 123 // Mock issue number
  }

  async createSubtask(parentNumber: number, title: string, body: string, labels?: string[]): Promise<number> {
    this.createSubtaskCalls.push({ parentNumber, title, body, labels })
    return 124 // Mock subtask number
  }

  async checkAuth(): Promise<boolean> {
    return true
  }

  async updateIssue(): Promise<void> {
    // Mock implementation
  }

  async getIssue(): Promise<any> {
    return null
  }

  reset(): void {
    this.createIssueCalls = []
    this.createSubtaskCalls = []
  }
}

describe('GitHubAdapter', () => {
  let adapter: GitHubAdapter
  let mockClient: MockGitHubClient

  beforeEach(() => {
    mockClient = new MockGitHubClient()
  })

  describe('Label configuration', () => {
    test('should use default labels when no config provided', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
      })

      // Replace the client with our mock
      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpec = createMockSpec('test-feature')

      await adapter.push(mockSpec)

      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0].labels).toEqual(['spec'])
    })

    test('should use single string label from config', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: 'speckit:spec',
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpec = createMockSpec('test-feature')

      await adapter.push(mockSpec)

      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0].labels).toEqual(['speckit:spec'])
    })

    test('should use array labels from config', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: ['speckit', 'spec', 'feature'],
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpec = createMockSpec('test-feature')

      await adapter.push(mockSpec)

      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0].labels).toEqual(['speckit', 'spec', 'feature'])
    })

    test('should combine common labels with document type labels', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: 'spec',
          common: 'speckit',
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpec = createMockSpec('test-feature')

      await adapter.push(mockSpec)

      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0].labels).toEqual(['speckit', 'spec'])
    })

    test('should combine common array labels with document type labels', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: ['spec', 'feature'],
          common: ['speckit', 'epic'],
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpec = createMockSpec('test-feature')

      await adapter.push(mockSpec)

      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0].labels).toEqual(['speckit', 'epic', 'spec', 'feature'])
    })

    test('should handle missing document type in config', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          plan: 'plan',
          common: 'speckit',
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpec = createMockSpec('test-feature')

      await adapter.push(mockSpec)

      expect(mockClient.createIssueCalls).toHaveLength(1)
      // Should fallback to the fileType 'spec' when not in config
      expect(mockClient.createIssueCalls[0].labels).toEqual(['speckit', 'spec'])
    })
  })

  describe('Subtask label configuration', () => {
    test('should use correct labels for different subtask types', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: 'speckit:spec',
          plan: 'speckit:plan',
          research: 'speckit:research',
          task: 'speckit:task',
          common: 'speckit',
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      // Test createSubtask method with different file types
      await adapter.createSubtask({ id: 123, type: 'parent' }, 'Plan Title', 'Plan Body', 'plan')
      await adapter.createSubtask({ id: 123, type: 'parent' }, 'Research Title', 'Research Body', 'research')
      await adapter.createSubtask({ id: 123, type: 'parent' }, 'Task Title', 'Task Body', 'task')

      expect(mockClient.createSubtaskCalls).toHaveLength(3)

      // Plan subtask
      expect(mockClient.createSubtaskCalls[0].labels).toEqual(['speckit', 'speckit:plan'])

      // Research subtask
      expect(mockClient.createSubtaskCalls[1].labels).toEqual(['speckit', 'speckit:research'])

      // Task subtask
      expect(mockClient.createSubtaskCalls[2].labels).toEqual(['speckit', 'speckit:task'])
    })

    test('should handle subtask creation during spec push', async () => {
      adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: 'speckit:spec',
          plan: 'speckit:plan',
          research: 'speckit:research',
          common: 'speckit',
        },
      })

      // @ts-expect-error - accessing private property for testing
      adapter.client = mockClient

      const mockSpecWithSubtasks = createMockSpecWithSubtasks('test-feature')

      await adapter.push(mockSpecWithSubtasks)

      // Should create main issue + subtasks
      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createSubtaskCalls).toHaveLength(2) // plan.md and research.md

      // Main spec issue
      expect(mockClient.createIssueCalls[0].labels).toEqual(['speckit', 'speckit:spec'])

      // Plan subtask
      expect(mockClient.createSubtaskCalls[0].labels).toEqual(['speckit', 'speckit:plan'])

      // Research subtask
      expect(mockClient.createSubtaskCalls[1].labels).toEqual(['speckit', 'speckit:research'])
    })
  })

  describe('getLabels method', () => {
    test('should return correct labels for various configurations', () => {
      const testCases = [
        {
          config: { spec: 'spec' },
          fileType: 'spec',
          expected: ['spec'],
        },
        {
          config: { spec: 'speckit:spec', common: 'speckit' },
          fileType: 'spec',
          expected: ['speckit', 'speckit:spec'],
        },
        {
          config: { spec: ['spec', 'feature'], common: ['speckit', 'epic'] },
          fileType: 'spec',
          expected: ['speckit', 'epic', 'spec', 'feature'],
        },
        {
          config: { plan: 'plan' },
          fileType: 'spec', // not in config
          expected: ['spec'], // fallback to fileType
        },
        {
          config: {},
          fileType: 'research',
          expected: ['research'], // fallback to fileType
        },
      ]

      testCases.forEach(({ config, fileType, expected }) => {
        const adapter = new GitHubAdapter({
          owner: 'test-owner',
          repo: 'test-repo',
          labels: config,
        })

        // @ts-expect-error - accessing private method for testing
        const result = adapter.getLabels(fileType)
        expect(result).toEqual(expected)
      })
    })
  })

  describe('normalizeLabels method', () => {
    test('should normalize different label formats', () => {
      const adapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
      })

      // @ts-expect-error - accessing private method for testing
      expect(adapter.normalizeLabels('single')).toEqual(['single'])

      // @ts-expect-error - accessing private method for testing
      expect(adapter.normalizeLabels(['multiple', 'labels'])).toEqual(['multiple', 'labels'])

      // @ts-expect-error - accessing private method for testing
      expect(adapter.normalizeLabels(undefined)).toEqual([])

      // @ts-expect-error - accessing private method for testing
      expect(adapter.normalizeLabels(null)).toEqual([])
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