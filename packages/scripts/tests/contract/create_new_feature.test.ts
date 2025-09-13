import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createNewFeature } from '../../src'
import { IsolatedContractEnvironment } from '../contract-environment'

describe('createNewFeature contract tests', () => {
  let testEnv: IsolatedContractEnvironment

  beforeEach(async () => {
    testEnv = new IsolatedContractEnvironment()
    await testEnv.createIsolatedRepo()
    testEnv.changeToTestDir()
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  test('should return correct JSON structure with --json flag', async () => {
    const result = await createNewFeature('test feature description', { json: true })

    expect(result).toEqual({
      BRANCH_NAME: expect.stringMatching(/^\d{3}-[\w-]+$/),
      SPEC_FILE: expect.stringContaining('spec.md'),
      FEATURE_NUM: expect.stringMatching(/^\d{3}$/),
    })
  })

  test('should return correct JSON structure without --json flag', async () => {
    const result = await createNewFeature('another test feature', { json: false })

    expect(result).toEqual({
      BRANCH_NAME: expect.stringMatching(/^\d{3}-[\w-]+$/),
      SPEC_FILE: expect.stringContaining('spec.md'),
      FEATURE_NUM: expect.stringMatching(/^\d{3}$/),
    })
  })

  test('should auto-increment feature numbers', async () => {
    const result1 = await createNewFeature('first feature', { json: true })
    const result2 = await createNewFeature('second feature', { json: true })

    const num1 = Number.parseInt(result1.FEATURE_NUM)
    const num2 = Number.parseInt(result2.FEATURE_NUM)

    expect(num2).toBeGreaterThan(num1)
  })

  test('should handle feature names with spaces and special characters', async () => {
    const result = await createNewFeature('My Feature with Spaces & Symbols!', { json: true })

    expect(result.BRANCH_NAME).toMatch(/^\d{3}-[\w-]+$/)
    expect(result.BRANCH_NAME).not.toContain(' ')
    expect(result.BRANCH_NAME).not.toContain('&')
    expect(result.BRANCH_NAME).not.toContain('!')
  })

  test('should generate consistent spec file path format', async () => {
    const result = await createNewFeature('test feature', { json: true })

    expect(result.SPEC_FILE).toMatch(/specs\/\d{3}-[\w-]+\/spec\.md$/)
  })

  test('should use feature number in branch name', async () => {
    const result = await createNewFeature('test feature', { json: true })

    expect(result.BRANCH_NAME).toStartWith(`${result.FEATURE_NUM}-`)
  })

  test('should create spec file in the correct location', async () => {
    const result = await createNewFeature('file creation test', { json: true })

    // Check that the spec file path is correctly formatted
    expect(result.SPEC_FILE).toMatch(/\/spec\.md$/)
    expect(result.SPEC_FILE).toContain(result.FEATURE_NUM)
    expect(result.SPEC_FILE).toContain('file-creation-test')
  })

  test('should switch to the new feature branch', async () => {
    const result = await createNewFeature('branch switch test', { json: true })

    // Check current branch
    const currentBranch = await testEnv.getCurrentBranch()
    expect(currentBranch).toBe(result.BRANCH_NAME)
  })

  test('should handle consecutive feature creation', async () => {
    // Create multiple features in sequence
    const results = []
    for (let i = 0; i < 3; i++) {
      results.push(await createNewFeature(`feature ${i}`, { json: true }))
    }

    // All should have unique feature numbers
    const featureNums = results.map(r => r.FEATURE_NUM)
    const uniqueNums = [...new Set(featureNums)]
    expect(uniqueNums.length).toBe(featureNums.length)

    // Should be incrementing
    for (let i = 1; i < results.length; i++) {
      const prev = Number.parseInt(results[i - 1].FEATURE_NUM)
      const curr = Number.parseInt(results[i].FEATURE_NUM)
      expect(curr).toBeGreaterThan(prev)
    }
  })
})
