import type { SpecDocument, SpecFile } from '../../src/types/index.js'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { GitHubAdapter } from '../../src/adapters/github/github.adapter.js'
import { EnhancedMockGitHubClient } from '../mocks/github-client.mock.js'
import { MockSpecToIssueMapper } from '../mocks/spec-mapper.mock.js'

describe('GitHubAdapter - Batch Operations', () => {
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
      assignees: ['default-assignee'],
    })

    // @ts-expect-error - accessing private property for testing
    adapter.client = mockClient
    // @ts-expect-error - accessing private property for testing
    adapter.mapper = mockMapper
  })

  afterEach(() => {
    mockClient.reset()
    mockMapper.reset()
  })

  describe('pushBatch', () => {
    test('should handle mixed create and update operations', async () => {
      // Create specs: some with issue numbers (updates), some without (creates)
      const createSpecs = [
        createMockSpec('new-feature-1'),
        createMockSpec('new-feature-2'),
      ]

      const updateSpecs = [
        createMockSpec('existing-feature-1', { withIssueNumber: true, issueNumber: 100 }),
        createMockSpec('existing-feature-2', { withIssueNumber: true, issueNumber: 101 }),
      ]

      // Set up mock issues for the update specs
      updateSpecs.forEach((spec) => {
        const mainFile = spec.files.get('spec.md')!
        const issueNumber = mainFile.frontmatter.github?.issue_number
        if (issueNumber) {
          const uuid = mainFile.frontmatter.spec_id
          mockClient.setMockIssueWithUuid(issueNumber, `Feature: ${spec.name}`, uuid, 'Existing content')
        }
      })

      const allSpecs = [...createSpecs, ...updateSpecs]

      const results = await adapter.pushBatch(allSpecs)

      expect(results).toHaveLength(4)

      // Check create operations
      expect(mockClient.createIssueCalls).toHaveLength(2)
      expect(mockClient.createIssueCalls[0]?.title).toBe('Feature Specification: New Feature 1')
      expect(mockClient.createIssueCalls[1]?.title).toBe('Feature Specification: New Feature 2')

      // Check update operations
      expect(mockClient.updateIssueCalls).toHaveLength(2)
      expect(mockClient.updateIssueCalls[0]?.number).toBe(100)
      expect(mockClient.updateIssueCalls[1]?.number).toBe(101)

      // Verify batch update was called for existing issues
      expect(mockClient.batchUpdateIssuesCalls).toHaveLength(1)
      expect(mockClient.batchUpdateIssuesCalls[0]).toEqual({
        numbers: [100, 101],
        options: {
          labels: ['speckit', 'speckit:spec'],
          assignees: ['default-assignee'],
        },
      })

      // Verify labels were ensured to exist
      expect(mockClient.ensureLabelsExistCalls.length).toBeGreaterThan(0)
    })

    test('should handle only create operations', async () => {
      const createSpecs = [
        createMockSpec('new-feature-1'),
        createMockSpec('new-feature-2'),
        createMockSpec('new-feature-3'),
      ]

      const results = await adapter.pushBatch(createSpecs)

      expect(results).toHaveLength(3)
      expect(mockClient.createIssueCalls).toHaveLength(3)
      expect(mockClient.updateIssueCalls).toHaveLength(0)
      expect(mockClient.batchUpdateIssuesCalls).toHaveLength(0)

      // Labels should be ensured once before creating any issues
      expect(mockClient.ensureLabelsExistCalls).toHaveLength(1)
    })

    test('should handle only update operations', async () => {
      const updateSpecs = [
        createMockSpec('existing-1', { withIssueNumber: true, issueNumber: 200 }),
        createMockSpec('existing-2', { withIssueNumber: true, issueNumber: 201 }),
      ]

      // Set up mock issues with UUIDs for UUID-first matching
      updateSpecs.forEach((spec) => {
        const specFile = spec.files.get('spec.md')
        const uuid = specFile?.frontmatter.spec_id
        const issueNumber = specFile?.frontmatter.github?.issue_number
        if (uuid && issueNumber) {
          mockClient.setMockIssue(issueNumber, {
            number: issueNumber,
            title: 'Old Title',
            body: `<!-- spec_id: ${uuid} -->\n\nOld body`,
            state: 'OPEN',
            labels: [],
          })
        }
      })

      const results = await adapter.pushBatch(updateSpecs)

      expect(results).toHaveLength(2)
      expect(mockClient.createIssueCalls).toHaveLength(0)
      expect(mockClient.updateIssueCalls).toHaveLength(2)

      // Batch update should be called
      expect(mockClient.batchUpdateIssuesCalls).toHaveLength(1)
      expect(mockClient.batchUpdateIssuesCalls[0]?.numbers).toEqual([200, 201])
    })

    test('should skip batch update when no common fields to update', async () => {
      // Configure adapter without assignees or labels
      const simpleAdapter = new GitHubAdapter({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: {
          spec: [], // No labels for spec
          common: [], // No common labels
        },
        assignees: [], // No assignees
      })

      // @ts-expect-error - accessing private property for testing
      simpleAdapter.client = mockClient
      // @ts-expect-error - accessing private property for testing
      simpleAdapter.mapper = mockMapper

      const updateSpecs = [
        createMockSpec('existing-1', { withIssueNumber: true, issueNumber: 300 }),
      ]

      // Set up mock issue with UUID for UUID-first matching
      const specFile = updateSpecs[0].files.get('spec.md')
      const uuid = specFile?.frontmatter.spec_id
      if (uuid) {
        mockClient.setMockIssue(300, {
          number: 300,
          title: 'Old Title',
          body: `<!-- spec_id: ${uuid} -->\n\nOld body`,
          state: 'OPEN',
          labels: [],
        })
      }

      const results = await simpleAdapter.pushBatch(updateSpecs)

      expect(results).toHaveLength(1)
      expect(mockClient.batchUpdateIssuesCalls).toHaveLength(0) // No batch update when no common fields
      expect(mockClient.updateIssueCalls).toHaveLength(1) // Individual update only
    })

    test('should handle concurrent limiting for create operations', async () => {
      // Create many specs to test concurrency limiting
      const manySpecs = Array.from({ length: 10 }, (_, i) =>
        createMockSpec(`feature-${i}`))

      const results = await adapter.pushBatch(manySpecs)

      expect(results).toHaveLength(10)
      expect(mockClient.createIssueCalls).toHaveLength(10)

      // All issues should be created (mocking p-limit behavior)
      results.forEach((result) => {
        expect(result.type).toBe('parent')
        expect(result.url).toContain('github.com')
      })
    })

    test('should create subtasks for new issues when supported', async () => {
      const specsWithSubtasks = [
        createMockSpecWithSubtasks('feature-with-subs-1'),
        createMockSpecWithSubtasks('feature-with-subs-2'),
      ]

      await adapter.pushBatch(specsWithSubtasks)

      expect(mockClient.createIssueCalls).toHaveLength(2) // Main issues
      expect(mockClient.createSubtaskCalls).toHaveLength(4) // 2 subtasks per main issue
    })

    test('should handle empty batch', async () => {
      const results = await adapter.pushBatch([])

      expect(results).toEqual([])
      expect(mockClient.createIssueCalls).toHaveLength(0)
      expect(mockClient.updateIssueCalls).toHaveLength(0)
      expect(mockClient.batchUpdateIssuesCalls).toHaveLength(0)
    })

    test('should handle partial failures gracefully', async () => {
      const specs = [
        createMockSpec('good-spec'),
        createMockSpec('bad-spec'),
      ]

      // Make the second create operation fail
      let callCount = 0
      const originalCreate = mockClient.createIssue.bind(mockClient)
      mockClient.createIssue = async (title: string, body: string, labels?: string[]) => {
        callCount++
        if (callCount === 2) {
          throw new Error('Failed to create second issue')
        }
        return originalCreate(title, body, labels)
      }

      await expect(adapter.pushBatch(specs)).rejects.toThrow('Failed to create second issue')
    })

    test('should deduplicate labels across batch operations', async () => {
      const specs = [
        createMockSpec('spec-1'),
        createMockSpec('spec-2'),
        createMockSpec('spec-3'),
      ]

      await adapter.pushBatch(specs)

      // Labels should only be ensured once for the entire batch
      expect(mockClient.ensureLabelsExistCalls).toHaveLength(1)
      expect(mockClient.ensureLabelsExistCalls[0]).toEqual(['speckit', 'speckit:spec'])
    })

    test('should handle error in label creation before batch', async () => {
      const specs = [createMockSpec('test-spec')]

      const labelError = new Error('Failed to create labels')
      mockClient.setMethodError('ensureLabelsExist', labelError)

      await expect(adapter.pushBatch(specs)).rejects.toThrow('Failed to create labels')
    })

    test('should handle missing spec.md in batch operation', async () => {
      const invalidSpec: SpecDocument = {
        name: 'invalid-spec',
        path: 'specs/invalid-spec',
        files: new Map(), // No spec.md file
      }

      const validSpec = createMockSpec('valid-spec')

      // Should skip invalid specs and only process valid ones
      const results = await adapter.pushBatch([validSpec, invalidSpec])

      expect(results).toHaveLength(1) // Only the valid spec
      expect(mockClient.createIssueCalls).toHaveLength(1)
      expect(mockClient.createIssueCalls[0]?.title).toBe('Feature Specification: Valid Spec')
    })
  })

  describe('batch subtask creation', () => {
    test('should collect and deduplicate labels before creating subtasks', async () => {
      const spec = createMockSpecWithDifferentSubtasks('complex-feature')

      await adapter.push(spec)

      // Should collect all unique labels before creating any subtasks
      const allLabels = mockClient.ensureLabelsExistCalls.flat()
      const uniqueLabels = [...new Set(allLabels)]

      expect(uniqueLabels).toContain('speckit')
      expect(uniqueLabels).toContain('speckit:spec')
      expect(uniqueLabels).toContain('plan')
      expect(uniqueLabels).toContain('research')
      expect(uniqueLabels).toContain('datamodel')
    })
  })
})

