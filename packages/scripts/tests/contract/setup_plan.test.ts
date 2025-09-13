import { afterEach, beforeEach, describe, expect, test, spyOn } from 'bun:test'
import { setupPlan } from '../../src/commands/setupPlan.js'
import { IsolatedContractEnvironment, validateContractResult } from '../contract-environment.js'

describe('setupPlan contract tests', () => {
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

    await expect(setupPlan()).rejects.toThrow('Not on a feature branch')
  })

  test('should handle JSON output option contract', async () => {
    // Should still fail due to branch requirement
    await expect(setupPlan({ json: true })).rejects.toThrow('Not on a feature branch')
  })

  test('should work when on feature branch in isolated environment', async () => {
    // Create and switch to feature branch
    await contractEnv.createFeatureBranch('001-setup-plan-test')

    // Create the feature directory with spec.md
    await contractEnv.createFile('specs/001-setup-plan-test/spec.md', '# Feature 001: Setup Plan Test')

    // Verify we're on the feature branch
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('001-setup-plan-test')

    // Should now work
    const result = await setupPlan()

    // Should return expected contract structure
    expect(result).toHaveProperty('FEATURE_SPEC')
    expect(result).toHaveProperty('IMPL_PLAN')
    expect(result).toHaveProperty('SPECS_DIR')
    expect(result).toHaveProperty('BRANCH')

    expect(result.BRANCH).toBe('001-setup-plan-test')
  })
})