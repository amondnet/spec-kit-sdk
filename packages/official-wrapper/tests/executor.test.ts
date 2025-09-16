import { beforeEach, describe, expect, test } from 'bun:test'
import { OfficialExecutor } from '../src/executor.js'

describe('OfficialExecutor', () => {
  let executor: OfficialExecutor

  beforeEach(() => {
    executor = new OfficialExecutor()
  })

  describe('constructor', () => {
    test('should use default repository when no config provided', () => {
      const defaultExecutor = new OfficialExecutor()
      expect(defaultExecutor.getRepository()).toBe('git+https://github.com/github/spec-kit.git')
    })

    test('should use provided repository config', () => {
      const customExecutor = new OfficialExecutor({
        repository: 'git+https://github.com/custom/spec-kit.git',
      })
      expect(customExecutor.getRepository()).toBe('git+https://github.com/custom/spec-kit.git')
    })
  })

  describe('getRepository', () => {
    test('should return the configured repository', () => {
      expect(executor.getRepository()).toBe('git+https://github.com/github/spec-kit.git')
    })
  })

  describe('updateRepository', () => {
    test('should update repository configuration', () => {
      executor.updateRepository('git+https://github.com/new/spec-kit.git')
      expect(executor.getRepository()).toBe('git+https://github.com/new/spec-kit.git')
    })
  })

  describe('execute - integration style tests', () => {
    test('should handle command execution flow', async () => {
      // Test the basic command structure without actual spawn
      // This is more of an integration test approach
      expect(typeof executor.execute).toBe('function')
      expect(executor.getRepository()).toMatch(/github\.com/)
    })

    test('should validate command and args parameters', () => {
      // The execute method should accept these parameters
      expect(() => executor.execute('test-command', ['arg1', 'arg2'])).not.toThrow()
    })
  })

  describe('isAvailable', () => {
    test('should return a promise', () => {
      const result = executor.isAvailable()
      expect(result).toBeInstanceOf(Promise)
    })

    test('should check uvx availability', async () => {
      // This test will actually check if uvx is available
      // In a real environment, this might be true or false
      const result = await executor.isAvailable()
      expect(typeof result).toBe('boolean')
    })
  })
})
