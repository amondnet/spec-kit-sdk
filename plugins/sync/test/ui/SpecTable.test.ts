import type { SpecDocument, SyncStatus } from '../../src/types/index.js'
import { describe, expect, it } from 'bun:test'
import { SpecTable } from '../../src/ui/SpecTable.js'

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
        content: `---\ngithub:\n  issue_number: ${issueNumber || ''}\nsync_status: synced\nlast_sync: '2025-09-15T21:02:34.379Z'\n---\n# ${name}\n\nTest spec content.`,
        frontmatter: {
          github: issueNumber ? { issue_number: issueNumber } : {},
          sync_status: 'synced',
          last_sync: '2025-09-15T21:02:34.379Z',
        },
        markdown: `# ${name}\n\nTest spec content.`,
      }],
    ]),
  }
}

// Mock sync status
function createMockStatus(status: SyncStatus['status'], hasChanges = false): SyncStatus {
  return {
    status,
    hasChanges,
    conflicts: [],
  }
}

describe('SpecTable', () => {
  it('should create an empty table', () => {
    const table = new SpecTable()
    const output = table.render()

    expect(output).toContain('Spec Name')
    expect(output).toContain('Issue')
    expect(output).toContain('Status')
    expect(output).toContain('Last Sync')
    expect(output).toContain('Changes')
  })

  it('should add a row with spec data', () => {
    const table = new SpecTable()
    const spec = createMockSpec('001-test-feature', 123)
    const status = createMockStatus('synced', false)

    table.addRow({ spec, status })
    const output = table.render()

    expect(output).toContain('001-test-feature')
    expect(output).toContain('#123')
    expect(output).toContain('synced')
  })

  it('should handle specs without issue numbers', () => {
    const table = new SpecTable()
    const spec = createMockSpec('002-local-spec')
    const status = createMockStatus('local', true)

    table.addRow({ spec, status })
    const output = table.render()

    expect(output).toContain('002-local-spec')
    expect(output).toContain('local')
  })

  it('should format different status types correctly', () => {
    const table = new SpecTable()
    const specs = [
      { spec: createMockSpec('synced-spec', 1), status: createMockStatus('synced') },
      { spec: createMockSpec('draft-spec', 2), status: createMockStatus('draft') },
      { spec: createMockSpec('conflict-spec', 3), status: createMockStatus('conflict') },
      { spec: createMockSpec('local-spec'), status: createMockStatus('local') },
    ]

    specs.forEach(({ spec, status }) => {
      table.addRow({ spec, status })
    })

    const output = table.render()

    expect(output).toContain('synced')
    expect(output).toContain('draft')
    expect(output).toContain('conflict')
    expect(output).toContain('local')
  })

  it('should show change indicators', () => {
    const table = new SpecTable()
    const specWithChanges = createMockSpec('changed-spec', 1)
    const specWithoutChanges = createMockSpec('unchanged-spec', 2)

    table.addRow({ spec: specWithChanges, status: createMockStatus('synced', true) })
    table.addRow({ spec: specWithoutChanges, status: createMockStatus('synced', false) })

    const output = table.render()

    // Should contain both change indicators (● and ○)
    expect(output).toMatch(/[●○]/)
  })

  it('should clear table contents', () => {
    const table = new SpecTable()
    const spec = createMockSpec('test-spec', 1)
    const status = createMockStatus('synced')

    table.addRow({ spec, status })
    expect(table.render()).toContain('test-spec')

    table.clear()
    const output = table.render()

    // Should only contain headers, no data rows
    expect(output).toContain('Spec Name')
    expect(output).not.toContain('test-spec')
  })
})
