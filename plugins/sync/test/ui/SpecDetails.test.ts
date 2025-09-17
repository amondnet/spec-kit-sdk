import type { SpecDocument, SyncStatus } from '../../src/types/index.js'
import { describe, expect, it } from 'bun:test'
import { SpecDetails } from '../../src/ui/SpecDetails.js'

// Mock spec document
function createMockSpec(name: string, issueNumber?: number): SpecDocument {
  return {
    path: `/specs/${name}`,
    name,
    issueNumber,
    files: new Map([
      ['spec.md', {
        path: `/specs/${name}/spec.md`,
        filename: 'spec.md',
        content: `---\ngithub:\n  issue_number: ${issueNumber || ''}\nsync_status: synced\nlast_sync: '2025-09-15T21:02:34.379Z'\nsync_hash: 4a50de220123\n---\n# ${name}\n\nThis is a test spec.\nIt has multiple lines.\nWith some content.`,
        frontmatter: {
          github: issueNumber ? { issue_number: issueNumber } : {},
          sync_status: 'synced',
          last_sync: '2025-09-15T21:02:34.379Z',
          sync_hash: '4a50de220123',
        },
        markdown: `# ${name}\n\nThis is a test spec.\nIt has multiple lines.\nWith some content.`,
      }],
      ['contracts/contract.md', {
        path: `/specs/${name}/contracts/contract.md`,
        filename: 'contract.md',
        content: 'Contract content',
        frontmatter: {},
        markdown: 'Contract content',
      }],
    ]),
  }
}

// Mock sync status
function createMockStatus(status: SyncStatus['status'], hasChanges = false, conflicts: string[] = []): SyncStatus {
  return {
    status,
    hasChanges,
    conflicts,
  }
}

describe('SpecDetails', () => {
  it('should render basic spec information', () => {
    const spec = createMockSpec('001-test-feature', 123)
    const status = createMockStatus('synced', false)

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('001-test-feature')
    expect(output).toContain('#123')
    expect(output).toContain('synced')
    expect(output).toContain('/specs/001-test-feature')
  })

  it('should render spec without issue number', () => {
    const spec = createMockSpec('002-local-spec')
    const status = createMockStatus('local', true)

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('002-local-spec')
    expect(output).toContain('None')
    expect(output).toContain('local')
    expect(output).toContain('Yes') // Has changes
  })

  it('should display frontmatter information', () => {
    const spec = createMockSpec('003-sync-spec', 456)
    const status = createMockStatus('synced', false)

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('Frontmatter')
    expect(output).toContain('#456')
    expect(output).toContain('synced')
    expect(output).toContain('9/15/2025') // Date formatted by toLocaleString
    expect(output).toContain('4a50de220123')
  })

  it('should list all files in the spec', () => {
    const spec = createMockSpec('004-multi-file-spec', 789)
    const status = createMockStatus('draft', false)

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('Files')
    expect(output).toContain('spec.md')
    expect(output).toContain('contracts/contract.md')
    expect(output).toContain('Markdown')
  })

  it('should show conflicts when present', () => {
    const spec = createMockSpec('005-conflict-spec', 101)
    const status = createMockStatus('conflict', true, [
      'Title has been modified remotely',
      'Description conflicts with remote version',
    ])

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('Conflicts')
    expect(output).toContain('Title has been modified remotely')
    expect(output).toContain('Description conflicts with remote version')
  })

  it('should show content preview', () => {
    const spec = createMockSpec('006-preview-spec', 202)
    const status = createMockStatus('synced', false)

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('Content Preview')
    expect(output).toContain('# 006-preview-spec')
    expect(output).toContain('This is a test spec.')
    expect(output).toContain('It has multiple lines.')
  })

  it('should handle different status types with correct formatting', () => {
    const statuses: SyncStatus['status'][] = ['synced', 'draft', 'conflict', 'local', 'unknown']

    statuses.forEach((statusType) => {
      const spec = createMockSpec(`spec-${statusType}`, 100)
      const status = createMockStatus(statusType, false)

      const output = SpecDetails.render(spec, status)

      expect(output).toContain(statusType === 'unknown' ? 'Unknown' : statusType)
    })
  })

  it('should handle spec without spec.md file', () => {
    const spec: SpecDocument = {
      path: '/specs/empty-spec',
      name: 'empty-spec',
      files: new Map([
        ['README.md', {
          path: '/specs/empty-spec/README.md',
          filename: 'README.md',
          content: 'Just a readme',
          frontmatter: {},
          markdown: 'Just a readme',
        }],
      ]),
    }
    const status = createMockStatus('local', false)

    const output = SpecDetails.render(spec, status)

    expect(output).toContain('empty-spec')
    expect(output).toContain('README.md')
    expect(output).not.toContain('Content Preview')
  })
})
