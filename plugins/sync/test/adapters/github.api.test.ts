import type { GitHubIssue } from '../../src/types'
import { beforeEach, describe, expect, test } from 'bun:test'
import { GitHubClient } from '../../src/adapters/github/api.js'

// Enhanced MockGitHubClient for unit testing
class MockGitHubClient extends GitHubClient {
  // Call tracking
  public createIssueCalls: Array<{ title: string, body: string, labels?: string[] }> = []
  public updateIssueCalls: Array<{ number: number, updates: any }> = []
  public getIssueCalls: Array<number> = []
  public listIssuesCalls: Array<{ labels?: string[] }> = []
  public createSubtaskCalls: Array<{ parentNumber: number, title: string, body: string, labels?: string[] }> = []
  public getSubtasksCalls: Array<number> = []
  public addCommentCalls: Array<{ issueNumber: number, body: string }> = []
  public closeIssueCalls: Array<number> = []
  public reopenIssueCalls: Array<number> = []
  public ensureLabelsExistCalls: Array<string[]> = []
  public checkAuthCalls: number = 0

  // Mock responses
  private mockIssues = new Map<number, GitHubIssue>()
  private mockSubtasks = new Map<number, number[]>()
  private mockAuthResult = true
  private mockCreateIssueResult: number | null = null
  private mockCreateSubtaskResult: number | null = null
  private mockError: Error | null = null
  private nextIssueId = 100

  // Configuration
  private shouldThrowError = false

  constructor(owner?: string, repo?: string) {
    super(owner, repo)
  }

  // Setter methods for controlling mock behavior
  setMockIssue(number: number, issue: GitHubIssue): void {
    this.mockIssues.set(number, issue)
  }

  setMockSubtasks(parentNumber: number, subtasks: number[]): void {
    this.mockSubtasks.set(parentNumber, subtasks)
  }

  setMockAuthResult(result: boolean): void {
    this.mockAuthResult = result
  }

  setMockCreateIssueResult(issueNumber: number): void {
    this.mockCreateIssueResult = issueNumber
  }

  setMockCreateSubtaskResult(subtaskNumber: number): void {
    this.mockCreateSubtaskResult = subtaskNumber
  }

  setShouldThrowError(error: Error | null): void {
    this.mockError = error
    this.shouldThrowError = !!error
  }

  // Overridden methods
  override async createIssue(title: string, body: string, labels?: string[]): Promise<number> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.createIssueCalls.push({ title, body, labels })

    // Auto-create mock issue with incrementing ID or custom result
    const issueNumber = this.mockCreateIssueResult ?? this.nextIssueId++
    this.setMockIssue(issueNumber, {
      number: issueNumber,
      title,
      body,
      state: 'OPEN',
      labels: labels || [],
    })

    // Reset custom result after use
    if (this.mockCreateIssueResult !== null) {
      this.mockCreateIssueResult = null
    }

