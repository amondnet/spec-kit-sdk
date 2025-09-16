import type { GitHubIssue, SpecDocument } from '../../../src/types/index.js'
import { beforeEach, describe, expect, test } from 'bun:test'
import { SpecToIssueMapper } from '../../../src/adapters/github/mapper.js'

describe('SpecToIssueMapper', () => {
  let mapper: SpecToIssueMapper

  beforeEach(() => {
    mapper = new SpecToIssueMapper()
  })

  describe('generateTitle', () => {
    test('should generate title for spec file type', () => {
      const result = mapper.generateTitle('01-user-authentication', 'spec')
      expect(result).toBe('Feature Specification: User Authentication')
    })

    test('should generate title for plan file type', () => {
      const result = mapper.generateTitle('02-payment-integration', 'plan')
      expect(result).toBe('Plan: Payment Integration')
    })

    test('should generate title for research file type', () => {
      const result = mapper.generateTitle('03-security-analysis', 'research')
      expect(result).toBe('Research: Security Analysis')
    })

    test('should generate title for quickstart file type', () => {
      const result = mapper.generateTitle('04-getting-started', 'quickstart')
      expect(result).toBe('Quickstart: Getting Started')
    })

    test('should generate title for data-model file type', () => {
      const result = mapper.generateTitle('05-user-schema', 'data-model')
      expect(result).toBe('Data Model: User Schema')
    })

    test('should generate title for datamodel file type (alternative)', () => {
      const result = mapper.generateTitle('06-product-schema', 'datamodel')
      expect(result).toBe('Data Model: Product Schema')
    })

    test('should generate title for tasks file type', () => {
      const result = mapper.generateTitle('07-sprint-tasks', 'tasks')
      expect(result).toBe('Tasks: Sprint Tasks')
    })

    test('should generate title for contracts file type', () => {
      const result = mapper.generateTitle('08-api-endpoints', 'contracts')
      expect(result).toBe('API Contracts: Api Endpoints')
    })

    test('should generate title for unknown file type', () => {
      const result = mapper.generateTitle('09-custom-document', 'custom')
      expect(result).toBe('custom: Custom Document')
    })

    test('should clean spec name by removing number prefix', () => {
      const result = mapper.generateTitle('01-user-auth', 'spec')
      expect(result).toBe('Feature Specification: User Auth')
    })

    test('should clean spec name by replacing hyphens with spaces', () => {
      const result = mapper.generateTitle('multi-word-feature-name', 'spec')
      expect(result).toBe('Feature Specification: Multi Word Feature Name')
    })

    test('should capitalize each word in spec name', () => {
      const result = mapper.generateTitle('lowercase-words', 'spec')
      expect(result).toBe('Feature Specification: Lowercase Words')
    })

    test('should handle empty spec name', () => {
      const result = mapper.generateTitle('', 'spec')
      expect(result).toBe('Feature Specification: ')
    })

    test('should handle spec name with only numbers', () => {
      const result = mapper.generateTitle('123', 'spec')
      expect(result).toBe('Feature Specification: 123')
    })

    test('should handle spec name without number prefix', () => {
      const result = mapper.generateTitle('user-authentication', 'spec')
      expect(result).toBe('Feature Specification: User Authentication')
    })
  })

  describe('generateBody', () => {
    test('should remove frontmatter and add footer', () => {
      const markdown = `---
title: Test Feature
type: spec
---

# Test Feature

This is the content of the feature spec.`

      const spec: SpecDocument = {
        name: 'test-feature',
        path: 'specs/test-feature',
        issueNumber: 123,
        files: new Map(),
      }

      const result = mapper.generateBody(markdown, spec)

      expect(result).toContain('# Test Feature')
      expect(result).toContain('This is the content of the feature spec.')
      expect(result).toContain('**Spec:** `test-feature`')
      expect(result).toContain('**Path:** `specs/test-feature`')
      expect(result).toContain('**Synced:**')
      expect(result).toContain('---') // Footer separator is expected
      expect(result).not.toContain('title: Test Feature')
    })

    test('should handle markdown without frontmatter', () => {
      const markdown = `# Simple Feature

This is a simple feature without frontmatter.`

      const spec: SpecDocument = {
        name: 'simple-feature',
        path: 'specs/simple-feature',
        files: new Map(),
      }

      const result = mapper.generateBody(markdown, spec)

      expect(result).toContain('# Simple Feature')
      expect(result).toContain('This is a simple feature without frontmatter.')
      expect(result).toContain('**Spec:** `simple-feature`')
    })

    test('should handle empty markdown', () => {
      const markdown = ''

      const spec: SpecDocument = {
        name: 'empty-spec',
        path: 'specs/empty-spec',
        files: new Map(),
      }

      const result = mapper.generateBody(markdown, spec)

      expect(result).toContain('**Spec:** `empty-spec`')
      expect(result).toContain('---')
    })

    test('should handle malformed frontmatter', () => {
      const markdown = `---
incomplete frontmatter
# Feature Content`

      const spec: SpecDocument = {
        name: 'malformed-spec',
        path: 'specs/malformed-spec',
        files: new Map(),
      }

      const result = mapper.generateBody(markdown, spec)

      expect(result).toContain('---')
      expect(result).toContain('incomplete frontmatter')
      expect(result).toContain('# Feature Content')
    })
  })

  describe('issueToSpec', () => {
    test('should convert GitHub issue to spec document', () => {
      const issue: GitHubIssue = {
        number: 123,
        title: 'Feature Specification: User Authentication',
        body: '# User Authentication\n\nThis feature handles user login and registration.',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)

      expect(result.name).toBe('user-authentication')
      expect(result.path).toBe('specs/user-authentication')
      expect(result.issueNumber).toBe(123)
      expect(result.files.size).toBe(1)

      const specFile = result.files.get('spec.md')
      expect(specFile).toBeDefined()
      expect(specFile?.path).toBe('specs/user-authentication/spec.md')
      expect(specFile?.filename).toBe('spec.md')
      expect(specFile?.content).toBe(issue.body)
      expect(specFile?.markdown).toBe(issue.body)
      expect(specFile?.frontmatter.issue_type).toBe('parent')
      expect(specFile?.frontmatter.sync_status).toBe('synced')
      expect(specFile?.frontmatter.auto_sync).toBe(true)
      expect(specFile?.frontmatter.github?.issue_number).toBe(123)
      expect(specFile?.frontmatter.last_sync).toBeDefined()
    })

    test('should extract spec name from plan title', () => {
      const issue: GitHubIssue = {
        number: 456,
        title: 'Plan: Database Migration',
        body: 'Migration plan content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('database-migration')
    })

    test('should extract spec name from research title', () => {
      const issue: GitHubIssue = {
        number: 789,
        title: 'Research: API Performance Analysis',
        body: 'Research content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('api-performance-analysis')
    })

    test('should extract spec name from quickstart title', () => {
      const issue: GitHubIssue = {
        number: 101,
        title: 'Quickstart: Getting Started Guide',
        body: 'Quickstart content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('getting-started-guide')
    })

    test('should extract spec name from data model title', () => {
      const issue: GitHubIssue = {
        number: 202,
        title: 'Data Model: User Schema Design',
        body: 'Data model content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('user-schema-design')
    })

    test('should extract spec name from tasks title', () => {
      const issue: GitHubIssue = {
        number: 303,
        title: 'Tasks: Sprint Planning Items',
        body: 'Tasks content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('sprint-planning-items')
    })

    test('should extract spec name from API contracts title', () => {
      const issue: GitHubIssue = {
        number: 404,
        title: 'API Contracts: REST Endpoints',
        body: 'Contracts content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('rest-endpoints')
    })

    test('should fallback to full title when no pattern matches', () => {
      const issue: GitHubIssue = {
        number: 505,
        title: 'Custom Document: Special Feature',
        body: 'Custom content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('custom-document-special-feature')
    })

    test('should handle title with special characters', () => {
      const issue: GitHubIssue = {
        number: 606,
        title: 'Feature Specification: OAuth 2.0 Integration!',
        body: 'OAuth content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('oauth-20-integration')
    })

    test('should handle title with multiple spaces', () => {
      const issue: GitHubIssue = {
        number: 707,
        title: 'Feature Specification:   Multiple   Spaces   Feature',
        body: 'Content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('-multiple-spaces-feature') // Leading space and multiple spaces become hyphens
    })

    test('should handle empty title', () => {
      const issue: GitHubIssue = {
        number: 808,
        title: '',
        body: 'Content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('')
    })

    test('should handle case insensitive pattern matching', () => {
      const issue: GitHubIssue = {
        number: 909,
        title: 'feature specification: Mixed Case Feature',
        body: 'Content',
        state: 'OPEN',
      }

      const result = mapper.issueToSpec(issue)
      expect(result.name).toBe('mixed-case-feature')
    })
  })

  describe('Edge cases and error handling', () => {
    test('should handle generateTitle with empty string inputs', () => {
      const result1 = mapper.generateTitle('', 'spec')
      expect(result1).toBe('Feature Specification: ')

      const result2 = mapper.generateTitle('test', '')
      expect(result2).toBe(': Test')
    })

    test('should handle generateBody with empty content', () => {
      const spec: SpecDocument = {
        name: 'test',
        path: 'specs/test',
        files: new Map(),
      }

      const result = mapper.generateBody('', spec)
      expect(result).toContain('**Spec:** `test`')
      expect(result).toContain('---')
    })

    test('should handle frontmatter with only opening delimiter', () => {
      const markdown = `---
title: Test
# Content without closing delimiter`

      const spec: SpecDocument = {
        name: 'test',
        path: 'specs/test',
        files: new Map(),
      }

      const result = mapper.generateBody(markdown, spec)
      expect(result).toContain('---')
      expect(result).toContain('title: Test')
    })

    test('should handle complex spec name cleaning', () => {
      const result = mapper.generateTitle('123-@#$%complex__name--with___special-chars', 'spec')
      expect(result).toBe('Feature Specification: @#$%complex__name  With___special Chars') // Only number prefix and hyphens are cleaned
    })
  })
})
