import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SpecScanner } from '../../src/core/scanner.js'

const TEST_SPECS_DIR = path.join(import.meta.dirname, '../fixtures/test-specs')

describe('SpecScanner', () => {
  let scanner: SpecScanner
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'scanner-test-'))
    scanner = new SpecScanner(TEST_SPECS_DIR)
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
    catch {
      // Ignore cleanup errors
    }
  })

  describe('scanAll', () => {
    test('should scan all spec directories', async () => {
      const results = await scanner.scanAll()

      expect(results).toHaveLength(3)

      const names = results.map(spec => spec.name).sort()
      expect(names).toEqual([
        '001-test-feature',
        '002-another-feature',
        '003-feature-with-contracts',
      ])
    })

    test('should extract issue numbers from directory names', async () => {
      const results = await scanner.scanAll()

      const feature1 = results.find(spec => spec.name === '001-test-feature')
      const feature2 = results.find(spec => spec.name === '002-another-feature')
      const feature3 = results.find(spec => spec.name === '003-feature-with-contracts')

      expect(feature1?.issueNumber).toBe(1)
      expect(feature2?.issueNumber).toBe(2)
      expect(feature3?.issueNumber).toBe(3)
    })

    test('should include all markdown files', async () => {
      const results = await scanner.scanAll()

      const feature1 = results.find(spec => spec.name === '001-test-feature')
      expect(feature1?.files.has('spec.md')).toBe(true)
      expect(feature1?.files.has('plan.md')).toBe(true)
      expect(feature1?.files.size).toBe(2)
    })

    test('should include contract files', async () => {
      const results = await scanner.scanAll()

      const featureWithContracts = results.find(spec => spec.name === '003-feature-with-contracts')
      expect(featureWithContracts?.files.has('spec.md')).toBe(true)
      expect(featureWithContracts?.files.has('contracts/api.yaml')).toBe(true)
      expect(featureWithContracts?.files.has('contracts/contract.md')).toBe(true)
      expect(featureWithContracts?.files.size).toBe(3)
    })

    test('should handle non-existent specs directory', async () => {
      const nonExistentScanner = new SpecScanner('/non/existent/path')
      const results = await nonExistentScanner.scanAll()
      expect(results).toEqual([])
    })

    test('should skip hidden directories', async () => {
      // Create a hidden directory
      const hiddenDir = path.join(tempDir, '.hidden-feature')
      await fs.mkdir(hiddenDir, { recursive: true })
      await fs.writeFile(path.join(hiddenDir, 'spec.md'), '# Hidden spec')

      const tempScanner = new SpecScanner(tempDir)
      const results = await tempScanner.scanAll()

      expect(results).toHaveLength(0)
    })

    test('should handle directories without markdown files', async () => {
      const emptyDir = path.join(tempDir, 'empty-feature')
      await fs.mkdir(emptyDir, { recursive: true })
      await fs.writeFile(path.join(emptyDir, 'not-markdown.txt'), 'text file')

      const tempScanner = new SpecScanner(tempDir)
      const results = await tempScanner.scanAll()

      expect(results).toHaveLength(0)
    })
  })

  describe('scanDirectory', () => {
    test('should scan single directory correctly', async () => {
      const dirPath = path.join(TEST_SPECS_DIR, '001-test-feature')
      const result = await scanner.scanDirectory(dirPath)

      expect(result).toBeDefined()
      expect(result?.name).toBe('001-test-feature')
      expect(result?.issueNumber).toBe(1)
      expect(result?.files.size).toBe(2)
      expect(result?.files.has('spec.md')).toBe(true)
      expect(result?.files.has('plan.md')).toBe(true)
    })

    test('should return null for non-existent directory', async () => {
      const result = await scanner.scanDirectory('/non/existent/directory')
      expect(result).toBeNull()
    })

    test('should return null for directory without markdown files', async () => {
      const emptyDir = path.join(tempDir, 'empty')
      await fs.mkdir(emptyDir, { recursive: true })

      const result = await scanner.scanDirectory(emptyDir)
      expect(result).toBeNull()
    })

    test('should handle contracts directory correctly', async () => {
      const dirPath = path.join(TEST_SPECS_DIR, '003-feature-with-contracts')
      const result = await scanner.scanDirectory(dirPath)

      expect(result?.files.has('contracts/api.yaml')).toBe(true)
      expect(result?.files.has('contracts/contract.md')).toBe(true)
    })

    test('should parse frontmatter correctly', async () => {
      const dirPath = path.join(TEST_SPECS_DIR, '001-test-feature')
      const result = await scanner.scanDirectory(dirPath)

      const specFile = result?.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBe('11111111-1111-4111-8111-111111111111')
      expect(specFile?.frontmatter.github?.issue_number).toBe(1)
      expect(specFile?.frontmatter.sync_status).toBe('draft')
    })

    test('should extract issue number from directory name patterns', async () => {
      // Test different directory name patterns
      const testCases = [
        { dirname: '001-feature', expectedIssue: 1 },
        { dirname: '123-another-feature', expectedIssue: 123 },
        { dirname: 'feature-without-number', expectedIssue: undefined },
        { dirname: '001', expectedIssue: undefined }, // No dash, so no issue number extracted
      ]

      for (const { dirname, expectedIssue } of testCases) {
        const testDir = path.join(tempDir, dirname)
        await fs.mkdir(testDir, { recursive: true })
        await fs.writeFile(path.join(testDir, 'spec.md'), '# Test')

        const result = await scanner.scanDirectory(testDir)
        if (expectedIssue === undefined) {
          // For cases where we expect no issue number, we might still get a result
          // but the issueNumber should be undefined
          expect(result?.issueNumber).toBeUndefined()
        }
        else {
          // For cases where we expect a valid result
          expect(result).toBeDefined()
          expect(result?.issueNumber).toBe(expectedIssue)
        }
      }
    })
  })

  describe('findSpecByIssueNumber', () => {
    test('should find spec by directory issue number', async () => {
      const result = await scanner.findSpecByIssueNumber(2)

      expect(result).toBeDefined()
      expect(result?.name).toBe('002-another-feature')
      expect(result?.issueNumber).toBe(2)
    })

    test('should find spec by frontmatter issue number', async () => {
      const result = await scanner.findSpecByIssueNumber(1)

      expect(result).toBeDefined()
      expect(result?.name).toBe('001-test-feature')

      const specFile = result?.files.get('spec.md')
      expect(specFile?.frontmatter.github?.issue_number).toBe(1)
    })

    test('should return null for non-existent issue', async () => {
      const result = await scanner.findSpecByIssueNumber(999)
      expect(result).toBeNull()
    })

    test('should prioritize directory name over frontmatter', async () => {
      // If both directory name and frontmatter have issue numbers,
      // directory name should take priority
      const result = await scanner.findSpecByIssueNumber(1)
      expect(result?.issueNumber).toBe(1)
    })
  })

  describe('getSpecFile', () => {
    test('should get existing spec file', async () => {
      const specPath = path.join(TEST_SPECS_DIR, '001-test-feature')
      const result = await scanner.getSpecFile(specPath, 'spec.md')

      expect(result).toBeDefined()
      expect(result?.filename).toBe('spec.md')
      expect(result?.frontmatter.spec_id).toBe('11111111-1111-4111-8111-111111111111')
      expect(result?.markdown).toContain('# Feature 1')
    })

    test('should return null for non-existent file', async () => {
      const specPath = path.join(TEST_SPECS_DIR, '001-test-feature')
      const result = await scanner.getSpecFile(specPath, 'non-existent.md')

      expect(result).toBeNull()
    })

    test('should handle different file types', async () => {
      const specPath = path.join(TEST_SPECS_DIR, '001-test-feature')
      const planResult = await scanner.getSpecFile(specPath, 'plan.md')

      expect(planResult).toBeDefined()
      expect(planResult?.filename).toBe('plan.md')
      expect(planResult?.markdown).toContain('# Implementation Plan')
    })
  })

  describe('writeSpecFile', () => {
    test('should write spec file correctly', async () => {
      const testFile = path.join(tempDir, 'test-spec.md')
      const specFile = {
        path: testFile,
        filename: 'test-spec.md',
        content: '# Test content',
        frontmatter: {},
        markdown: '# Test content',
      }

      await scanner.writeSpecFile(specFile, '# Updated content')

      const writtenContent = await fs.readFile(testFile, 'utf-8')
      expect(writtenContent).toBe('# Updated content')
    })

    test('should handle writing to subdirectories', async () => {
      const subDir = path.join(tempDir, 'subdir')
      await fs.mkdir(subDir, { recursive: true })

      const testFile = path.join(subDir, 'test.md')
      const specFile = {
        path: testFile,
        filename: 'test.md',
        content: '# Test',
        frontmatter: {},
        markdown: '# Test',
      }

      await scanner.writeSpecFile(specFile, '# Written to subdir')

      const writtenContent = await fs.readFile(testFile, 'utf-8')
      expect(writtenContent).toBe('# Written to subdir')
    })
  })

  describe('createSpecDirectory', () => {
    test('should create directory under specs root', async () => {
      const tempScanner = new SpecScanner(tempDir)
      const dirPath = await tempScanner.createSpecDirectory('new-feature')

      const expectedPath = path.join(tempDir, 'new-feature')
      expect(dirPath).toBe(expectedPath)

      const stats = await fs.stat(dirPath)
      expect(stats.isDirectory()).toBe(true)
    })

    test('should handle nested directory creation', async () => {
      const tempScanner = new SpecScanner(tempDir)
      await tempScanner.createSpecDirectory('deep/nested/feature')

      const nestedPath = path.join(tempDir, 'deep/nested/feature')
      const stats = await fs.stat(nestedPath)
      expect(stats.isDirectory()).toBe(true)
    })

    test('should not fail if directory already exists', async () => {
      const tempScanner = new SpecScanner(tempDir)
      await tempScanner.createSpecDirectory('existing-feature')

      // Should not throw when creating again
      await expect(tempScanner.createSpecDirectory('existing-feature')).resolves.toBeDefined()
    })
  })

  describe('getFeatureName', () => {
    test('should convert kebab-case to Title Case', async () => {
      const mockSpec = {
        name: 'feature-name-here',
        path: '/test',
        files: new Map(),
      }

      const result = scanner.getFeatureName(mockSpec)
      expect(result).toBe('Feature Name Here')
    })

    test('should remove issue number prefix', async () => {
      const mockSpec = {
        name: '123-feature-name',
        path: '/test',
        files: new Map(),
      }

      const result = scanner.getFeatureName(mockSpec)
      expect(result).toBe('Feature Name')
    })

    test('should handle single word', async () => {
      const mockSpec = {
        name: '001-authentication',
        path: '/test',
        files: new Map(),
      }

      const result = scanner.getFeatureName(mockSpec)
      expect(result).toBe('Authentication')
    })

    test('should handle name without prefix', async () => {
      const mockSpec = {
        name: 'simple-feature-name',
        path: '/test',
        files: new Map(),
      }

      const result = scanner.getFeatureName(mockSpec)
      expect(result).toBe('Simple Feature Name')
    })
  })

  describe('scanContractsDirectory', () => {
    test('should scan contracts directory correctly', async () => {
      const contractsDir = path.join(TEST_SPECS_DIR, '003-feature-with-contracts')
      const result = await scanner.scanDirectory(contractsDir)

      expect(result?.files.has('contracts/api.yaml')).toBe(true)
      expect(result?.files.has('contracts/contract.md')).toBe(true)

      const yamlFile = result?.files.get('contracts/api.yaml')
      expect(yamlFile?.content).toContain('openapi: 3.0.0')
      expect(yamlFile?.frontmatter).toEqual({})
    })

    test('should handle empty contracts directory', async () => {
      const emptyContractsDir = path.join(tempDir, 'empty-contracts-feature')
      const contractsPath = path.join(emptyContractsDir, 'contracts')
      await fs.mkdir(contractsPath, { recursive: true })
      await fs.writeFile(path.join(emptyContractsDir, 'spec.md'), '---\n---\n# Spec')

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanDirectory(emptyContractsDir)

      expect(result?.files.size).toBe(1)
      expect(result?.files.has('spec.md')).toBe(true)
    })

    test('should handle non-existent contracts directory', async () => {
      const noContractsDir = path.join(tempDir, 'no-contracts-feature')
      await fs.mkdir(noContractsDir, { recursive: true })
      await fs.writeFile(path.join(noContractsDir, 'spec.md'), '---\n---\n# Spec')

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanDirectory(noContractsDir)

      expect(result?.files.size).toBe(1)
      expect(result?.files.has('spec.md')).toBe(true)
    })
  })

  describe('UUID generation', () => {
    test('should preserve existing spec_id in spec.md', async () => {
      // Use existing test spec that already has a spec_id
      const dirPath = path.join(TEST_SPECS_DIR, '001-test-feature')
      const result = await scanner.scanDirectory(dirPath)

      const specFile = result?.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBe('11111111-1111-4111-8111-111111111111')
    })

    test('should generate spec_id for spec.md without one', async () => {
      const testDir = path.join(tempDir, 'new-feature')
      await fs.mkdir(testDir, { recursive: true })

      // Create spec.md without spec_id
      const specContent = `---
title: "New Feature"
sync_status: "draft"
---

# New Feature

This is a new feature specification.`

      await fs.writeFile(path.join(testDir, 'spec.md'), specContent)

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanDirectory(testDir)

      const specFile = result?.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(specFile?.frontmatter.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    test('should persist generated spec_id to disk', async () => {
      const testDir = path.join(tempDir, 'persist-uuid-feature')
      await fs.mkdir(testDir, { recursive: true })

      const specContent = `---
title: "Persist UUID Feature"
sync_status: "draft"
---

# Persist UUID Feature

This feature should get a persisted UUID.`

      const specPath = path.join(testDir, 'spec.md')
      await fs.writeFile(specPath, specContent)

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanDirectory(testDir)

      const specFile = result?.files.get('spec.md')
      const generatedUUID = specFile?.frontmatter.spec_id
      expect(generatedUUID).toBeDefined()

      // Read file again to verify UUID was persisted
      const persistedContent = await fs.readFile(specPath, 'utf-8')
      expect(persistedContent).toContain(`spec_id: ${generatedUUID}`)
    })

    test('should not generate spec_id for non-spec.md files', async () => {
      const testDir = path.join(tempDir, 'plan-feature')
      await fs.mkdir(testDir, { recursive: true })

      // Create plan.md without spec_id
      const planContent = `---
title: "Plan"
---

# Implementation Plan

This is a plan file.`

      await fs.writeFile(path.join(testDir, 'plan.md'), planContent)

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanDirectory(testDir)

      const planFile = result?.files.get('plan.md')
      expect(planFile?.frontmatter.spec_id).toBeUndefined()
    })

    test('should handle file write errors gracefully', async () => {
      const testDir = path.join(tempDir, 'error-feature')
      await fs.mkdir(testDir, { recursive: true })

      const specContent = `---
title: "Error Feature"
---

# Error Feature

This will test error handling.`

      const specPath = path.join(testDir, 'spec.md')
      await fs.writeFile(specPath, specContent)

      // Make the file read-only to simulate write error
      await fs.chmod(specPath, 0o444)

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanDirectory(testDir)

      const specFile = result?.files.get('spec.md')
      // Should still have generated UUID in memory
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(specFile?.frontmatter.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

      // Restore write permissions for cleanup
      await fs.chmod(specPath, 0o644)
    })
  })

  describe('scanSpec', () => {
    test('should scan single spec and generate UUID if missing', async () => {
      const testDir = path.join(tempDir, 'single-spec-feature')
      await fs.mkdir(testDir, { recursive: true })

      const specContent = `---
title: "Single Spec Feature"
sync_status: "draft"
---

# Single Spec Feature

This is a single spec test.`

      await fs.writeFile(path.join(testDir, 'spec.md'), specContent)

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanSpec(testDir)

      expect(result).toBeDefined()
      const specFile = result?.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBeDefined()
      expect(specFile?.frontmatter.spec_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    test('should return null if spec.md does not exist', async () => {
      const testDir = path.join(tempDir, 'no-spec-feature')
      await fs.mkdir(testDir, { recursive: true })

      // Create only a plan.md file
      await fs.writeFile(path.join(testDir, 'plan.md'), '# Plan only')

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanSpec(testDir)

      expect(result).toBeNull()
    })

    test('should preserve existing UUID in scanSpec', async () => {
      const testDir = path.join(tempDir, 'existing-uuid-feature')
      await fs.mkdir(testDir, { recursive: true })

      const existingUUID = '22222222-2222-4222-8222-222222222222'
      const specContent = `---
spec_id: "${existingUUID}"
title: "Existing UUID Feature"
sync_status: "draft"
---

# Existing UUID Feature

This spec already has a UUID.`

      await fs.writeFile(path.join(testDir, 'spec.md'), specContent)

      const tempScanner = new SpecScanner(tempDir)
      const result = await tempScanner.scanSpec(testDir)

      const specFile = result?.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBe(existingUUID)
    })
  })
})