    return issueNumber
  }

  override async updateIssue(number: number, updates: { title?: string, body?: string, labels?: string[] }): Promise<void> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.updateIssueCalls.push({ number, updates })

    // Update mock issue if it exists
    const existingIssue = this.mockIssues.get(number)
    if (existingIssue) {
      this.setMockIssue(number, {
        ...existingIssue,
        ...updates,
      })
    }
  }

  override async getIssue(number: number): Promise<GitHubIssue | null> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.getIssueCalls.push(number)
    return this.mockIssues.get(number) || null
  }

  override async listIssues(labels?: string[]): Promise<GitHubIssue[]> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.listIssuesCalls.push({ labels })

    const allIssues = Array.from(this.mockIssues.values())
    if (!labels || labels.length === 0) {
      return allIssues
    }

    // Filter by labels
    return allIssues.filter(issue =>
      labels.some(label => issue.labels?.includes(label)),
    )
  }

  override async createSubtask(parentNumber: number, title: string, body: string, labels?: string[]): Promise<number> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.createSubtaskCalls.push({ parentNumber, title, body, labels })

    const subtaskNumber = this.mockCreateSubtaskResult ?? this.nextIssueId++

    // Add to parent's subtasks
    const existingSubtasks = this.mockSubtasks.get(parentNumber) || []
    this.setMockSubtasks(parentNumber, [...existingSubtasks, subtaskNumber])

    // Create mock issue for subtask
    this.setMockIssue(subtaskNumber, {
      number: subtaskNumber,
      title,
      body,
      state: 'OPEN',
      labels: labels || ['subtask'],
    })

    // Reset custom result after use
    if (this.mockCreateSubtaskResult !== null) {
      this.mockCreateSubtaskResult = null
    }

    return subtaskNumber
  }

  override async getSubtasks(parentNumber: number): Promise<number[]> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.getSubtasksCalls.push(parentNumber)
    return this.mockSubtasks.get(parentNumber) || []
  }

  override async addComment(issueNumber: number, body: string): Promise<void> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.addCommentCalls.push({ issueNumber, body })
  }

  override async closeIssue(number: number): Promise<void> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.closeIssueCalls.push(number)

    // Update mock issue state
    const existingIssue = this.mockIssues.get(number)
    if (existingIssue) {
      this.setMockIssue(number, {
        ...existingIssue,
        state: 'CLOSED',
      })
    }
  }

  override async reopenIssue(number: number): Promise<void> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.reopenIssueCalls.push(number)

    // Update mock issue state
    const existingIssue = this.mockIssues.get(number)
    if (existingIssue) {
      this.setMockIssue(number, {
        ...existingIssue,
        state: 'OPEN',
      })
    }
  }

  override async checkAuth(): Promise<boolean> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.checkAuthCalls++
    return this.mockAuthResult
  }

  override async ensureLabelsExist(labels: string[]): Promise<void> {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    this.ensureLabelsExistCalls.push([...labels])
  }

  // Helper methods for testing
  reset(): void {
    this.createIssueCalls = []
    this.updateIssueCalls = []
    this.getIssueCalls = []
    this.listIssuesCalls = []
    this.createSubtaskCalls = []
    this.getSubtasksCalls = []
    this.addCommentCalls = []
    this.closeIssueCalls = []
    this.reopenIssueCalls = []
    this.ensureLabelsExistCalls = []
    this.checkAuthCalls = 0

    this.mockIssues.clear()
    this.mockSubtasks.clear()
    this.mockAuthResult = true
    this.mockCreateIssueResult = null
    this.mockCreateSubtaskResult = null
    this.shouldThrowError = false
    this.mockError = null
    this.nextIssueId = 100
  }

  getAllMockIssues(): Map<number, GitHubIssue> {
    return new Map(this.mockIssues)
  }

  getAllMockSubtasks(): Map<number, number[]> {
    return new Map(this.mockSubtasks)
  }
}