// Helper functions
function createMockSpec(name: string, options: { withIssueNumber?: boolean, issueNumber?: number } = {}): SpecDocument {
  const frontmatter: any = {
    spec_id: crypto.randomUUID(),
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
  const spec = createMockSpec(name)

  const planFile: SpecFile = {
    path: `specs/${name}/plan.md`,
    filename: 'plan.md',
    frontmatter: {
      issue_type: 'subtask',
      sync_status: 'draft',
      auto_sync: true,
    },
    content: `# Plan for ${name}`,
    markdown: `# Plan for ${name}`,
  }

  const researchFile: SpecFile = {
    path: `specs/${name}/research.md`,
    filename: 'research.md',
    frontmatter: {
      issue_type: 'subtask',
      sync_status: 'draft',
      auto_sync: true,
    },
    content: `# Research for ${name}`,
    markdown: `# Research for ${name}`,
  }

  spec.files.set('plan.md', planFile)
  spec.files.set('research.md', researchFile)

  return spec
}

function createMockSpecWithDifferentSubtasks(name: string): SpecDocument {
  const spec = createMockSpec(name)

  const subtaskFiles = [
    { filename: 'plan.md', type: 'plan' },
    { filename: 'research.md', type: 'research' },
    { filename: 'data-model.md', type: 'datamodel' },
  ]

  for (const { filename, type } of subtaskFiles) {
    const file: SpecFile = {
      path: `specs/${name}/${filename}`,
      filename,
      frontmatter: {
        issue_type: 'subtask',
        sync_status: 'draft',
        auto_sync: true,
      },
      content: `# ${type} for ${name}`,
      markdown: `# ${type} for ${name}`,
    }
    spec.files.set(filename, file)
  }

  return spec
}
