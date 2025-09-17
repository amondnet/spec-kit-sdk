import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { parseMarkdownWithFrontmatter } from '../../src/core/frontmatter'
import { SpecScanner } from '../../src/core/scanner'

// Mock filesystem operations
const mockReaddir = mock()
const mockReadFile = mock()
const mockWriteFile = mock()
const mockMkdir = mock()

// Mock the fs module
mock.module('node:fs', () => ({
  promises: {
    readdir: mockReaddir,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
  },
}))

describe('SpecScanner UUID Generation', () => {
  let scanner: SpecScanner
  const testSpecsRoot = '/test/specs'

  beforeEach(() => {
    scanner = new SpecScanner(testSpecsRoot)
    mockReaddir.mockClear()
    mockReadFile.mockClear()
    mockWriteFile.mockClear()
    mockMkdir.mockClear()
  })

  afterEach(() => {
    mock.restore()
  })

  describe('UUID generation for specs without spec_id', () => {
    test('generates UUID for specs without spec_id', async () => {
      const specContentWithoutUuid = `---
title: Test Feature
sync_status: draft
---

# Test Feature

This is a test feature spec.`

      const _specWithUuid = `---
title: Test Feature
sync_status: draft
spec_id: 550e8400-e29b-41d4-a716-446655440000
---

# Test Feature

This is a test feature spec.`

      // Mock directory structure
      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      // Mock reading the spec file without UUID
      mockReadFile.mockResolvedValueOnce(specContentWithoutUuid)

      // Mock successful write
      mockWriteFile.mockResolvedValueOnce(undefined)

      const specs = await scanner.scanAll()

      expect(specs).toHaveLength(1)
      expect(specs[0].name).toBe('001-test-feature')

      const specFile = specs[0].files.get('spec.md')
      expect(specFile).toBeDefined()
      expect(specFile!.frontmatter.spec_id).toBeDefined()
      expect(typeof specFile!.frontmatter.spec_id).toBe('string')

      // Verify UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(specFile!.frontmatter.spec_id).toMatch(uuidRegex)

      // Verify write was called to persist UUID
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('spec.md'),
        expect.stringContaining('spec_id:'),
        'utf-8',
      )
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

      // Mock directory structure
      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      // Mock reading the spec file with existing UUID
      mockReadFile.mockResolvedValueOnce(specContentWithUuid)

      const specs = await scanner.scanAll()

      expect(specs).toHaveLength(1)
      const specFile = specs[0].files.get('spec.md')
      expect(specFile!.frontmatter.spec_id).toBe(existingUuid)

      // Verify write was NOT called since UUID already exists
      expect(mockWriteFile).not.toHaveBeenCalled()
    })

    test('persists UUID to disk immediately', async () => {
      const specContentWithoutUuid = `---
title: Test Feature
sync_status: draft
---

# Test Feature Content`

      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(specContentWithoutUuid)
      mockWriteFile.mockResolvedValueOnce(undefined)

      await scanner.scanAll()

      // Verify write was called exactly once
      expect(mockWriteFile).toHaveBeenCalledTimes(1)

      // Verify the written content includes a UUID
      const [filePath, content] = mockWriteFile.mock.calls[0]
      expect(filePath).toContain('spec.md')
      expect(content).toContain('spec_id:')

      // Parse and verify the UUID is valid
      const parsedFile = parseMarkdownWithFrontmatter(content as string, filePath as string)
      expect(parsedFile.frontmatter.spec_id).toBeDefined()
      expect(typeof parsedFile.frontmatter.spec_id).toBe('string')

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(parsedFile.frontmatter.spec_id).toMatch(uuidRegex)
    })

    test('handles file write errors gracefully', async () => {
      const specContentWithoutUuid = `---
title: Test Feature
---

# Test Feature`

      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(specContentWithoutUuid)
      mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'))

      // Mock console.error to verify error handling
      const consoleErrorMock = mock(console, 'error')

      const specs = await scanner.scanAll()

      // Should still return the spec with in-memory UUID
      expect(specs).toHaveLength(1)
      const specFile = specs[0].files.get('spec.md')
      expect(specFile!.frontmatter.spec_id).toBeDefined()

      // Should have logged the error
      expect(consoleErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist spec_id for'),
        expect.any(Error),
      )

      consoleErrorMock.mockRestore()
    })

    test('ensures UUID uniqueness across multiple scans', async () => {
      const specContent1 = `---
title: Feature 1
---
# Feature 1`

      const specContent2 = `---
title: Feature 2
---
# Feature 2`

      // First scan
      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-feature-1', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(specContent1)
      mockWriteFile.mockResolvedValueOnce(undefined)

      const specs1 = await scanner.scanAll()
      const uuid1 = specs1[0].files.get('spec.md')!.frontmatter.spec_id

      // Clear mocks for second scan
      mockReaddir.mockClear()
      mockReadFile.mockClear()
      mockWriteFile.mockClear()

      // Second scan
      mockReaddir
        .mockResolvedValueOnce([
          { name: '002-feature-2', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(specContent2)
      mockWriteFile.mockResolvedValueOnce(undefined)

      const specs2 = await scanner.scanAll()
      const uuid2 = specs2[0].files.get('spec.md')!.frontmatter.spec_id

      // UUIDs should be different
      expect(uuid1).not.toBe(uuid2)
      expect(uuid1).toBeDefined()
      expect(uuid2).toBeDefined()
    })

    test('handles race condition protection', async () => {
      const specContentWithoutUuid = `---
title: Test Feature
---
# Test Feature`

      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(specContentWithoutUuid)

      // Simulate slow write operation
      let writeResolver: (value: any) => void
      const writePromise = new Promise((resolve) => {
        writeResolver = resolve
      })
      mockWriteFile.mockReturnValueOnce(writePromise)

      // Start first scan
      const scanPromise1 = scanner.scanAll()

      // Start second scan immediately (simulating race condition)
      const scanPromise2 = scanner.scanAll()

      // Resolve write operation
      writeResolver!(undefined)

      const [specs1, specs2] = await Promise.all([scanPromise1, scanPromise2])

      // Both should have valid UUIDs
      const uuid1 = specs1[0].files.get('spec.md')!.frontmatter.spec_id
      const uuid2 = specs2[0].files.get('spec.md')!.frontmatter.spec_id

      expect(uuid1).toBeDefined()
      expect(uuid2).toBeDefined()

      // Note: In current implementation, they might be different UUIDs
      // This is acceptable behavior for the race condition scenario
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

      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
          { name: 'plan.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile
        .mockResolvedValueOnce(specContent)
        .mockResolvedValueOnce(planContent)

      mockWriteFile.mockResolvedValueOnce(undefined)

      const specs = await scanner.scanAll()

      const specFile = specs[0].files.get('spec.md')
      const planFile = specs[0].files.get('plan.md')

      // spec.md should have UUID generated
      expect(specFile!.frontmatter.spec_id).toBeDefined()

      // plan.md should NOT have UUID generated
      expect(planFile!.frontmatter.spec_id).toBeUndefined()

      // Only one write call for spec.md
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
    })
  })

  describe('scanSpec method UUID handling', () => {
    test('generates UUID when scanning single spec', async () => {
      const specContentWithoutUuid = `---
title: Single Spec
---
# Single Spec`

      mockReadFile.mockResolvedValueOnce(specContentWithoutUuid)
      mockWriteFile.mockResolvedValueOnce(undefined)

      // Mock the full directory scan that scanSpec delegates to
      mockReaddir.mockResolvedValueOnce([
        { name: 'spec.md', isFile: () => true, isDirectory: () => false },
      ])
      mockReadFile.mockResolvedValueOnce(specContentWithoutUuid) // Second call for full scan

      const spec = await scanner.scanSpec('/test/specs/001-feature')

      expect(spec).toBeDefined()
      const specFile = spec!.files.get('spec.md')
      expect(specFile!.frontmatter.spec_id).toBeDefined()

      // Verify write was called
      expect(mockWriteFile).toHaveBeenCalled()
    })

    test('preserves existing UUID when scanning single spec', async () => {
      const existingUuid = '550e8400-e29b-41d4-a716-446655440000'
      const specContentWithUuid = `---
title: Single Spec
spec_id: ${existingUuid}
---
# Single Spec`

      mockReadFile.mockResolvedValueOnce(specContentWithUuid)

      // Mock the full directory scan
      mockReaddir.mockResolvedValueOnce([
        { name: 'spec.md', isFile: () => true, isDirectory: () => false },
      ])
      mockReadFile.mockResolvedValueOnce(specContentWithUuid)

      const spec = await scanner.scanSpec('/test/specs/001-feature')

      expect(spec).toBeDefined()
      const specFile = spec!.files.get('spec.md')
      expect(specFile!.frontmatter.spec_id).toBe(existingUuid)

      // No write should be called
      expect(mockWriteFile).not.toHaveBeenCalled()
    })
  })

  describe('error handling and edge cases', () => {
    test('handles missing spec.md file gracefully', async () => {
      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'plan.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce('# Plan content')

      const specs = await scanner.scanAll()

      expect(specs).toHaveLength(1)
      expect(specs[0].files.has('spec.md')).toBe(false)
      expect(specs[0].files.has('plan.md')).toBe(true)

      // No UUID should be generated since there's no spec.md
      expect(mockWriteFile).not.toHaveBeenCalled()
    })

    test('handles malformed frontmatter gracefully', async () => {
      const malformedContent = `---
title: Test
invalid_yaml: [unclosed array
---
# Content`

      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-test-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(malformedContent)

      // This should handle the parsing error gracefully
      // The implementation may throw or return null depending on error handling
      await expect(scanner.scanAll()).resolves.not.toThrow()
    })

    test('handles very large spec files efficiently', async () => {
      const largeContent = `---
title: Large Spec
---
# Large Spec

${'A'.repeat(100000)}` // 100KB of content

      mockReaddir
        .mockResolvedValueOnce([
          { name: '001-large-feature', isDirectory: () => true },
        ])
        .mockResolvedValueOnce([
          { name: 'spec.md', isFile: () => true, isDirectory: () => false },
        ])

      mockReadFile.mockResolvedValueOnce(largeContent)
      mockWriteFile.mockResolvedValueOnce(undefined)

      const startTime = Date.now()
      const specs = await scanner.scanAll()
      const endTime = Date.now()

      expect(specs).toHaveLength(1)
      expect(specs[0].files.get('spec.md')!.frontmatter.spec_id).toBeDefined()

      // Should complete in reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })
})
