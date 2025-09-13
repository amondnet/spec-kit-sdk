import { afterEach, beforeEach, describe, expect, test, spyOn } from 'bun:test'
import { checkTaskPrerequisites } from '../../src/commands/checkTaskPrerequisites.js'
import { IsolatedContractEnvironment, validateContractResult } from '../contract-environment.js'

describe('checkTaskPrerequisites contract tests', () => {
  let contractEnv: IsolatedContractEnvironment
  let consoleLogSpy: any

  beforeEach(async () => {
    contractEnv = new IsolatedContractEnvironment()
    await contractEnv.createIsolatedRepo()
    contractEnv.changeToTestDir()

    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
    process.env.NODE_ENV = 'test' // Disable console output in actual function
  })

  afterEach(async () => {
    consoleLogSpy.mockRestore()
    delete process.env.NODE_ENV
    await contractEnv.cleanup()
  })

  test('should return correct contract structure when checking specific files', async () => {
    const result = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: ['non-existent-file.txt'],
    })

    // Validate required contract fields
    const errors = validateContractResult(result, ['STATUS', 'MISSING_FILES', 'READY'])
    expect(errors).toEqual([])

    // Validate contract behavior
    expect(result.STATUS).toBe('NOT_READY')
    expect(result.MISSING_FILES).toEqual(['non-existent-file.txt'])
    expect(result.READY).toBe(false)
  })

  test('should return READY when all required files exist in isolated environment', async () => {
    // Create a test file in isolated environment
    await contractEnv.createFile('test-file.txt', 'content')

    const result = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: [contractEnv.getPath('test-file.txt')],
    })

    // Validate contract structure
    const errors = validateContractResult(result, ['STATUS', 'MISSING_FILES', 'READY'])
    expect(errors).toEqual([])

    expect(result.STATUS).toBe('READY')
    expect(result.MISSING_FILES).toEqual([])
    expect(result.READY).toBe(true)
  })

  test('should enforce feature branch requirement contract', async () => {
    // On main branch, should require feature branch by default
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('main') // Verify we're on main

    await expect(checkTaskPrerequisites())
      .rejects.toThrow('Not on a feature branch')
  })

  test('should work correctly when on feature branch in isolated environment', async () => {
    // Create and switch to feature branch
    await contractEnv.createFeatureBranch('001-test-feature')

    // Create the feature directory structure to avoid "Could not find feature directory" error
    await contractEnv.createFile('specs/001-test-feature/spec.md', '# Feature 001: Test Feature')

    // Verify we're on the feature branch
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('001-test-feature')

    // Should now work without requireFeatureBranch: false
    const result = await checkTaskPrerequisites()

    // Validate contract structure
    const errors = validateContractResult(result, ['STATUS', 'MISSING_FILES', 'READY'])
    expect(errors).toEqual([])

    // Contract validates that STATUS and READY are consistent
    expect(['READY', 'NOT_READY']).toContain(result.STATUS)
    expect(Array.isArray(result.MISSING_FILES)).toBe(true)
    expect(typeof result.READY).toBe('boolean')
    expect(result.READY).toBe(result.STATUS === 'READY')

    // If NOT_READY, missing files should be listed
    if (result.STATUS === 'NOT_READY') {
      expect(result.MISSING_FILES.length).toBeGreaterThan(0)
    }
  })

  test('should handle empty required files list contract', async () => {
    const result = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: [],
    })

    // Validate contract
    expect(result.STATUS).toBe('READY')
    expect(result.READY).toBe(true)
    expect(result.MISSING_FILES).toEqual([])
  })

  test('should list all missing files in contract response', async () => {
    const missingFiles = ['missing1.txt', 'missing2.txt', 'missing3.txt']

    const result = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: missingFiles,
    })

    // Validate contract behavior
    expect(result.MISSING_FILES).toEqual(expect.arrayContaining(missingFiles))
    expect(result.STATUS).toBe('NOT_READY')
    expect(result.READY).toBe(false)
  })

  test('should handle mixed existing and missing files in isolated environment', async () => {
    // Create one file that exists
    await contractEnv.createFile('exists.txt', 'content')

    const result = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: [contractEnv.getPath('exists.txt'), 'missing.txt'],
    })

    // Validate contract behavior
    expect(result.STATUS).toBe('NOT_READY')
    expect(result.READY).toBe(false)
    expect(result.MISSING_FILES).toEqual(['missing.txt'])
    expect(result.MISSING_FILES).not.toContain(contractEnv.getPath('exists.txt'))
  })

  test('should provide consistent contract interface across scenarios', async () => {
    const testScenarios = [
      { requireFeatureBranch: false, requiredFiles: [] },
      { requireFeatureBranch: false, requiredFiles: ['missing.txt'] },
      { requireFeatureBranch: false, requiredFiles: ['file1.txt', 'file2.txt'] },
    ]

    for (const options of testScenarios) {
      const result = await checkTaskPrerequisites(options)

      // All scenarios should return the same contract structure
      const errors = validateContractResult(result, ['STATUS', 'MISSING_FILES', 'READY'])
      expect(errors).toEqual([])

      // Validate field types and constraints
      expect(['READY', 'NOT_READY']).toContain(result.STATUS)
      expect(Array.isArray(result.MISSING_FILES)).toBe(true)
      expect(typeof result.READY).toBe('boolean')

      // Status and READY should be consistent
      expect(result.READY).toBe(result.STATUS === 'READY')
    }
  })

  test('should validate planning prerequisites contract when requested', async () => {
    // Switch to feature branch for this test
    await contractEnv.createFeatureBranch('001-planning-test')

    // Create the feature directory with spec.md but no plan.md
    await contractEnv.createFile('specs/001-planning-test/spec.md', '# Feature 001: Planning Test')

    const result = await checkTaskPrerequisites({ checkPlanning: true })

    // Should check for plan.md file
    const errors = validateContractResult(result, ['STATUS', 'MISSING_FILES', 'READY'])
    expect(errors).toEqual([])

    // Should be NOT_READY since no plan.md exists
    expect(result.STATUS).toBe('NOT_READY')
    expect(result.READY).toBe(false)
    expect(result.MISSING_FILES.some(f => f.includes('plan.md'))).toBe(true)
  })

  test('should maintain isolated environment across multiple checks', async () => {
    // First check - create a file
    await contractEnv.createFile('test1.txt', 'content1')

    const result1 = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: [contractEnv.getPath('test1.txt')],
    })
    expect(result1.STATUS).toBe('READY')

    // Second check - add more files
    await contractEnv.createFile('test2.txt', 'content2')

    const result2 = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: [contractEnv.getPath('test1.txt'), contractEnv.getPath('test2.txt')],
    })
    expect(result2.STATUS).toBe('READY')

    // Third check - request non-existent file
    const result3 = await checkTaskPrerequisites({
      requireFeatureBranch: false,
      requiredFiles: [contractEnv.getPath('test1.txt'), 'missing.txt'],
    })
    expect(result3.STATUS).toBe('NOT_READY')
    expect(result3.MISSING_FILES).toEqual(['missing.txt'])
  })
})