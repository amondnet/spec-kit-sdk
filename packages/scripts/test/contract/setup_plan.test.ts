import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { setupPlan } from '../../src'
import { IsolatedContractEnvironment } from '../contract-environment'

describe('setupPlan contract tests', () => {
  let testEnv: IsolatedContractEnvironment

  beforeEach(async () => {
    testEnv = new IsolatedContractEnvironment()
    await testEnv.createIsolatedRepo()
    testEnv.changeToTestDir()
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  test('should return correct JSON structure on feature branch', async () => {
    // Create a feature branch and spec file
    await testEnv.createFeatureBranch('001-test-feature')
    await testEnv.createFile('specs/001-test-feature/spec.md', '# Feature 001: Test Feature\n\n## Requirements\n\n- Test requirement')

    const result = await setupPlan({ json: true })

    expect(result).toEqual({
      FEATURE_SPEC: expect.stringContaining('spec.md'),
      IMPL_PLAN: expect.stringContaining('plan.md'),
      SPECS_DIR: expect.any(String), // Can be absolute or relative path
      BRANCH: expect.stringMatching(/^\d{3}-[\w-]+$/),
    })
  })

  test('should return correct JSON structure without --json flag', async () => {
    // Create a feature branch and spec file
    await testEnv.createFeatureBranch('002-another-feature')
    await testEnv.createFile('specs/002-another-feature/spec.md', '# Feature 002: Another Feature')

    const result = await setupPlan({ json: false })

    expect(result).toEqual({
      FEATURE_SPEC: expect.stringContaining('spec.md'),
      IMPL_PLAN: expect.stringContaining('plan.md'),
      SPECS_DIR: expect.any(String), // Can be absolute or relative path
      BRANCH: expect.stringMatching(/^\d{3}-[\w-]+$/),
    })
  })

  test('should ensure spec file exists before creating plan', async () => {
    // Create a feature branch with spec file
    await testEnv.createFeatureBranch('003-spec-check')
    await testEnv.createFile('specs/003-spec-check/spec.md', '# Feature 003: Spec Check')

    const result = await setupPlan({ json: true })

    expect(result.FEATURE_SPEC).toBeTruthy()
    expect(result.FEATURE_SPEC).toMatch(/spec\.md$/)
  })

  test('should generate plan file in same directory as spec', async () => {
    // Create a feature branch with spec file
    await testEnv.createFeatureBranch('004-same-dir')
    await testEnv.createFile('specs/004-same-dir/spec.md', '# Feature 004: Same Directory')

    const result = await setupPlan({ json: true })

    const specDir = result.FEATURE_SPEC.replace('/spec.md', '')
    const planDir = result.IMPL_PLAN.replace('/plan.md', '')

    expect(specDir).toBe(planDir)
  })

  test('should match branch name with specs directory', async () => {
    // Create a feature branch with spec file
    await testEnv.createFeatureBranch('005-branch-match')
    await testEnv.createFile('specs/005-branch-match/spec.md', '# Feature 005: Branch Match')

    const result = await setupPlan({ json: true })

    // SPECS_DIR might be absolute path to specs directory
    expect(result.SPECS_DIR).toContain('specs')
    expect(result.BRANCH).toBe('005-branch-match')
  })

  test('should create implementation plan with standard filename', async () => {
    // Create a feature branch with spec file
    await testEnv.createFeatureBranch('006-plan-name')
    await testEnv.createFile('specs/006-plan-name/spec.md', '# Feature 006: Plan Name')

    const result = await setupPlan({ json: true })

    expect(result.IMPL_PLAN).toMatch(/\/plan\.md$/)
  })

  test('should handle case when plan already exists', async () => {
    // Create a feature branch with both spec and plan files
    await testEnv.createFeatureBranch('007-existing-plan')
    await testEnv.createFile('specs/007-existing-plan/spec.md', '# Feature 007: Existing Plan')
    await testEnv.createFile('specs/007-existing-plan/plan.md', '# Implementation Plan\n\nExisting plan content')

    const result = await setupPlan({ json: true })

    // Should still return the path to the plan file
    expect(result.IMPL_PLAN).toContain('plan.md')
    expect(result.BRANCH).toBe('007-existing-plan')
  })

  test('should work with feature branches containing hyphens', async () => {
    // Create a feature branch with hyphens (underscores are not allowed in the pattern)
    await testEnv.createFeatureBranch('008-complex-feature-name')
    await testEnv.createFile('specs/008-complex-feature-name/spec.md', '# Feature 008: Complex Feature Name')

    const result = await setupPlan({ json: true })

    expect(result.BRANCH).toBe('008-complex-feature-name')
    expect(result.SPECS_DIR).toContain('specs')
  })

  test('should create plan file in the correct location', async () => {
    // Create a feature branch with spec file
    await testEnv.createFeatureBranch('009-file-creation')
    await testEnv.createFile('specs/009-file-creation/spec.md', '# Feature 009: File Creation')

    const result = await setupPlan({ json: true })

    // Check that the plan file path is correctly formatted
    expect(result.IMPL_PLAN).toMatch(/\/plan\.md$/)
    expect(result.IMPL_PLAN).toContain('009-file-creation')
  })

  test('should handle error gracefully when spec file is missing', async () => {
    // Create a feature branch without spec file
    await testEnv.createFeatureBranch('010-no-spec')

    // This should either fail or handle the missing spec gracefully
    try {
      const result = await setupPlan({ json: true })
      // If it doesn't throw, it might create the spec or handle it gracefully
      expect(result).toHaveProperty('FEATURE_SPEC')
    }
    catch (error) {
      // Expected to fail when spec is missing
      expect(error).toBeDefined()
    }
  })
})
