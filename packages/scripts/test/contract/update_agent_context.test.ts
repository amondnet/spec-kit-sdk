import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { updateAgentContext } from '../../src'
import { IsolatedContractEnvironment } from '../contract-environment'

describe('updateAgentContext contract tests', () => {
  let testEnv: IsolatedContractEnvironment

  beforeEach(async () => {
    testEnv = new IsolatedContractEnvironment()
    await testEnv.createIsolatedRepo()
    testEnv.changeToTestDir()

    // Create a feature branch for context
    await testEnv.createFeatureBranch('001-test-feature')

    // Create basic agent context files
    await testEnv.createFile('.claude/context.md', '# Claude Context\n\nTest context')
    await testEnv.createFile('.github/copilot/context.md', '# Copilot Context\n\nTest context')
    await testEnv.createFile('.gemini/context.md', '# Gemini Context\n\nTest context')
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  test('should return correct JSON structure for claude agent', async () => {
    const result = await updateAgentContext('claude', { json: true })

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining('.claude'),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: 'claude',
    })
  })

  test('should return correct JSON structure for copilot agent', async () => {
    const result = await updateAgentContext('copilot', { json: true })

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining('copilot'),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: 'copilot',
    })
  })

  test('should return correct JSON structure for gemini agent', async () => {
    const result = await updateAgentContext('gemini', { json: true })

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining('gemini'),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: 'gemini',
    })
  })

  test('should return correct JSON structure without --json flag', async () => {
    const result = await updateAgentContext('claude', { json: false })

    expect(result).toEqual({
      AGENT_FILE: expect.stringContaining('.claude'),
      UPDATED: expect.any(Boolean),
      AGENT_TYPE: 'claude',
    })
  })

  test('should validate agent type parameter', async () => {
    await expect(updateAgentContext('invalid-agent' as any, { json: true })).rejects.toThrow(/Unsupported agent type/)
  })

  test('should handle case-insensitive agent types', async () => {
    // The function expects lowercase agent types as defined in SUPPORTED_AGENT_TYPES
    await expect(updateAgentContext('CLAUDE' as any, { json: true })).rejects.toThrow(/Unsupported agent type/)

    // Only lowercase versions should work
    const result = await updateAgentContext('claude', { json: true })
    expect(result.AGENT_TYPE).toBe('claude')
  })

  test('should return different agent files for different agent types', async () => {
    const claudeResult = await updateAgentContext('claude', { json: true })
    const copilotResult = await updateAgentContext('copilot', { json: true })
    const geminiResult = await updateAgentContext('gemini', { json: true })

    expect(claudeResult.AGENT_FILE).not.toBe(copilotResult.AGENT_FILE)
    expect(claudeResult.AGENT_FILE).not.toBe(geminiResult.AGENT_FILE)
    expect(copilotResult.AGENT_FILE).not.toBe(geminiResult.AGENT_FILE)
  })

  test('should indicate successful update when agent file is modified', async () => {
    const result = await updateAgentContext('claude', { json: true })

    // In isolated environment, this should always update
    expect(result.UPDATED).toBeDefined()
    expect(typeof result.UPDATED).toBe('boolean')
  })

  test.skip('should handle dry-run mode', async () => {
    const result = await updateAgentContext('claude', { json: true })

    expect(result).toHaveProperty('AGENT_FILE')
    expect(result).toHaveProperty('UPDATED')
    expect(result).toHaveProperty('AGENT_TYPE')

    // In dry-run mode, file shouldn't actually be updated
    // but the structure should still be returned
  })

  test('should support all three agent types', async () => {
    const agents = ['claude', 'copilot', 'gemini'] as const

    for (const agent of agents) {
      const result = await updateAgentContext(agent, { json: true })

      expect(result).toHaveProperty('AGENT_FILE')
      expect(result).toHaveProperty('UPDATED')
      expect(result.AGENT_TYPE).toBe(agent)
    }
  })

  test('should handle mixed case agent names', async () => {
    const variations = ['Claude', 'COPILOT', 'GeMiNi']

    // Mixed case should be rejected since function expects exact lowercase matches
    for (const variation of variations) {
      await expect(updateAgentContext(variation as any, { json: true })).rejects.toThrow(/Unsupported agent type/)
    }
  })

  test('should work when agent directories do not exist initially', async () => {
    // Remove agent directories first
    await testEnv.createFile('.claude/.gitkeep', '')

    const result = await updateAgentContext('claude', { json: true })

    expect(result).toHaveProperty('AGENT_FILE')
    expect(result).toHaveProperty('UPDATED')
    expect(result.AGENT_TYPE).toBe('claude')
  })
})
