import { afterEach, beforeEach, describe, expect, test, spyOn } from 'bun:test'
import { updateAgentContext } from '../../src/commands/updateAgentContext.js'
import { IsolatedContractEnvironment } from '../contract-environment.js'

describe('updateAgentContext contract tests', () => {
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

  test('should work on main branch in isolated environment', async () => {
    // updateAgentContext doesn't require feature branch
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('main')

    // Should work on main branch
    const result = await updateAgentContext('claude')

    expect(result).toHaveProperty('AGENT_FILE')
    expect(result).toHaveProperty('UPDATED')
    expect(result).toHaveProperty('AGENT_TYPE')
    expect(result.AGENT_TYPE).toBe('claude')
  })

  test('should handle JSON output option contract', async () => {
    // Should work with JSON option
    const result = await updateAgentContext('claude', { json: true })

    expect(result).toHaveProperty('AGENT_FILE')
    expect(result).toHaveProperty('UPDATED')
    expect(result).toHaveProperty('AGENT_TYPE')
  })

  test('should work when on feature branch in isolated environment', async () => {
    // Create and switch to feature branch
    await contractEnv.createFeatureBranch('001-context-test')

    // Create the feature directory with spec.md
    await contractEnv.createFile('specs/001-context-test/spec.md', '# Feature 001: Context Test')

    // Verify we're on the feature branch
    const currentBranch = await contractEnv.getCurrentBranch()
    expect(currentBranch).toBe('001-context-test')

    // Should now work (provide agentType)
    const result = await updateAgentContext('claude')

    // Should return expected contract structure
    expect(result).toHaveProperty('AGENT_FILE')
    expect(result).toHaveProperty('UPDATED')
    expect(result).toHaveProperty('AGENT_TYPE')

    expect(result.AGENT_TYPE).toBe('claude')
    expect(result.UPDATED).toBe(true)
  })
})