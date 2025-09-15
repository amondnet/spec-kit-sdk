import type { GitHubIssue } from '../../src/types'
import { GitHubClient } from '../../src/adapters/github/api.js'

interface GitHubIssueUpdate {
  title?: string
  body?: string
  labels?: string[]
  assignees?: string[]
}

interface BatchUpdateOptions {
  labels?: string[]
  assignees?: string[]
}

export class EnhancedMockGitHubClient extends GitHubClient {
  // Call tracking
  public createIssueCalls: Array<{ title: string, body: string, labels?: string[] }> = []
  public updateIssueCalls: Array<{ number: number, updates: GitHubIssueUpdate }> = []
  public getIssueCalls: Array<number> = []
  public createSubtaskCalls: Array<{ parentNumber: number, title: string, body: string, labels?: string[] }> = []
  public getSubtasksCalls: Array<number> = []
  public addCommentCalls: Array<{ issueNumber: number, body: string }> = []
  public closeIssueCalls: Array<number> = []
  public reopenIssueCalls: Array<number> = []
  public ensureLabelsExistCalls: Array<string[]> = []
  public batchUpdateIssuesCalls: Array<{ numbers: number[], options: BatchUpdateOptions }> = []
  public checkAuthCalls: number = 0

  // Mock state
  private mockIssues = new Map<number, GitHubIssue>()
  private mockSubtasks = new Map<number, number[]>()
  private mockAuthResult = true
  private mockCreateIssueResult: number | null = null
  private mockCreateSubtaskResult: number | null = null
  private mockError: Error | null = null
  private nextIssueId = 100
  private mockCheckedLabels = new Set<string>()

  // Error injection
  private shouldThrowError = false
  private methodErrorMap = new Map<string, Error>()

  constructor(owner?: string, repo?: string) {
    super(owner, repo)
  }

  // Configuration methods
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

  setMethodError(methodName: string, error: Error): void {
    this.methodErrorMap.set(methodName, error)
  }

  private checkMethodError(methodName: string): void {
    if (this.shouldThrowError && this.mockError) {
      throw this.mockError
    }

    const methodError = this.methodErrorMap.get(methodName)
    if (methodError) {
      throw methodError
    }
  }

  // Overridden methods
  override async createIssue(title: string, body: string, labels?: string[]): Promise<number> {
    this.checkMethodError('createIssue')

    this.createIssueCalls.push({ title, body, labels })

    const issueNumber = this.mockCreateIssueResult ?? this.nextIssueId++

    this.setMockIssue(issueNumber, {
      number: issueNumber,
      title,
      body,
      state: 'OPEN',
      labels: labels || [],
    })

    if (this.mockCreateIssueResult !== null) {
      this.mockCreateIssueResult = null
    }

    return issueNumber
  }

  override async updateIssue(number: number, updates: GitHubIssueUpdate): Promise<void> {
    this.checkMethodError('updateIssue')

    this.updateIssueCalls.push({ number, updates })

    const existingIssue = this.mockIssues.get(number)
    if (existingIssue) {
      this.setMockIssue(number, {
        ...existingIssue,
        ...updates,
      })
    }
  }

  override async getIssue(number: number): Promise<GitHubIssue | null> {
    this.checkMethodError('getIssue')

    this.getIssueCalls.push(number)
    return this.mockIssues.get(number) || null
  }

  override async createSubtask(parentNumber: number, title: string, body: string, labels?: string[]): Promise<number> {
    this.checkMethodError('createSubtask')

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

    if (this.mockCreateSubtaskResult !== null) {
      this.mockCreateSubtaskResult = null
    }

    return subtaskNumber
  }

  override async getSubtasks(parentNumber: number): Promise<number[]> {
    this.checkMethodError('getSubtasks')

    this.getSubtasksCalls.push(parentNumber)
    return this.mockSubtasks.get(parentNumber) || []
  }

  override async addComment(issueNumber: number, body: string): Promise<void> {
    this.checkMethodError('addComment')

    this.addCommentCalls.push({ issueNumber, body })
  }

  override async closeIssue(number: number): Promise<void> {
    this.checkMethodError('closeIssue')

    this.closeIssueCalls.push(number)

    const existingIssue = this.mockIssues.get(number)
    if (existingIssue) {
      this.setMockIssue(number, {
        ...existingIssue,
        state: 'CLOSED',
      })
    }
  }

  override async reopenIssue(number: number): Promise<void> {
    this.checkMethodError('reopenIssue')

    this.reopenIssueCalls.push(number)

    const existingIssue = this.mockIssues.get(number)
    if (existingIssue) {
      this.setMockIssue(number, {
        ...existingIssue,
        state: 'OPEN',
      })
    }
  }

  override async checkAuth(): Promise<boolean> {
    this.checkMethodError('checkAuth')

    this.checkAuthCalls++
    return this.mockAuthResult
  }

  override async ensureLabelsExist(labels: string[]): Promise<void> {
    this.checkMethodError('ensureLabelsExist')

    const uncheckedLabels = labels.filter(label => !this.mockCheckedLabels.has(label))
    if (uncheckedLabels.length === 0) {
      return
    }

    this.ensureLabelsExistCalls.push(uncheckedLabels)
    uncheckedLabels.forEach(label => this.mockCheckedLabels.add(label))
  }

  override async batchUpdateIssues(numbers: number[], options: BatchUpdateOptions): Promise<void> {
    this.checkMethodError('batchUpdateIssues')

    this.batchUpdateIssuesCalls.push({ numbers, options })

    // Update each issue with the batch options
    for (const number of numbers) {
      const existingIssue = this.mockIssues.get(number)
      if (existingIssue) {
        this.setMockIssue(number, {
          ...existingIssue,
          labels: options.labels || existingIssue.labels,
        })
      }
    }
  }

  // Utility methods
  reset(): void {
    this.createIssueCalls = []
    this.updateIssueCalls = []
    this.getIssueCalls = []
    this.createSubtaskCalls = []
    this.getSubtasksCalls = []
    this.addCommentCalls = []
    this.closeIssueCalls = []
    this.reopenIssueCalls = []
    this.ensureLabelsExistCalls = []
    this.batchUpdateIssuesCalls = []
    this.checkAuthCalls = 0

    this.mockIssues.clear()
    this.mockSubtasks.clear()
    this.mockCheckedLabels.clear()
    this.mockAuthResult = true
    this.mockCreateIssueResult = null
    this.mockCreateSubtaskResult = null
    this.shouldThrowError = false
    this.mockError = null
    this.methodErrorMap.clear()
    this.nextIssueId = 100
  }

  getAllMockIssues(): Map<number, GitHubIssue> {
    return new Map(this.mockIssues)
  }

  getAllMockSubtasks(): Map<number, number[]> {
    return new Map(this.mockSubtasks)
  }

  getCheckedLabels(): Set<string> {
    return new Set(this.mockCheckedLabels)
  }
}
