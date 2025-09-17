import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { isValidUuid } from '../../src/adapters/github/uuid-utils'
import { SpecScanner } from '../../src/core/scanner'

describe('SpecScanner UUID Generation (Real FS)', () => {
  let testDir: string
  let specsDir: string
  let scanner: SpecScanner

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'scanner-uuid-test-'))
    specsDir = path.join(testDir, 'specs')
    await fs.mkdir(specsDir, { recursive: true })
    scanner = new SpecScanner(specsDir)
  })

  afterEach(async () => {
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

  test('generates UUID for specs without spec_id', async () => {
    const specContentWithoutUuid = `---
title: Test Feature
sync_status: draft
---

# Test Feature

This is a test feature spec.`

    await createSpecDirectory('001-test-feature', specContentWithoutUuid)

    const specs = await scanner.scanAll()

    expect(specs).toHaveLength(1)
    expect(specs[0].name).toBe('001-test-feature')

    const specFile = specs[0].files.get('spec.md')
    expect(specFile).toBeDefined()
    expect(specFile!.frontmatter.spec_id).toBeDefined()
    expect(typeof specFile!.frontmatter.spec_id).toBe('string')

    // Verify UUID format
    expect(isValidUuid(specFile!.frontmatter.spec_id || '')).toBe(true)

    // Verify UUID was persisted to disk
    const updatedContent = await readSpecFile('001-test-feature')
    expect(updatedContent).toContain('spec_id:')
    expect(updatedContent).toContain(specFile!.frontmatter.spec_id)
  })

  test('preserves existing UUIDs', async () => {
    const existingUuid = '550e8400-e29b-41d4-a716-446655440000'
    const specContentWithUuid = `---
title: Test Feature
sync_status: draft
spec_id: ${existingUuid}
---

# Test Feature

This is a test feature spec.`

    await createSpecDirectory('001-test-feature', specContentWithUuid)

    const specs = await scanner.scanAll()

    expect(specs).toHaveLength(1)
    const specFile = specs[0].files.get('spec.md')
    expect(specFile!.frontmatter.spec_id).toBe(existingUuid)

    // Verify file content wasn't changed
    const contentAfter = await readSpecFile('001-test-feature')
    expect(contentAfter).toContain(existingUuid)
  })

  test('ensures UUID uniqueness across multiple specs', async () => {
    const specContent1 = `---
title: Feature 1
---
# Feature 1`

    const specContent2 = `---
title: Feature 2
---
# Feature 2`

    await createSpecDirectory('001-feature-1', specContent1)
    await createSpecDirectory('002-feature-2', specContent2)

    const specs = await scanner.scanAll()

    expect(specs).toHaveLength(2)

    const uuid1 = specs[0].files.get('spec.md')!.frontmatter.spec_id
    const uuid2 = specs[1].files.get('spec.md')!.frontmatter.spec_id

    // UUIDs should be different
    expect(uuid1).not.toBe(uuid2)
    expect(uuid1).toBeDefined()
    expect(uuid2).toBeDefined()
    expect(isValidUuid(uuid1 || '')).toBe(true)
    expect(isValidUuid(uuid2 || '')).toBe(true)
  })

  test('only generates UUIDs for spec.md files', async () => {
    const specContent = `---
title: Main Spec
---
# Main Spec`

    const planContent = `---
title: Implementation Plan
---
# Plan`

    const specDirPath = path.join(specsDir, '001-test-feature')
    await fs.mkdir(specDirPath, { recursive: true })
    await fs.writeFile(path.join(specDirPath, 'spec.md'), specContent)
    await fs.writeFile(path.join(specDirPath, 'plan.md'), planContent)

    const specs = await scanner.scanAll()

    const specFile = specs[0].files.get('spec.md')
    const planFile = specs[0].files.get('plan.md')

    // spec.md should have UUID generated
    expect(specFile!.frontmatter.spec_id).toBeDefined()
    expect(isValidUuid(specFile!.frontmatter.spec_id || '')).toBe(true)

    // plan.md should NOT have UUID generated
    expect(planFile!.frontmatter.spec_id).toBeUndefined()
  })

  test('handles specs with empty frontmatter', async () => {
    const contentOnlySpec = `# Content Only Feature

This spec has no frontmatter initially.`

    await createSpecDirectory('003-content-only', contentOnlySpec)

    const specs = await scanner.scanAll()
    const spec = specs[0]
    const specFile = spec.files.get('spec.md')

    // Should have generated UUID and basic frontmatter
    expect(specFile!.frontmatter.spec_id).toBeDefined()
    expect(isValidUuid(specFile!.frontmatter.spec_id || '')).toBe(true)

    // Verify file structure after migration
    const updatedContent = await readSpecFile('003-content-only')
    expect(updatedContent).toContain('---')
    expect(updatedContent).toContain('spec_id:')
    expect(updatedContent).toContain('# Content Only Feature')
  })

  test('persists UUID across multiple scans', async () => {
    const specContent = `---
title: Persistence Test
---
# Persistence Test`

    await createSpecDirectory('004-persistence-test', specContent)

    // First scan
    const firstScan = await scanner.scanAll()
    const firstUuid = firstScan[0].files.get('spec.md')!.frontmatter.spec_id

    // Second scan with same scanner
    const secondScan = await scanner.scanAll()
    const secondUuid = secondScan[0].files.get('spec.md')!.frontmatter.spec_id

    // Third scan with new scanner instance
    const newScanner = new SpecScanner(specsDir)
    const thirdScan = await newScanner.scanAll()
    const thirdUuid = thirdScan[0].files.get('spec.md')!.frontmatter.spec_id

    expect(firstUuid).toBe(secondUuid)
    expect(secondUuid).toBe(thirdUuid)
    expect(isValidUuid(firstUuid || '')).toBe(true)
  })

  test('scanSpec method generates UUID', async () => {
    const specContentWithoutUuid = `---
title: Single Spec
---
# Single Spec`

    const specPath = await createSpecDirectory('005-single-spec', specContentWithoutUuid)

    const spec = await scanner.scanSpec(specPath)

    expect(spec).toBeDefined()
    const specFile = spec!.files.get('spec.md')
    expect(specFile!.frontmatter.spec_id).toBeDefined()
    expect(isValidUuid(specFile!.frontmatter.spec_id || '')).toBe(true)

    // Verify persistence
    const updatedContent = await readSpecFile('005-single-spec')
    expect(updatedContent).toContain(`spec_id: ${specFile!.frontmatter.spec_id}`)
  })

  test('handles complex frontmatter during UUID generation', async () => {
    const complexSpecContent = `---
title: Complex Feature
sync_status: synced
issue_type: parent
auto_sync: true
last_sync: "2024-01-15T14:30:00Z"
sync_hash: "abc123def456"
github:
  issue_number: 555
  labels:
    - feature
    - high-priority
  assignees:
    - developer1
jira:
  issue_key: "PROJ-123"
---

# Complex Feature

This spec has complex frontmatter.`

    await createSpecDirectory('006-complex', complexSpecContent)

    const specs = await scanner.scanAll()
    const spec = specs[0]
    const specFile = spec.files.get('spec.md')

    // Should have UUID added
    expect(specFile!.frontmatter.spec_id).toBeDefined()
    expect(isValidUuid(specFile!.frontmatter.spec_id || '')).toBe(true)

    // Should preserve all existing fields
    expect(specFile!.frontmatter.title).toBe('Complex Feature')
    expect(specFile!.frontmatter.sync_status).toBe('synced')
    expect(specFile!.frontmatter.github?.issue_number).toBe(555)
    expect(specFile!.frontmatter.jira?.issue_key).toBe('PROJ-123')

    // Verify persistence maintains structure
    const persistedContent = await readSpecFile('006-complex')
    expect(persistedContent).toContain('title: Complex Feature')
    expect(persistedContent).toContain('issue_number: 555')
    expect(persistedContent).toContain('issue_key: "PROJ-123"')
  })
})
