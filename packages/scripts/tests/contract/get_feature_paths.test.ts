import { getFeaturePaths } from '@spec-kit/scripts'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { IsolatedContractEnvironment } from '../contract-environment'

describe('getFeaturePaths contract tests', () => {
  let testEnv: IsolatedContractEnvironment

  beforeEach(async () => {
    testEnv = new IsolatedContractEnvironment()
    await testEnv.createIsolatedRepo()
    testEnv.changeToTestDir()
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  test('should return complete path object with all required fields', async () => {
    // Create a feature branch first
    await testEnv.createFeatureBranch('001-test-feature')

    // Create the feature directory structure
    await testEnv.createFile('specs/001-test-feature/spec.md', '# Feature 001: test-feature\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    expect(result).toEqual({
      REPO_ROOT: expect.any(String),
      CURRENT_BRANCH: expect.stringMatching(/^\d{3}-[\w-]+$/),
      FEATURE_DIR: expect.stringContaining('/specs/'),
      FEATURE_SPEC: expect.stringContaining('spec.md'),
      IMPL_PLAN: expect.stringContaining('plan.md'),
      TASKS: expect.stringContaining('tasks.md'),
      RESEARCH: expect.stringContaining('research.md'),
      DATA_MODEL: expect.stringContaining('data-model.md'),
      QUICKSTART: expect.stringContaining('quickstart.md'),
      CONTRACTS_DIR: expect.stringContaining('/contracts'),
    })
  })

  test('should return correct path object without --json flag', async () => {
    // Create a feature branch first
    await testEnv.createFeatureBranch('002-another-feature')

    // Create the feature directory structure
    await testEnv.createFile('specs/002-another-feature/spec.md', '# Feature 002: another-feature\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: false })

    expect(result).toEqual({
      REPO_ROOT: expect.any(String),
      CURRENT_BRANCH: expect.stringMatching(/^\d{3}-[\w-]+$/),
      FEATURE_DIR: expect.stringContaining('/specs/'),
      FEATURE_SPEC: expect.stringContaining('spec.md'),
      IMPL_PLAN: expect.stringContaining('plan.md'),
      TASKS: expect.stringContaining('tasks.md'),
      RESEARCH: expect.stringContaining('research.md'),
      DATA_MODEL: expect.stringContaining('data-model.md'),
      QUICKSTART: expect.stringContaining('quickstart.md'),
      CONTRACTS_DIR: expect.stringContaining('/contracts'),
    })
  })

  test('should ensure feature number consistency across all paths', async () => {
    // Create a feature branch with a specific pattern
    await testEnv.createFeatureBranch('003-consistency-test')

    // Create the feature directory structure
    await testEnv.createFile('specs/003-consistency-test/spec.md', '# Feature 003: consistency-test\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    // Extract feature number from branch
    const featureNum = result.CURRENT_BRANCH.split('-')[0]

    expect(result.CURRENT_BRANCH).toStartWith(`${featureNum}-`)
    expect(result.FEATURE_DIR).toContain(`/${featureNum}-`)
    expect(result.FEATURE_SPEC).toContain(`/${featureNum}-`)
    expect(result.IMPL_PLAN).toContain(`/${featureNum}-`)
    expect(result.TASKS).toContain(`/${featureNum}-`)
  })

  test('should provide absolute paths', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('004-path-types')

    // Create the feature directory structure
    await testEnv.createFile('specs/004-path-types/spec.md', '# Feature 004: path-types\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    // All paths should be absolute (start with /)
    expect(result.REPO_ROOT).toStartWith('/')
    expect(result.FEATURE_DIR).toStartWith('/')
    expect(result.FEATURE_SPEC).toStartWith('/')
    expect(result.IMPL_PLAN).toStartWith('/')
    expect(result.TASKS).toStartWith('/')
    expect(result.RESEARCH).toStartWith('/')
    expect(result.DATA_MODEL).toStartWith('/')
    expect(result.QUICKSTART).toStartWith('/')
    expect(result.CONTRACTS_DIR).toStartWith('/')
  })

  test('should maintain consistent directory structure', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('005-structure-test')

    // Create the feature directory structure
    await testEnv.createFile('specs/005-structure-test/spec.md', '# Feature 005: structure-test\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    // Check that all feature files are in the feature directory
    expect(result.FEATURE_SPEC).toStartWith(result.FEATURE_DIR)
    expect(result.IMPL_PLAN).toStartWith(result.FEATURE_DIR)
    expect(result.TASKS).toStartWith(result.FEATURE_DIR)
    expect(result.RESEARCH).toStartWith(result.FEATURE_DIR)
    expect(result.DATA_MODEL).toStartWith(result.FEATURE_DIR)
    expect(result.QUICKSTART).toStartWith(result.FEATURE_DIR)
    expect(result.CONTRACTS_DIR).toStartWith(result.FEATURE_DIR)
  })

  test('should handle feature number from current branch', async () => {
    // Create a feature branch with a known number
    await testEnv.createFeatureBranch('042-known-number')

    // Create the feature directory structure
    await testEnv.createFile('specs/042-known-number/spec.md', '# Feature 042: known-number\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    // Should match the branch we created
    expect(result.CURRENT_BRANCH).toBe('042-known-number')
    expect(result.FEATURE_DIR).toContain('/042-known-number')
  })

  test('should provide paths for all standard feature files', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('006-standard-files')

    // Create the feature directory structure
    await testEnv.createFile('specs/006-standard-files/spec.md', '# Feature 006: standard-files\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    expect(result.FEATURE_SPEC).toMatch(/\/spec\.md$/)
    expect(result.IMPL_PLAN).toMatch(/\/plan\.md$/)
    expect(result.TASKS).toMatch(/\/tasks\.md$/)
    expect(result.RESEARCH).toMatch(/\/research\.md$/)
    expect(result.DATA_MODEL).toMatch(/\/data-model\.md$/)
    expect(result.QUICKSTART).toMatch(/\/quickstart\.md$/)
  })

  test('should ensure paths include temp directory', async () => {
    // Create a feature branch
    await testEnv.createFeatureBranch('007-absolute-paths')

    // Create the feature directory structure
    await testEnv.createFile('specs/007-absolute-paths/spec.md', '# Feature 007: absolute-paths\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })
    const tempDir = testEnv.getTempDir()

    expect(result.REPO_ROOT).toBe(tempDir)
    expect(result.FEATURE_DIR).toContain(tempDir)
    expect(result.FEATURE_SPEC).toContain(tempDir)
    expect(result.IMPL_PLAN).toContain(tempDir)
    expect(result.TASKS).toContain(tempDir)
  })

  test('should handle non-feature branch gracefully', async () => {
    // Stay on main branch
    try {
      await getFeaturePaths({ json: true })
      // Should throw an error
      expect(true).toBe(false) // This line should not be reached
    }
    catch (error) {
      // Expected to throw when not on feature branch
      expect(error).toBeDefined()
      if (error instanceof Error) {
        expect(error.message).toContain('Not on a feature branch')
      }
    }
  })

  test('should match current branch exactly', async () => {
    // Create a specific feature branch
    const branchName = '099-specific-test'
    await testEnv.createFeatureBranch(branchName)

    // Create the feature directory structure
    await testEnv.createFile('specs/099-specific-test/spec.md', '# Feature 099: specific-test\n\nTest feature specification.')

    const result = await getFeaturePaths({ json: true })

    expect(result.CURRENT_BRANCH).toBe(branchName)
  })
})
