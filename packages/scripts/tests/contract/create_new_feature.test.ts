import { afterEach, beforeEach, describe, expect, test, spyOn } from 'bun:test'
import { createNewFeature } from '../../src/commands/createNewFeature.js'
import { IsolatedContractEnvironment, validateContractResult, CONTRACT_PATTERNS } from '../contract-environment.js'

describe('createNewFeature contract tests', () => {
  let contractEnv: IsolatedContractEnvironment
  let consoleLogSpy: any

  beforeEach(async () => {
    contractEnv = new IsolatedContractEnvironment()
    await contractEnv.createIsolatedRepo()
    contractEnv.changeToTestDir()

    // Spy on console output to verify command behavior
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(async () => {
    consoleLogSpy.mockRestore()
    await contractEnv.cleanup()
  })

  test('should return correct contract structure with JSON flag', async () => {
    const result = await createNewFeature('test feature description', { json: true })

    // Validate required contract fields
    const errors = validateContractResult(result, ['BRANCH_NAME', 'SPEC_FILE', 'FEATURE_NUM'])
    expect(errors).toEqual([])

    // Validate field formats match contract specifications
    expect(result.BRANCH_NAME).toMatch(CONTRACT_PATTERNS.BRANCH_NAME)
    expect(result.SPEC_FILE).toMatch(CONTRACT_PATTERNS.SPEC_FILE)
    expect(result.FEATURE_NUM).toMatch(CONTRACT_PATTERNS.FEATURE_NUM)

    // Verify console output for JSON format
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(result))
  })

  test('should return correct contract structure without JSON flag', async () => {
    const result = await createNewFeature('another test feature')

    // Validate contract structure
    const errors = validateContractResult(result, ['BRANCH_NAME', 'SPEC_FILE', 'FEATURE_NUM'])
    expect(errors).toEqual([])

    // Verify console output for non-JSON format
    expect(consoleLogSpy).toHaveBeenCalledWith(`BRANCH_NAME: ${result.BRANCH_NAME}`)
    expect(consoleLogSpy).toHaveBeenCalledWith(`SPEC_FILE: ${result.SPEC_FILE}`)
    expect(consoleLogSpy).toHaveBeenCalledWith(`FEATURE_NUM: ${result.FEATURE_NUM}`)
  })

  test('should auto-increment feature numbers in isolated environment', async () => {
    const result1 = await createNewFeature('first feature', { json: true })
    const result2 = await createNewFeature('second feature', { json: true })

    const num1 = Number.parseInt(result1.FEATURE_NUM)
    const num2 = Number.parseInt(result2.FEATURE_NUM)

    expect(num2).toBeGreaterThan(num1)
    expect(num2).toBe(num1 + 1) // Should increment by exactly 1
  })

  test('should sanitize feature names properly', async () => {
    const result = await createNewFeature('My Feature with Spaces & Symbols!')

    // Branch name should be sanitized
    expect(result.BRANCH_NAME).toMatch(CONTRACT_PATTERNS.BRANCH_NAME)
    expect(result.BRANCH_NAME).not.toContain(' ')
    expect(result.BRANCH_NAME).not.toContain('&')
    expect(result.BRANCH_NAME).not.toContain('!')

    // Should still contain recognizable parts
    expect(result.BRANCH_NAME.toLowerCase()).toContain('feature')
  })

  test('should create spec file in correct directory structure', async () => {
    const result = await createNewFeature('test feature')

    // Validate spec file path format
    expect(result.SPEC_FILE).toMatch(CONTRACT_PATTERNS.SPEC_FILE)

    // Extract directory from path
    const expectedDir = result.SPEC_FILE.replace('/spec.md', '')
    expect(expectedDir).toContain(`specs/${result.BRANCH_NAME}`)
  })

  test('should use feature number in branch name consistently', async () => {
    const result = await createNewFeature('consistency test')

    expect(result.BRANCH_NAME).toStartWith(`${result.FEATURE_NUM}-`)

    // Feature number should appear in both branch name and spec file path
    expect(result.SPEC_FILE).toContain(result.FEATURE_NUM)
  })

  test('should enforce input validation contract', async () => {
    // Test empty description
    await expect(createNewFeature('')).rejects.toThrow('Feature description is required')

    // Test whitespace-only description
    await expect(createNewFeature('   ')).rejects.toThrow('Feature description cannot be empty')

    // Test null/undefined description
    await expect(createNewFeature(null as any)).rejects.toThrow('Feature description is required')
    await expect(createNewFeature(undefined as any)).rejects.toThrow('Feature description is required')
  })

  test('should create files in isolated repository', async () => {
    const result = await createNewFeature('file creation test')

    // Check that spec file path is absolute and contains temp directory
    expect(result.SPEC_FILE).toStartWith(contractEnv.getTempDir())

    // Verify the file was actually created
    const relativeSpecPath = result.SPEC_FILE.replace(contractEnv.getTempDir() + '/', '')
    const fileExists = await contractEnv.fileExists(relativeSpecPath)
    expect(fileExists).toBe(true)
  })

  test('should work with different feature name patterns', async () => {
    const testCases = [
      'simple-name',
      'Name With Spaces',
      'name_with_underscores',
      'Name123WithNumbers',
      'UPPERCASE NAME',
      'mixed-Case_Name 123'
    ]

    for (const testName of testCases) {
      const result = await createNewFeature(testName)

      // All should produce valid contract results
      const errors = validateContractResult(result, ['BRANCH_NAME', 'SPEC_FILE', 'FEATURE_NUM'])
      expect(errors).toEqual([])

      expect(result.BRANCH_NAME).toMatch(CONTRACT_PATTERNS.BRANCH_NAME)
    }
  })
})