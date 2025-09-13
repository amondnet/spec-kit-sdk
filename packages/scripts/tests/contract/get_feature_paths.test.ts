import { afterEach, beforeEach, describe, expect, test, spyOn } from 'bun:test'
import { getFeaturePaths } from '../../src/commands/getFeaturePaths.js'
import { IsolatedContractEnvironment, validateContractResult } from '../contract-environment.js'

describe('getFeaturePaths contract tests', () => {
  let contractEnv: IsolatedContractEnvironment
  let consoleLogSpy: any

  beforeEach(async () => {
    contractEnv = new IsolatedContractEnvironment()
    await contractEnv.createIsolatedRepo()
    contractEnv.changeToTestDir()

    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
    process.env.NODE_ENV = 'test'
  })

  afterEach(async () => {
    consoleLogSpy.mockRestore()
    delete process.env.NODE_ENV
    await contractEnv.cleanup()
  })

  test('should enforce feature branch requirement in isolated environment', async () => {
    // On main branch, should require feature branch
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('main')

    await expect(getFeaturePaths()).rejects.toThrow('Not on a feature branch')
  })

  test('should handle JSON output option contract', async () => {
    await expect(getFeaturePaths({ json: true })).rejects.toThrow('Not on a feature branch')
  })

  test('should return feature paths when on feature branch in isolated environment', async () => {
    // Create and switch to feature branch
    await contractEnv.createFeatureBranch('001-paths-test')

    // Create the feature directory with spec.md
    await contractEnv.createFile('specs/001-paths-test/spec.md', '# Feature 001: Paths Test')

    // Verify we're on the feature branch
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('001-paths-test')

    // Should now work
    const result = await getFeaturePaths()

    // Should return expected contract structure with all path fields
    expect(result).toHaveProperty('FEATURE_DIR')
    expect(result).toHaveProperty('FEATURE_SPEC')
    expect(result).toHaveProperty('IMPL_PLAN')
    expect(result).toHaveProperty('CURRENT_BRANCH')

    expect(result.CURRENT_BRANCH).toBe('001-paths-test')
    expect(result.FEATURE_SPEC).toContain('001-paths-test')
    expect(result.IMPL_PLAN).toContain('001-paths-test')
  })
})