describe('GitHubClient - Unit Tests', () => {
  let client: MockGitHubClient

  beforeEach(() => {
    client = new MockGitHubClient('test-owner', 'test-repo')
    client.reset()
  })

  describe('Constructor', () => {
    test('should initialize with owner and repo', () => {
      const testClient = new MockGitHubClient('my-owner', 'my-repo')

      // @ts-expect-error - accessing private property for testing
      expect(testClient.owner).toBe('my-owner')
      // @ts-expect-error - accessing private property for testing
      expect(testClient.repo).toBe('my-repo')
      // @ts-expect-error - accessing private property for testing
      expect(testClient.repoFlag).toBe('--repo my-owner/my-repo')
    })

    test('should initialize without owner and repo', () => {
      const testClient = new MockGitHubClient()

      // @ts-expect-error - accessing private property for testing
      expect(testClient.owner).toBeUndefined()
      // @ts-expect-error - accessing private property for testing
      expect(testClient.repo).toBeUndefined()
      // @ts-expect-error - accessing private property for testing
      expect(testClient.repoFlag).toBeUndefined()
    })

    test('should not set repoFlag when owner or repo missing', () => {
      const testClient1 = new MockGitHubClient('test-owner', undefined)
      // @ts-expect-error - accessing private property for testing
      expect(testClient1.repoFlag).toBeUndefined()

      const testClient2 = new MockGitHubClient(undefined, 'test-repo')
      // @ts-expect-error - accessing private property for testing
      expect(testClient2.repoFlag).toBeUndefined()
    })

    test('should format repoFlag correctly', () => {
      const testCases = [
        { owner: 'facebook', repo: 'react', expected: '--repo facebook/react' },
        { owner: 'microsoft', repo: 'vscode', expected: '--repo microsoft/vscode' },
        { owner: 'spec-kit', repo: 'spec-kit-sdk', expected: '--repo spec-kit/spec-kit-sdk' },
      ]

      testCases.forEach(({ owner, repo, expected }) => {
        const testClient = new MockGitHubClient(owner, repo)
        // @ts-expect-error - accessing private property for testing
        expect(testClient.repoFlag).toBe(expected)
      })
    })
  })

  describe('createIssue', () => {
    test('should create issue with title and body', async () => {
      const result = await client.createIssue('Test Issue', 'Test body')

      expect(result).toBe(100)
      expect(client.createIssueCalls).toHaveLength(1)
      expect(client.createIssueCalls[0]).toEqual({
        title: 'Test Issue',
        body: 'Test body',
        labels: undefined,
      })
    })

    test('should create issue with labels', async () => {
      const labels = ['bug', 'enhancement']
      const result = await client.createIssue('Test Issue', 'Test body', labels)

      expect(result).toBe(100)
      expect(client.createIssueCalls[0]?.labels).toEqual(labels)

      // Verify mock issue was created
      const mockIssue = await client.getIssue(100)
      expect(mockIssue?.labels).toEqual(labels)
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('GitHub API error')
      client.setShouldThrowError(testError)

      expect(client.createIssue('Test', 'Body')).rejects.toThrow('GitHub API error')
    })

    test('should return custom issue number', async () => {
      client.setMockCreateIssueResult(456)

      const result = await client.createIssue('Test Issue', 'Test body')
      expect(result).toBe(456)
    })
  })

  describe('updateIssue', () => {
    test('should update issue title', async () => {
      // First create an issue
      const issueNumber = await client.createIssue('Original Title', 'Original body')

      // Then update it
      await client.updateIssue(issueNumber, { title: 'Updated Title' })

      expect(client.updateIssueCalls).toHaveLength(1)
      expect(client.updateIssueCalls[0]).toEqual({
        number: issueNumber,
        updates: { title: 'Updated Title' },
      })

      // Verify the mock issue was updated
      const updatedIssue = await client.getIssue(issueNumber)
      expect(updatedIssue?.title).toBe('Updated Title')
      expect(updatedIssue?.body).toBe('Original body') // Should remain unchanged
    })

    test('should update multiple fields', async () => {
      const issueNumber = await client.createIssue('Original Title', 'Original body')

      const updates = {
        title: 'New Title',
        body: 'New body',
        labels: ['updated'],
      }

      await client.updateIssue(issueNumber, updates)

      const updatedIssue = await client.getIssue(issueNumber)
      expect(updatedIssue?.title).toBe('New Title')
      expect(updatedIssue?.body).toBe('New body')
      expect(updatedIssue?.labels).toEqual(['updated'])
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Update failed')
      client.setShouldThrowError(testError)

      expect(client.updateIssue(123, { title: 'New Title' })).rejects.toThrow('Update failed')
    })
  })

  describe('getIssue', () => {
    test('should return existing issue', async () => {
      const issueNumber = await client.createIssue('Test Issue', 'Test body', ['test'])

      const retrievedIssue = await client.getIssue(issueNumber)

      expect(client.getIssueCalls).toHaveLength(1)
      expect(client.getIssueCalls[0]).toBe(issueNumber)

      expect(retrievedIssue).toEqual({
        number: issueNumber,
        title: 'Test Issue',
        body: 'Test body',
        state: 'OPEN',
        labels: ['test'],
      })
    })

    test('should return null for non-existent issue', async () => {
      const result = await client.getIssue(999)

      expect(result).toBeNull()
      expect(client.getIssueCalls).toContain(999)
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Get issue failed')
      client.setShouldThrowError(testError)

      expect(client.getIssue(123)).rejects.toThrow('Get issue failed')
    })
  })

  describe('listIssues', () => {
    beforeEach(async () => {
      // Reset first, then create test data
      client.reset()
      await client.createIssue('Issue 1', 'Body 1', ['bug'])
      await client.createIssue('Issue 2', 'Body 2', ['enhancement'])
      await client.createIssue('Issue 3', 'Body 3', ['bug', 'priority'])
    })

    test('should return all issues when no labels specified', async () => {
      const issues = await client.listIssues()

      expect(issues).toHaveLength(3)
      expect(client.listIssuesCalls).toHaveLength(1)
      expect(client.listIssuesCalls[0]).toEqual({ labels: undefined })
    })

    test('should filter issues by single label', async () => {
      const issues = await client.listIssues(['bug'])

      expect(issues).toHaveLength(2)
      expect(issues.every(issue => issue.labels?.includes('bug'))).toBe(true)
    })

    test('should filter issues by multiple labels', async () => {
      const issues = await client.listIssues(['bug', 'enhancement'])

      expect(issues).toHaveLength(3) // All issues have at least one of these labels
    })

    test('should return empty array for non-matching labels', async () => {
      const issues = await client.listIssues(['non-existent'])

      expect(issues).toHaveLength(0)
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('List issues failed')
      client.setShouldThrowError(testError)

      expect(client.listIssues()).rejects.toThrow('List issues failed')
    })
  })

  describe('createSubtask', () => {
    test('should create subtask linked to parent', async () => {
      const parentNumber = 999
      const subtaskNumber = await client.createSubtask(parentNumber, 'Subtask Title', 'Subtask body')

      expect(subtaskNumber).toBe(100)
      expect(client.createSubtaskCalls).toHaveLength(1)
      expect(client.createSubtaskCalls[0]).toEqual({
        parentNumber,
        title: 'Subtask Title',
        body: 'Subtask body',
        labels: undefined,
      })

      // Verify subtask was added to parent's subtasks
      const subtasks = await client.getSubtasks(parentNumber)
      expect(subtasks).toContain(subtaskNumber)

      // Verify subtask issue was created
      const subtaskIssue = await client.getIssue(subtaskNumber)
      expect(subtaskIssue?.title).toBe('Subtask Title')
      expect(subtaskIssue?.labels).toEqual(['subtask'])
    })

    test('should create subtask with custom labels', async () => {
      const customLabels = ['plan', 'urgent']
      const subtaskNumber = await client.createSubtask(100, 'Plan Task', 'Plan details', customLabels)

      const subtaskIssue = await client.getIssue(subtaskNumber)
      expect(subtaskIssue?.labels).toEqual(customLabels)
    })

    test('should handle multiple subtasks for same parent', async () => {
      const parentNumber = 200

      const subtask1 = await client.createSubtask(parentNumber, 'Subtask 1', 'Body 1')
      const subtask2 = await client.createSubtask(parentNumber, 'Subtask 2', 'Body 2')

      const subtasks = await client.getSubtasks(parentNumber)
      expect(subtasks).toEqual([subtask1, subtask2])
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Create subtask failed')
      client.setShouldThrowError(testError)

      expect(client.createSubtask(100, 'Title', 'Body')).rejects.toThrow('Create subtask failed')
    })
  })

  describe('getSubtasks', () => {
    test('should return empty array for parent with no subtasks', async () => {
      const subtasks = await client.getSubtasks(999)

      expect(subtasks).toEqual([])
      expect(client.getSubtasksCalls).toContain(999)
    })

    test('should return subtasks for parent', async () => {
      const parentNumber = 300
      const subtask1 = await client.createSubtask(parentNumber, 'Sub 1', 'Body 1')
      const subtask2 = await client.createSubtask(parentNumber, 'Sub 2', 'Body 2')

      const subtasks = await client.getSubtasks(parentNumber)
      expect(subtasks).toEqual([subtask1, subtask2])
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Get subtasks failed')
      client.setShouldThrowError(testError)

      expect(client.getSubtasks(100)).rejects.toThrow('Get subtasks failed')
    })
  })

  describe('addComment', () => {
    test('should add comment to issue', async () => {
      await client.addComment(123, 'This is a comment')

      expect(client.addCommentCalls).toHaveLength(1)
      expect(client.addCommentCalls[0]).toEqual({
        issueNumber: 123,
        body: 'This is a comment',
      })
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Add comment failed')
      client.setShouldThrowError(testError)

      expect(client.addComment(123, 'Comment')).rejects.toThrow('Add comment failed')
    })
  })

  describe('closeIssue and reopenIssue', () => {
    test('should close and reopen issue', async () => {
      const issueNumber = await client.createIssue('Test Issue', 'Test body')

      // Issue should start as open
      let issue = await client.getIssue(issueNumber)
      expect(issue?.state).toBe('OPEN')

      // Close the issue
      await client.closeIssue(issueNumber)
      expect(client.closeIssueCalls).toContain(issueNumber)

      issue = await client.getIssue(issueNumber)
      expect(issue?.state).toBe('CLOSED')

      // Reopen the issue
      await client.reopenIssue(issueNumber)
      expect(client.reopenIssueCalls).toContain(issueNumber)

      issue = await client.getIssue(issueNumber)
      expect(issue?.state).toBe('OPEN')
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Close/reopen failed')
      client.setShouldThrowError(testError)

      expect(client.closeIssue(123)).rejects.toThrow('Close/reopen failed')
      expect(client.reopenIssue(123)).rejects.toThrow('Close/reopen failed')
    })
  })

  describe('checkAuth', () => {
    test('should return true when authenticated', async () => {
      const result = await client.checkAuth()

      expect(result).toBe(true)
      expect(client.checkAuthCalls).toBe(1)
    })

    test('should return false when not authenticated', async () => {
      client.setMockAuthResult(false)

      const result = await client.checkAuth()
      expect(result).toBe(false)
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Auth check failed')
      client.setShouldThrowError(testError)

      expect(client.checkAuth()).rejects.toThrow('Auth check failed')
    })
  })

  describe('ensureLabelsExist', () => {
    test('should track label creation calls', async () => {
      const labels1 = ['bug', 'enhancement']
      const labels2 = ['priority', 'bug'] // bug should be deduplicated

      await client.ensureLabelsExist(labels1)
      await client.ensureLabelsExist(labels2)

      expect(client.ensureLabelsExistCalls).toHaveLength(2)
      expect(client.ensureLabelsExistCalls[0]).toEqual(labels1)
      expect(client.ensureLabelsExistCalls[1]).toEqual(labels2)
    })

    test('should handle empty label arrays', async () => {
      await client.ensureLabelsExist([])

      expect(client.ensureLabelsExistCalls).toHaveLength(1)
      expect(client.ensureLabelsExistCalls[0]).toEqual([])
    })

    test('should throw error when configured to fail', async () => {
      const testError = new Error('Ensure labels failed')
      client.setShouldThrowError(testError)

      expect(client.ensureLabelsExist(['test'])).rejects.toThrow('Ensure labels failed')
    })
  })

  describe('Mock state management', () => {
    test('should reset all state', () => {
      // Add some data
      client.createIssue('Test', 'Body')
      client.checkAuth()

      expect(client.createIssueCalls).toHaveLength(1)
      expect(client.checkAuthCalls).toBe(1)

      // Reset
      client.reset()

      expect(client.createIssueCalls).toHaveLength(0)
      expect(client.checkAuthCalls).toBe(0)
      expect(client.getAllMockIssues().size).toBe(0)
      expect(client.getAllMockSubtasks().size).toBe(0)
    })

    test('should allow access to mock data', () => {
      client.setMockIssue(999, {
        number: 999,
        title: 'Manual Mock',
        body: 'Manually set mock issue',
        state: 'OPEN',
        labels: ['manual'],
      })

      const mockIssues = client.getAllMockIssues()
      expect(mockIssues.get(999)?.title).toBe('Manual Mock')
    })
  })
})
