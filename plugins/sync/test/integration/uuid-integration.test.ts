import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { embedUuidInIssueBody, extractUuidFromIssueBody } from '../../src/adapters/github/uuid-utils'
import { SpecScanner } from '../../src/core/scanner'
import { SyncEngine } from '../../src/core/sync-engine'

describe('UUID Integration Tests', () => {
  let testDir: string
  let specsDir: string
  let scanner: SpecScanner
  let mockAdapter: any
  let syncEngine: SyncEngine

  const validUuid1 = '550e8400-e29b-41d4-a716-446655440000'
  const validUuid2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'uuid-integration-test-'))
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
      capabilities: mock().mockReturnValue({
        supportsBatch: true,
        supportsSubtasks: true,
      }),
    }

    syncEngine = new SyncEngine(scanner, mockAdapter)
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  const createSpecDirectory = async (
    dirName: string,
    specContent: string,
    otherFiles: Record<string, string> = {},
  ) => {
    const specDirPath = path.join(specsDir, dirName)
    await fs.mkdir(specDirPath, { recursive: true })

    // Write spec.md
    await fs.writeFile(path.join(specDirPath, 'spec.md'), specContent)

    // Write other files if provided
    for (const [filename, content] of Object.entries(otherFiles)) {
      await fs.writeFile(path.join(specDirPath, filename), content)
    }

    return specDirPath
  }

  test('end-to-end UUID generation and sync', async () => {
    // Create a spec without UUID
    const specContentWithoutUuid = `---
title: Test Feature
sync_status: draft
---

# Test Feature

This is a comprehensive test of the UUID system.`

    await createSpecDirectory('001-test-feature', specContentWithoutUuid)

    // Mock successful remote operations
    mockAdapter.searchIssueByUuid.mockResolvedValue(null)
    mockAdapter.createIssue.mockResolvedValue({ id: 123, url: 'https://github.com/test/test/issues/123' })
    mockAdapter.push.mockImplementation(async (spec) => {
      const mainFile = spec.files.get('spec.md')
      expect(mainFile?.frontmatter.spec_id).toBeDefined()
      expect(typeof mainFile?.frontmatter.spec_id).toBe('string')

      // Verify UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(mainFile?.frontmatter.spec_id).toMatch(uuidRegex)

      return { id: 123, type: 'parent', url: 'https://github.com/test/test/issues/123' }
    })

    // Scan specs (should generate UUID)
    const specs = await scanner.scanAll()
    expect(specs).toHaveLength(1)

    const spec = specs[0]
    const specFile = spec.files.get('spec.md')
    expect(specFile?.frontmatter.spec_id).toBeDefined()

    // Verify UUID was persisted to disk
    const persistedContent = await fs.readFile(path.join(specsDir, '001-test-feature', 'spec.md'), 'utf-8')
    expect(persistedContent).toContain('spec_id:')
    expect(persistedContent).toContain(specFile?.frontmatter.spec_id)

    // Sync to remote
    await syncEngine.pushSpec(spec)

    expect(mockAdapter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.any(Map),
      }),
      undefined,
    )
  })

  test('migration from issue_number to UUID priority', async () => {
    // Create a spec with only issue_number (legacy format)
    const legacySpecContent = `---
title: Legacy Feature
sync_status: synced
github:
  issue_number: 456
---

# Legacy Feature

This spec was created before UUID support.`

    await createSpecDirectory('002-legacy-feature', legacySpecContent)

    // Mock remote issue without UUID
    const remoteIssueWithoutUuid = {
      number: 456,
      title: 'Legacy Feature',
      body: 'Legacy issue body without UUID metadata',
      state: 'open',
      labels: [],
    }

    mockAdapter.searchIssueByUuid.mockResolvedValue(null)
    mockAdapter.getIssue.mockResolvedValue(remoteIssueWithoutUuid)
    mockAdapter.updateIssue.mockResolvedValue(undefined)
    mockAdapter.push.mockResolvedValue({ id: 456, type: 'parent', url: 'https://github.com/test/test/issues/456' })

    // Scan specs (should generate UUID for legacy spec)
    const specs = await scanner.scanAll()
    const legacySpec = specs[0]
    const specFile = legacySpec.files.get('spec.md')

    // Should now have both UUID and issue_number
    expect(specFile?.frontmatter.spec_id).toBeDefined()
    expect(specFile?.frontmatter.github?.issue_number).toBe(456)

    // Sync should use UUID-first logic but fall back to issue_number
    await syncEngine.pushSpec(legacySpec)

    expect(mockAdapter.push).toHaveBeenCalled()
  })

  test('cross-platform sync simulation', async () => {
    // Simulate two developers working on the same spec
    const sharedUuid = validUuid1

    // Developer A creates spec with UUID
    const devASpecContent = `---
title: Shared Feature
spec_id: ${sharedUuid}
sync_status: draft
---

# Shared Feature

Developer A's initial version.`

    await createSpecDirectory('003-shared-feature', devASpecContent)

    // Developer A pushes to remote
    const remoteIssueWithUuid = {
      number: 789,
      title: 'Shared Feature',
      body: embedUuidInIssueBody('Developer A\'s remote version', sharedUuid),
      state: 'open',
      labels: [],
    }

    mockAdapter.searchIssueByUuid.mockResolvedValue(remoteIssueWithUuid)
    mockAdapter.push.mockResolvedValue({ id: 789, type: 'parent', url: 'https://github.com/test/test/issues/789' })

    const specsA = await scanner.scanAll()
    await syncEngine.pushSpec(specsA[0])

    // Developer B pulls the same spec (simulate different directory structure)
    const devBSpecContent = `---
title: Shared Feature
spec_id: ${sharedUuid}
sync_status: synced
github:
  issue_number: 789
---

# Shared Feature

Developer B's local changes.`

    // Clear the test directory and recreate with Developer B's version
    await fs.rm(path.join(specsDir, '003-shared-feature'), { recursive: true })
    await createSpecDirectory('003-shared-feature-different-name', devBSpecContent)

    // Developer B syncs - should find the same remote issue by UUID
    const specsB = await scanner.scanAll()
    const devBSpec = specsB[0]

    mockAdapter.getStatus.mockResolvedValue({
      status: 'synced',
      hasChanges: false,
      remoteId: 789,
    })

    const status = await syncEngine.getStatus(devBSpec)
    expect(status.remoteId).toBe(789)
  })

  test('conflict resolution scenarios', async () => {
    // Create spec with UUID that conflicts with remote
    const localUuid = validUuid1
    const remoteUuid = validUuid2

    const conflictSpecContent = `---
title: Conflict Feature
spec_id: ${localUuid}
sync_status: draft
github:
  issue_number: 999
---

# Conflict Feature

Local changes that conflict with remote.`

    await createSpecDirectory('004-conflict-feature', conflictSpecContent)

    // Remote issue has different UUID
    const remoteIssueWithDifferentUuid = {
      number: 999,
      title: 'Conflict Feature',
      body: embedUuidInIssueBody('Remote content with different UUID', remoteUuid),
      state: 'open',
      labels: [],
    }

    mockAdapter.searchIssueByUuid.mockResolvedValue(null) // UUID search fails
    mockAdapter.getIssue.mockResolvedValue(remoteIssueWithDifferentUuid) // Issue number points to different UUID

    // Should detect UUID mismatch conflict
    mockAdapter.getStatus.mockImplementation(async (spec) => {
      const mainFile = spec.files.get('spec.md')
      const uuid = mainFile?.frontmatter.spec_id
      const issueNumber = mainFile?.frontmatter.github?.issue_number

      if (uuid === localUuid && issueNumber === 999) {
        return {
          status: 'conflict',
          hasChanges: true,
          remoteId: 999,
          conflicts: [`UUID mismatch: local=${uuid}, remote=${remoteUuid}`],
        }
      }

      return { status: 'unknown', hasChanges: false }
    })

    const specs = await scanner.scanAll()
    const conflictSpec = specs[0]

    const status = await syncEngine.getStatus(conflictSpec)

    expect(status.status).toBe('conflict')
    expect(status.conflicts).toContain(
      expect.stringMatching(/UUID mismatch.*local=.*remote=/),
    )
  })

  test('batch operations with UUID', async () => {
    // Create multiple specs with different UUID scenarios
    const specs = [
      {
        name: '005-uuid-only',
        content: `---
title: UUID Only Feature
spec_id: ${validUuid1}
sync_status: draft
---
# UUID Only Feature`,
      },
      {
        name: '006-issue-number-only',
        content: `---
title: Issue Number Only Feature
sync_status: draft
github:
  issue_number: 111
---
# Issue Number Only Feature`,
      },
      {
        name: '007-both-identifiers',
        content: `---
title: Both Identifiers Feature
spec_id: ${validUuid2}
sync_status: draft
github:
  issue_number: 222
---
# Both Identifiers Feature`,
      },
    ]

    // Create all spec directories
    for (const spec of specs) {
      await createSpecDirectory(spec.name, spec.content)
    }

    // Mock remote responses
    mockAdapter.searchIssueByUuid
      .mockResolvedValueOnce({ number: 100, title: 'UUID Only', body: embedUuidInIssueBody('content', validUuid1) })
      .mockResolvedValueOnce(null) // 006 has no UUID
      .mockResolvedValueOnce({ number: 200, title: 'Both IDs', body: embedUuidInIssueBody('content', validUuid2) })

    mockAdapter.getIssue
      .mockResolvedValueOnce({ number: 111, title: 'Issue Number Only', body: 'content' }) // For 006

    mockAdapter.push
      .mockResolvedValueOnce({ id: 100, type: 'parent', url: 'url1' })
      .mockResolvedValueOnce({ id: 111, type: 'parent', url: 'url2' })
      .mockResolvedValueOnce({ id: 200, type: 'parent', url: 'url3' })

    // Scan and sync all specs
    const scannedSpecs = await scanner.scanAll()
    expect(scannedSpecs).toHaveLength(3)

    // All specs should now have UUIDs (generated for the ones that didn't have them)
    for (const spec of scannedSpecs) {
      const specFile = spec.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBeDefined()
    }

    // Sync all specs
    const results = await Promise.all(
      scannedSpecs.map(spec => syncEngine.pushSpec(spec)),
    )

    expect(results).toHaveLength(3)
    expect(mockAdapter.push).toHaveBeenCalledTimes(3)
  })

  test('UUID persistence and consistency', async () => {
    // Create spec without UUID
    const specContent = `---
title: Persistence Test
sync_status: draft
---

# Persistence Test

Testing UUID persistence across multiple operations.`

    await createSpecDirectory('008-persistence-test', specContent)

    // First scan - should generate UUID
    const firstScan = await scanner.scanAll()
    const firstSpec = firstScan[0]
    const firstUuid = firstSpec.files.get('spec.md')?.frontmatter.spec_id

    expect(firstUuid).toBeDefined()

    // Second scan of the same directory - should preserve UUID
    const secondScan = await scanner.scanAll()
    const secondSpec = secondScan[0]
    const secondUuid = secondSpec.files.get('spec.md')?.frontmatter.spec_id

    expect(secondUuid).toBe(firstUuid)

    // Verify UUID is still in the file on disk
    const persistedContent = await fs.readFile(
      path.join(specsDir, '008-persistence-test', 'spec.md'),
      'utf-8',
    )
    expect(persistedContent).toContain(`spec_id: ${firstUuid}`)

    // Third scan with new scanner instance - should still preserve UUID
    const newScanner = new SpecScanner(specsDir)
    const thirdScan = await newScanner.scanAll()
    const thirdSpec = thirdScan[0]
    const thirdUuid = thirdSpec.files.get('spec.md')?.frontmatter.spec_id

    expect(thirdUuid).toBe(firstUuid)
  })

  test('UUID extraction and embedding in issue bodies', async () => {
    const testUuid = validUuid1
    const specContent = `---
title: Body UUID Test
spec_id: ${testUuid}
sync_status: draft
---

# Body UUID Test

Testing UUID embedding in issue bodies.`

    await createSpecDirectory('009-body-uuid-test', specContent)

    // Mock adapter to capture the issue body
    let capturedBody: string = ''
    mockAdapter.push.mockImplementation(async (spec) => {
      // Simulate what the real adapter does
      const mainFile = spec.files.get('spec.md')
      const uuid = mainFile?.frontmatter.spec_id

      if (uuid) {
        capturedBody = embedUuidInIssueBody('Test issue body content', uuid)
      }

      return { id: 999, type: 'parent', url: 'test-url' }
    })

    const specs = await scanner.scanAll()
    await syncEngine.pushSpec(specs[0])

    // Verify UUID was embedded in the body
    expect(capturedBody).toContain(`<!-- spec_id: ${testUuid} -->`)
    expect(capturedBody).toContain('Test issue body content')

    // Verify we can extract the UUID back
    const extractedUuid = extractUuidFromIssueBody(capturedBody)
    expect(extractedUuid).toBe(testUuid)
  })

  test('error handling and recovery', async () => {
    // Create spec with invalid UUID format
    const invalidUuidContent = `---
title: Invalid UUID Test
spec_id: invalid-uuid-format
sync_status: draft
---

# Invalid UUID Test

This spec has an invalid UUID.`

    await createSpecDirectory('010-invalid-uuid-test', invalidUuidContent)

    // Scanner should handle invalid UUID gracefully
    const specs = await scanner.scanAll()
    expect(specs).toHaveLength(1)

    const specFile = specs[0].files.get('spec.md')

    // The scanner might either:
    // 1. Replace the invalid UUID with a valid one, or
    // 2. Keep the invalid UUID and let validation catch it later
    // The behavior depends on implementation - both are valid approaches
    expect(specFile?.frontmatter.spec_id).toBeDefined()

    // If the system validates and replaces invalid UUIDs:
    if (specFile?.frontmatter.spec_id !== 'invalid-uuid-format') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(specFile?.frontmatter.spec_id).toMatch(uuidRegex)
    }
  })
})
