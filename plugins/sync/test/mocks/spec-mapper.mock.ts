import type { GitHubIssue, SpecDocument } from '../../src/types'

export class MockSpecToIssueMapper {
  // Call tracking
  public generateTitleCalls: Array<{ specName: string, fileType: string }> = []
  public generateBodyCalls: Array<{ markdown: string, spec: SpecDocument }> = []
  public issueToSpecCalls: Array<GitHubIssue> = []

  // Mock responses
  private mockTitleTemplate = (specName: string, fileType: string) => `${fileType}: ${specName}`
  private mockBodyTemplate = (markdown: string, _spec: SpecDocument) => `Mock body for: ${markdown.substring(0, 50)}...`
  private mockSpecGenerator: ((issue: GitHubIssue) => SpecDocument) | null = null

  // Error injection
  private shouldThrowError = false
  private mockError: Error | null = null
  private methodErrorMap = new Map<string, Error>()

  // Configuration methods
  setMockTitleTemplate(template: (specName: string, fileType: string) => string): void {
    this.mockTitleTemplate = template
  }

  setMockBodyTemplate(template: (markdown: string, spec: SpecDocument) => string): void {
    this.mockBodyTemplate = template
  }

  setMockSpecGenerator(generator: (issue: GitHubIssue) => SpecDocument): void {
    this.mockSpecGenerator = generator
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

  // Mock implementations
  generateTitle(specName: string, fileType: string): string {
    this.checkMethodError('generateTitle')

    this.generateTitleCalls.push({ specName, fileType })
    return this.mockTitleTemplate(specName, fileType)
  }

  generateBody(markdown: string, spec: SpecDocument): string {
    this.checkMethodError('generateBody')

    this.generateBodyCalls.push({ markdown, spec })
    return this.mockBodyTemplate(markdown, spec)
  }

  issueToSpec(issue: GitHubIssue): SpecDocument {
    this.checkMethodError('issueToSpec')

    this.issueToSpecCalls.push(issue)

    if (this.mockSpecGenerator) {
      return this.mockSpecGenerator(issue)
    }

    // Default mock implementation
    const specName = issue.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    return {
      name: specName,
      path: `specs/${specName}`,
      files: new Map([
        ['spec.md', {
          path: `specs/${specName}/spec.md`,
          filename: 'spec.md',
          frontmatter: {
            issue_type: 'parent',
            sync_status: 'synced',
            last_sync: new Date().toISOString(),
            auto_sync: true,
            github: {
              issue_number: issue.number,
            },
          },
          content: issue.body,
          markdown: issue.body,
        }],
      ]),
    }
  }

  // Utility methods
  reset(): void {
    this.generateTitleCalls = []
    this.generateBodyCalls = []
    this.issueToSpecCalls = []
    this.shouldThrowError = false
    this.mockError = null
    this.methodErrorMap.clear()
    this.mockSpecGenerator = null
    this.mockTitleTemplate = (specName: string, fileType: string) => `${fileType}: ${specName}`
    this.mockBodyTemplate = (markdown: string, _spec: SpecDocument) => `Mock body for: ${markdown.substring(0, 50)}...`
  }

  // Predefined mock responses for common scenarios
  static createRealisticMocks(): MockSpecToIssueMapper {
    const mock = new MockSpecToIssueMapper()

    mock.setMockTitleTemplate((specName, fileType) => {
      const cleanName = specName.replace(/^\d+-/, '').replace(/-/g, ' ')
      const capitalizedName = cleanName.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      switch (fileType) {
        case 'spec':
          return `Feature Specification: ${capitalizedName}`
        case 'plan':
          return `Plan: ${capitalizedName}`
        case 'research':
          return `Research: ${capitalizedName}`
        default:
          return `${fileType}: ${capitalizedName}`
      }
    })

    mock.setMockBodyTemplate((markdown, spec) => {
      const cleanMarkdown = markdown.replace(/^---[\s\S]*?---/, '').trim()
      const footer = [
        `**Spec:** \`${spec.name}\``,
        `**Path:** \`${spec.path}\``,
        `**Synced:** ${new Date().toISOString()}`,
      ].join('  \n')

      return `${cleanMarkdown}\n\n---\n\n${footer}`
    })

    return mock
  }
}
