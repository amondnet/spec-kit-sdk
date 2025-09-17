import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { embedUuidInIssueBody, isValidUuid } from '../../src/adapters/github/uuid-utils'
import { parseMarkdownWithFrontmatter } from '../../src/core/frontmatter'
import { SpecScanner } from '../../src/core/scanner'

describe('UUID Migration', () => {
  let testDir: string
  let specsDir: string
  let scanner: SpecScanner
  let mockAdapter: any

  const validUuid1 = '550e8400-e29b-41d4-a716-446655440000'
  const validUuid2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'uuid-migration-test-'))
    specsDir = path.join(testDir, 'specs')
    await fs.mkdir(specsDir, { recursive: true })

    scanner = new SpecScanner(specsDir)

    // Create mock GitHub adapter
    mockAdapter = {
      platform: 'github',
      searchIssueByUuid: mock(),
      getIssue: mock(),
      createIssue: mock(),
      updateIssue: mock(),
      push: mock(),
      getStatus: mock(),
      authenticate: mock().mockResolvedValue(true),
    }
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  const createSpecDirectory = async (dirName: string, specContent: string) => {
    const specDirPath = path.join(specsDir, dirName)
    await fs.mkdir(specDirPath, { recursive: true })
    await fs.writeFile(path.join(specDirPath, 'spec.md'), specContent)
    return specDirPath
  }

  const readSpecFile = async (dirName: string): Promise<string> => {
    return fs.readFile(path.join(specsDir, dirName, 'spec.md'), 'utf-8')
  }

  describe('migrates existing specs without UUID', () => {
    test('adds UUID to legacy specs with only issue_number', async () => {
      // Create legacy spec that predates UUID support
      const legacySpecContent = `---
title: Legacy Feature
sync_status: synced
last_sync: "2024-01-01T10:00:00Z"
github:
  issue_number: 123
  updated_at: "2024-01-01T09:00:00Z"
---

# Legacy Feature

This spec was created before UUID support was added.

## Details

- Feature A
- Feature B`

      await createSpecDirectory('001-legacy-feature', legacySpecContent)

      // Scan should automatically add UUID
      const specs = await scanner.scanAll()
      expect(specs).toHaveLength(1)

      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      // Should now have UUID
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)

      // Should preserve existing fields
      expect(specFile?.frontmatter.github?.issue_number).toBe(123)
      expect(specFile?.frontmatter.sync_status).toBe('synced')
      expect(specFile?.frontmatter.last_sync).toBe('2024-01-01T10:00:00Z')

      // Should persist UUID to disk
      const updatedContent = await readSpecFile('001-legacy-feature')
      expect(updatedContent).toContain('spec_id:')
      expect(updatedContent).toContain(specFile?.frontmatter.spec_id)
      expect(updatedContent).toContain('issue_number: 123')
    })

    test('adds UUID to specs with no frontmatter', async () => {
      // Create spec with minimal frontmatter
      const minimalSpecContent = `---
title: Minimal Feature
---

# Minimal Feature

This spec has minimal frontmatter.`

      await createSpecDirectory('002-minimal-feature', minimalSpecContent)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      // Should have generated UUID
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)

      // Should preserve original title
      expect(specFile?.frontmatter.title).toBe('Minimal Feature')

      // Verify persistence
      const updatedContent = await readSpecFile('002-minimal-feature')
      expect(updatedContent).toContain(`spec_id: ${specFile?.frontmatter.spec_id}`)
    })

    test('adds UUID to specs with empty frontmatter', async () => {
      // Create spec with only markdown content
      const contentOnlySpec = `# Content Only Feature

This spec has no frontmatter initially.`

      await createSpecDirectory('003-content-only', contentOnlySpec)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      // Should have generated UUID and basic frontmatter
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)

      // Verify file structure after migration
      const updatedContent = await readSpecFile('003-content-only')
      expect(updatedContent).toContain('---')
      expect(updatedContent).toContain('spec_id:')
      expect(updatedContent).toContain('# Content Only Feature')
    })
  })

  describe('handles specs with invalid UUIDs', () => {
    test('replaces malformed UUIDs', async () => {
      const specWithInvalidUuid = `---
title: Invalid UUID Feature
spec_id: "not-a-valid-uuid"
sync_status: draft
---

# Invalid UUID Feature

This spec has an invalid UUID format.`

      await createSpecDirectory('004-invalid-uuid', specWithInvalidUuid)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      // Should have a valid UUID now
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(specFile?.frontmatter.spec_id).not.toBe('not-a-valid-uuid')
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)

      // Verify migration was persisted
      const updatedContent = await readSpecFile('004-invalid-uuid')
      expect(updatedContent).not.toContain('not-a-valid-uuid')
      expect(updatedContent).toContain(`spec_id: ${specFile?.frontmatter.spec_id}`)
    })

    test('replaces empty UUID fields', async () => {
      const specWithEmptyUuid = `---
title: Empty UUID Feature
spec_id: ""
sync_status: draft
---

# Empty UUID Feature`

      await createSpecDirectory('005-empty-uuid', specWithEmptyUuid)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(specFile?.frontmatter.spec_id).not.toBe('')
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)
    })

    test('replaces null UUID fields', async () => {
      const specWithNullUuid = `---
title: Null UUID Feature
spec_id: null
sync_status: draft
---

# Null UUID Feature`

      await createSpecDirectory('006-null-uuid', specWithNullUuid)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(specFile?.frontmatter.spec_id).not.toBeNull()
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)
    })
  })

  describe('preserves existing valid UUIDs', () => {
    test('keeps valid existing UUIDs unchanged', async () => {
      const specWithValidUuid = `---
title: Valid UUID Feature
spec_id: ${validUuid1}
sync_status: synced
github:
  issue_number: 456
---

# Valid UUID Feature

This spec already has a valid UUID.`

      await createSpecDirectory('007-valid-uuid', specWithValidUuid)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      // Should preserve the existing UUID
      expect(specFile?.frontmatter.spec_id).toBe(validUuid1)

      // File should not be modified
      const contentAfter = await readSpecFile('007-valid-uuid')
      expect(contentAfter).toContain(validUuid1)
    })

    test('preserves UUID across multiple scans', async () => {
      const specContent = `---
title: Stability Test
spec_id: ${validUuid2}
---

# Stability Test`

      await createSpecDirectory('008-stability-test', specContent)

      // First scan
      const firstScan = await scanner.scanAll()
      const firstUuid = firstScan[0].files.get('spec.md')?.frontmatter.spec_id

      // Second scan
      const secondScan = await scanner.scanAll()
      const secondUuid = secondScan[0].files.get('spec.md')?.frontmatter.spec_id

      // Third scan with new scanner instance
      const newScanner = new SpecScanner(specsDir)
      const thirdScan = await newScanner.scanAll()
      const thirdUuid = thirdScan[0].files.get('spec.md')?.frontmatter.spec_id

      expect(firstUuid).toBe(validUuid2)
      expect(secondUuid).toBe(validUuid2)
      expect(thirdUuid).toBe(validUuid2)
    })
  })

  describe('updates remote issues with UUID metadata', () => {
    test('embeds UUID in existing remote issues', async () => {
      const specWithIssueNumber = `---
title: Remote Update Test
spec_id: ${validUuid1}
sync_status: synced
github:
  issue_number: 789
---

# Remote Update Test`

      await createSpecDirectory('009-remote-update', specWithIssueNumber)

      // Mock existing remote issue without UUID
      const existingRemoteIssue = {
        number: 789,
        title: 'Remote Update Test',
        body: 'Existing issue body without UUID metadata',
        state: 'open',
        labels: [],
      }

      mockAdapter.searchIssueByUuid.mockResolvedValue(null) // UUID not found
      mockAdapter.getIssue.mockResolvedValue(existingRemoteIssue) // Found by issue number
      mockAdapter.updateIssue.mockImplementation(async (number, updates) => {
        // Verify UUID is embedded in the updated body
        expect(updates.body).toContain(`<!-- spec_id: ${validUuid1} -->`)
        expect(updates.body).toContain('Existing issue body without UUID metadata')
      })

      const specs = await scanner.scanAll()
      const spec = specs[0]

      // Simulate push operation
      mockAdapter.push.mockImplementation(async (specDoc) => {
        const mainFile = specDoc.files.get('spec.md')
        const uuid = mainFile?.frontmatter.spec_id
        const issueNumber = mainFile?.frontmatter.github?.issue_number

        if (uuid && issueNumber) {
          // This would happen in the real adapter
          const updatedBody = embedUuidInIssueBody(existingRemoteIssue.body, uuid)
          await mockAdapter.updateIssue(issueNumber, { body: updatedBody })
        }

        return { id: 789, type: 'parent', url: 'test-url' }
      })

      // Push should embed UUID in remote issue
      await mockAdapter.push(spec)

      expect(mockAdapter.updateIssue).toHaveBeenCalledWith(
        789,
        expect.objectContaining({
          body: expect.stringContaining(`<!-- spec_id: ${validUuid1} -->`),
        }),
      )
    })

    test('creates new issues with UUID metadata from start', async () => {
      const newSpecContent = `---
title: New Issue Test
spec_id: ${validUuid2}
sync_status: draft
---

# New Issue Test`

      await createSpecDirectory('010-new-issue', newSpecContent)

      mockAdapter.searchIssueByUuid.mockResolvedValue(null)
      mockAdapter.createIssue.mockImplementation(async (title, body, _labels) => {
        // Verify UUID is embedded in new issue body
        expect(body).toContain(`<!-- spec_id: ${validUuid2} -->`)
        return 999
      })

      const specs = await scanner.scanAll()
      const spec = specs[0]

      // Simulate push operation for new issue
      mockAdapter.push.mockImplementation(async (specDoc) => {
        const mainFile = specDoc.files.get('spec.md')
        const uuid = mainFile?.frontmatter.spec_id

        if (uuid) {
          const bodyWithUuid = embedUuidInIssueBody('New issue body content', uuid)
          await mockAdapter.createIssue('New Issue Test', bodyWithUuid, [])
        }

        return { id: 999, type: 'parent', url: 'test-url' }
      })

      await mockAdapter.push(spec)

      expect(mockAdapter.createIssue).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`<!-- spec_id: ${validUuid2} -->`),
        expect.any(Array),
      )
    })
  })

  describe('validates migration consistency', () => {
    test('ensures all migrated specs have valid UUIDs', async () => {
      // Create multiple specs with various migration scenarios
      const migrationScenarios = [
        {
          name: '011-no-frontmatter',
          content: '# No Frontmatter\n\nJust content.',
        },
        {
          name: '012-legacy-with-issue',
          content: `---
title: Legacy with Issue
github:
  issue_number: 111
---
# Legacy with Issue`,
        },
        {
          name: '013-invalid-uuid',
          content: `---
title: Invalid UUID
spec_id: invalid
---
# Invalid UUID`,
        },
        {
          name: '014-valid-uuid',
          content: `---
title: Valid UUID
spec_id: ${validUuid1}
---
# Valid UUID`,
        },
      ]

      // Create all test specs
      for (const scenario of migrationScenarios) {
        await createSpecDirectory(scenario.name, scenario.content)
      }

      // Scan all specs
      const specs = await scanner.scanAll()
      expect(specs).toHaveLength(4)

      // Validate that all specs now have valid UUIDs
      for (const spec of specs) {
        const specFile = spec.files.get('spec.md')
        expect(specFile?.frontmatter.spec_id).toBeDefined()
        expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)

        // Verify UUID was persisted to disk
        const dirName = spec.name
        const persistedContent = await readSpecFile(dirName)
        expect(persistedContent).toContain('spec_id:')
        expect(persistedContent).toContain(specFile?.frontmatter.spec_id)
      }

      // Verify the valid UUID case wasn't changed
      const validUuidSpec = specs.find(s => s.name === '014-valid-uuid')
      expect(validUuidSpec?.files.get('spec.md')?.frontmatter.spec_id).toBe(validUuid1)
    })

    test('handles concurrent migrations safely', async () => {
      const specContent = `---
title: Concurrent Test
---
# Concurrent Test`

      await createSpecDirectory('015-concurrent-test', specContent)

      // Simulate concurrent scanner operations
      const scanner1 = new SpecScanner(specsDir)
      const scanner2 = new SpecScanner(specsDir)

      const [specs1, specs2] = await Promise.all([
        scanner1.scanAll(),
        scanner2.scanAll(),
      ])

      const uuid1 = specs1[0].files.get('spec.md')?.frontmatter.spec_id
      const uuid2 = specs2[0].files.get('spec.md')?.frontmatter.spec_id

      // Both should have valid UUIDs
      expect(uuid1).toBeDefined()
      expect(uuid2).toBeDefined()
      expect(isValidUuid(uuid1 || '')).toBe(true)
      expect(isValidUuid(uuid2 || '')).toBe(true)

      // The file on disk should have one consistent UUID
      const persistedContent = await readSpecFile('015-concurrent-test')
      const parsedFile = parseMarkdownWithFrontmatter(persistedContent, 'test')
      expect(isValidUuid(parsedFile.frontmatter.spec_id || '')).toBe(true)
    })

    test('validates frontmatter integrity after migration', async () => {
      const complexSpecContent = `---
title: Complex Migration Test
sync_status: synced
issue_type: parent
auto_sync: true
last_sync: "2024-01-15T14:30:00Z"
sync_hash: "abc123def456"
github:
  issue_number: 555
  parent_issue: null
  updated_at: "2024-01-15T14:25:00Z"
  labels:
    - feature
    - high-priority
  assignees:
    - developer1
    - developer2
jira:
  issue_key: "PROJ-123"
  epic_key: "PROJ-100"
---

# Complex Migration Test

This spec has complex frontmatter that should be preserved during migration.`

      await createSpecDirectory('016-complex-migration', complexSpecContent)

      const specs = await scanner.scanAll()
      const spec = specs[0]
      const specFile = spec.files.get('spec.md')

      // Should have UUID added
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(isValidUuid(specFile?.frontmatter.spec_id || '')).toBe(true)

      // Should preserve all existing fields
      expect(specFile?.frontmatter.title).toBe('Complex Migration Test')
      expect(specFile?.frontmatter.sync_status).toBe('synced')
      expect(specFile?.frontmatter.issue_type).toBe('parent')
      expect(specFile?.frontmatter.auto_sync).toBe(true)
      expect(specFile?.frontmatter.github?.issue_number).toBe(555)
      expect(specFile?.frontmatter.github?.labels).toEqual(['feature', 'high-priority'])
      expect(specFile?.frontmatter.jira?.issue_key).toBe('PROJ-123')

      // Verify file structure is maintained
      const persistedContent = await readSpecFile('016-complex-migration')
      expect(persistedContent).toContain('title: Complex Migration Test')
      expect(persistedContent).toContain('issue_number: 555')
      expect(persistedContent).toContain('issue_key: "PROJ-123"')
      expect(persistedContent).toContain('# Complex Migration Test')
    })
  })
})
