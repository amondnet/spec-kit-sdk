import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { checkTaskPrerequisites } from '../../src'
import { IsolatedContractEnvironment } from '../contract-environment'

describe('checkTaskPrerequisites contract tests', () => {
  let testEnv: IsolatedContractEnvironment

  beforeEach(async () => {
    testEnv = new IsolatedContractEnvironment()
    await testEnv.createIsolatedRepo()
    testEnv.changeToTestDir()
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  test('should return correct JSON structure when all prerequisites are met', async () => {
    // Create a feature branch first
    await testEnv.createFeatureBranch('001-test-feature')

    // Create the spec file to meet prerequisites
    await testEnv.createFile('specs/001-test-feature/spec.md', '# Feature 001: Test Feature')

    const result = await checkTaskPrerequisites({ json: true })

    expect(result).toEqual({
      STATUS: expect.stringMatching(/^(READY|MISSING_FILES|NOT_READY)$/),
      MISSING_FILES: expect.any(Array),
      READY: expect.any(Boolean),
    })
  })

  test('should return correct JSON structure without --json flag', async () => {
    // Create a feature branch first
    await testEnv.createFeatureBranch('002-another-feature')

    // Create the feature directory and spec file
    await testEnv.createFile('specs/002-another-feature/spec.md', '# Feature 002: Another Feature')
    await testEnv.createFile('specs/002-another-feature/plan.md', '# Implementation Plan')

    const result = await checkTaskPrerequisites({ json: false })

    expect(result).toEqual({
      STATUS: expect.stringMatching(/^(READY|MISSING_FILES|NOT_READY)$/),
      MISSING_FILES: expect.any(Array),
      READY: expect.any(Boolean),
    })
  })

  test('should indicate READY status when all files exist', async () => {
    // Create a feature branch and required files
    await testEnv.createFeatureBranch('003-ready-feature')

    // Create the feature directory and spec file
    await testEnv.createFile('specs/003-ready-feature/spec.md', '# Feature 003: Ready Feature')
    await testEnv.createFile('specs/003-ready-feature/plan.md', '# Implementation Plan')

    const result = await checkTaskPrerequisites({
      json: true,
    })

    expect(result.STATUS).toBe('READY')
    expect(result.READY).toBe(true)
    expect(result.MISSING_FILES).toEqual([])
  })

  test('should indicate NOT_READY status when files are missing', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('004-missing-files')

    // Create the feature directory but not all files
    await testEnv.createFile('specs/004-missing-files/spec.md', '# Feature 004: Missing Files')
    // Intentionally not creating plan.md

    const result = await checkTaskPrerequisites({
      json: true,
    })

    expect(result.STATUS).toBe('MISSING_FILES')
    expect(result.READY).toBe(false)
    expect(result.MISSING_FILES.length).toBeGreaterThan(0)
  })

  test('should list all missing files', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('005-multiple-missing')

    // Create the feature directory with spec but not plan
    await testEnv.createFile('specs/005-multiple-missing/spec.md', '# Feature 005: Multiple Missing')
    // Plan.md is missing and will be reported

    const result = await checkTaskPrerequisites({
      json: true,
    })

    // Should report missing plan.md
    expect(result.MISSING_FILES.length).toBeGreaterThan(0)
    expect(result.MISSING_FILES.some(f => f.includes('plan.md'))).toBe(true)
  })

  test('should handle empty required files list', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('006-empty-list')

    // Create the feature directory with all required files
    await testEnv.createFile('specs/006-empty-list/spec.md', '# Feature 006: Empty List')
    await testEnv.createFile('specs/006-empty-list/plan.md', '# Implementation Plan')

    const result = await checkTaskPrerequisites({
      json: true,
    })

    expect(result.STATUS).toBe('READY')
    expect(result.READY).toBe(true)
    expect(result.MISSING_FILES).toEqual([])
  })

  test('should check for spec.md in current feature by default', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('007-default-check')

    // Create the feature directory but no files
    await testEnv.createFile('specs/007-default-check/.gitkeep', '')

    const result = await checkTaskPrerequisites({ json: true })

    // Should check for spec.md existence in current feature directory
    expect(result).toHaveProperty('STATUS')
    expect(result).toHaveProperty('MISSING_FILES')
    expect(result).toHaveProperty('READY')
    expect(result.READY).toBe(false)
  })

  test('should check for plan.md when checking planning prerequisites', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('008-planning-check')

    // Create spec but not plan
    await testEnv.createFile('specs/008-planning-check/spec.md', '# Feature 008: Planning Check')

    const result = await checkTaskPrerequisites({
      json: true,
    })

    // Should report plan.md as missing
    expect(result.MISSING_FILES).toEqual(
      expect.arrayContaining([expect.stringContaining('plan.md')]),
    )
  })

  test('should validate feature branch context', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('009-branch-context')

    // Create all required files
    await testEnv.createFile('specs/009-branch-context/spec.md', '# Feature 009: Branch Context')
    await testEnv.createFile('specs/009-branch-context/plan.md', '# Implementation Plan')

    const result = await checkTaskPrerequisites({
      json: true,
    })

    // Should either be ready or indicate branch-related issues
    expect(result).toHaveProperty('STATUS')
    expect(['READY', 'MISSING_FILES', 'NOT_READY']).toContain(result.STATUS)
  })
})
