import type { GitHubClient } from '../../src/adapters/github/api.js'
import { beforeEach, describe, expect, test, vi } from 'bun:test'
import { GitHubClient as RealGitHubClient } from '../../src/adapters/github/api.js'

// TestableGitHubClient that exposes private methods for testing
class TestableGitHubClient extends RealGitHubClient {
  // Mock the executeGhCommand to simulate gh CLI responses
  private mockExecuteGhCommandResult: string = '[]'
  private mockExecuteGhCommandError: Error | null = null
  private executeGhCommandCalls: Array<{ args: string[] }> = []

  constructor(owner?: string, repo?: string) {
    super(owner, repo)
  }

  // Mock the executeGhCommand method
  protected override async executeGhCommand(args: string[]): Promise<string> {
    this.executeGhCommandCalls.push({ args: [...args] })
    
    if (this.mockExecuteGhCommandError) {
      throw this.mockExecuteGhCommandError
    }
    
    return this.mockExecuteGhCommandResult
  }

  // Expose private methods for testing
  public testFilterUncheckedLabels(labels: string[]): string[] {
    // @ts-expect-error - accessing private method for testing
    return this.filterUncheckedLabels(labels)
  }

  public async testFindMissingLabels(uncheckedLabels: string[]): Promise<string[]> {
    // @ts-expect-error - accessing private method for testing
    return this.findMissingLabels(uncheckedLabels)
  }

  public async testCreateLabel(label: string, labelColors: Record<string, string>): Promise<void> {
    // @ts-expect-error - accessing private method for testing
    return this.createLabel(label, labelColors)
  }

  public async testCreateMissingLabels(missingLabels: string[]): Promise<void> {
    // @ts-expect-error - accessing private method for testing
    return this.createMissingLabels(missingLabels)
  }

  public testUpdateLabelCache(uncheckedLabels: string[]): void {
    // @ts-expect-error - accessing private method for testing
    return this.updateLabelCache(uncheckedLabels)
  }

  public testGetDefaultLabelColors(): Record<string, string> {
    // @ts-expect-error - accessing private method for testing
    return this.getDefaultLabelColors()
  }

  // Methods to control mock behavior
  public setMockExecuteGhCommandResult(result: string): void {
    this.mockExecuteGhCommandResult = result
  }

  public setMockExecuteGhCommandError(error: Error | null): void {
    this.mockExecuteGhCommandError = error
  }

  public getExecuteGhCommandCalls(): Array<{ args: string[] }> {
    return this.executeGhCommandCalls
  }

  public clearExecuteGhCommandCalls(): void {
    this.executeGhCommandCalls = []
  }

  // Access to internal state for testing
  public getCheckedLabelsSize(): number {
    // @ts-expect-error - accessing private property for testing
    return this.checkedLabels.size
  }

  public hasCheckedLabel(label: string): boolean {
    // @ts-expect-error - accessing private property for testing
    return this.checkedLabels.has(label)
  }

  public clearCheckedLabels(): void {
    // @ts-expect-error - accessing private property for testing
    this.checkedLabels.clear()
  }
}

describe('GitHubClient - Label Management', () => {
  let client: TestableGitHubClient

  beforeEach(() => {
    client = new TestableGitHubClient('test-owner', 'test-repo')
    client.clearCheckedLabels()
    client.clearExecuteGhCommandCalls()
  })

  describe('filterUncheckedLabels', () => {
    test('should return all labels when none are checked', () => {
      const labels = ['bug', 'enhancement', 'docs']
      const result = client.testFilterUncheckedLabels(labels)
      
      expect(result).toEqual(labels)
    })

    test('should filter out already checked labels', () => {
      // First, mark some labels as checked
      client.testUpdateLabelCache(['bug', 'docs'])
      
      const labels = ['bug', 'enhancement', 'docs', 'test']
      const result = client.testFilterUncheckedLabels(labels)
      
      expect(result).toEqual(['enhancement', 'test'])
    })

    test('should return empty array when all labels are already checked', () => {
      // Mark labels as checked
      client.testUpdateLabelCache(['bug', 'enhancement'])
      
      const labels = ['bug', 'enhancement']
      const result = client.testFilterUncheckedLabels(labels)
      
      expect(result).toEqual([])
    })

    test('should handle empty input array', () => {
      const result = client.testFilterUncheckedLabels([])
      expect(result).toEqual([])
    })

    test('should handle duplicate labels in input', () => {
      const labels = ['bug', 'bug', 'enhancement']
      const result = client.testFilterUncheckedLabels(labels)
      
      expect(result).toEqual(['bug', 'bug', 'enhancement'])
    })
  })

  describe('findMissingLabels', () => {
    test('should identify missing labels', async () => {
      const existingLabels = JSON.stringify([
        { name: 'bug' },
        { name: 'enhancement' },
        { name: 'documentation' }
      ])
      client.setMockExecuteGhCommandResult(existingLabels)

      const uncheckedLabels = ['bug', 'feature', 'test', 'documentation']
      const result = await client.testFindMissingLabels(uncheckedLabels)

      expect(result).toEqual(['feature', 'test'])
      expect(client.getExecuteGhCommandCalls()).toHaveLength(1)
      expect(client.getExecuteGhCommandCalls()[0].args).toEqual(['label', 'list', '--json', 'name'])
    })

    test('should handle case-insensitive label comparison', async () => {
      const existingLabels = JSON.stringify([
        { name: 'Bug' },
        { name: 'Enhancement' },
        { name: 'DOCUMENTATION' }
      ])
      client.setMockExecuteGhCommandResult(existingLabels)

      const uncheckedLabels = ['bug', 'enhancement', 'documentation', 'test']
      const result = await client.testFindMissingLabels(uncheckedLabels)

      expect(result).toEqual(['test'])
    })

    test('should handle empty existing labels', async () => {
      client.setMockExecuteGhCommandResult('')

      const uncheckedLabels = ['bug', 'enhancement']
      const result = await client.testFindMissingLabels(uncheckedLabels)

      expect(result).toEqual(['bug', 'enhancement'])
    })

    test('should handle empty string JSON response', async () => {
      client.setMockExecuteGhCommandResult('[]')

      const uncheckedLabels = ['bug', 'enhancement']
      const result = await client.testFindMissingLabels(uncheckedLabels)

      expect(result).toEqual(['bug', 'enhancement'])
    })

    test('should handle empty unchecked labels', async () => {
      const existingLabels = JSON.stringify([{ name: 'bug' }])
      client.setMockExecuteGhCommandResult(existingLabels)

      const result = await client.testFindMissingLabels([])

      expect(result).toEqual([])
    })

    test('should handle gh command error gracefully', async () => {
      client.setMockExecuteGhCommandError(new Error('gh command failed'))

      await expect(client.testFindMissingLabels(['bug'])).rejects.toThrow('gh command failed')
    })
  })

  describe('createLabel', () => {
    test('should create label with specified color', async () => {
      const labelColors = { bug: 'FF0000', enhancement: '00FF00' }
      
      await client.testCreateLabel('bug', labelColors)

      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].args).toEqual(['label', 'create', 'bug', '--color', 'FF0000', '--force'])
    })

    test('should use common color when label color not specified', async () => {
      const labelColors = { common: 'CCCCCC' }
      
      await client.testCreateLabel('unknown', labelColors)

      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].args).toEqual(['label', 'create', 'unknown', '--color', 'CCCCCC', '--force'])
    })

    test('should use default color when neither label nor common color exists', async () => {
      const labelColors = {}
      
      await client.testCreateLabel('test', labelColors)

      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(1)
      expect(calls[0].args).toEqual(['label', 'create', 'test', '--color', 'CCCCCC', '--force'])
    })

    test('should handle label already exists error silently', async () => {
      const error = new Error('label already exists')
      client.setMockExecuteGhCommandError(error)
      const labelColors = { test: 'FF0000' }
      
      // Should not throw even though executeGhCommand throws
      await expect(client.testCreateLabel('test', labelColors)).resolves.toBeUndefined()
    })

    test('should log other errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Network error')
      client.setMockExecuteGhCommandError(error)
      const labelColors = { test: 'FF0000' }
      
      await expect(client.testCreateLabel('test', labelColors)).resolves.toBeUndefined()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to create label 'test':",
        'Network error'
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('createMissingLabels', () => {
    test('should create multiple labels successfully', async () => {
      const missingLabels = ['bug', 'feature', 'test']
      
      await client.testCreateMissingLabels(missingLabels)

      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(3)
      
      // Check each label creation call
      expect(calls[0].args).toContain('bug')
      expect(calls[1].args).toContain('feature')
      expect(calls[2].args).toContain('test')
    })

    test('should continue creating labels even if one fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Simulate failure for the second label
      let callIndex = 0
      client.setMockExecuteGhCommandResult('success')
      
      // Store the original method
      const originalExecuteGhCommand = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(client), 
        'executeGhCommand'
      )
      
      // Override executeGhCommand to fail on the second label creation
      Object.defineProperty(client, 'executeGhCommand', {
        value: async function(args: string[]) {
          // Track calls
          this.executeGhCommandCalls.push({ args: [...args] })
          
          // Check if this is a label creation call
          if (args[0] === 'label' && args[1] === 'create') {
            callIndex++
            if (callIndex === 2) {
              throw new Error('Failed to create label')
            }
          }
          
          if (this.mockExecuteGhCommandError) {
            throw this.mockExecuteGhCommandError
          }
          
          return this.mockExecuteGhCommandResult
        }.bind(client),
        configurable: true,
        writable: true
      })

      const missingLabels = ['first', 'failing', 'third']
      await client.testCreateMissingLabels(missingLabels)

      const calls = client.getExecuteGhCommandCalls()
      // Should attempt all three creations (Promise.allSettled continues despite failures)
      expect(calls.filter(call => call.args[0] === 'label' && call.args[1] === 'create')).toHaveLength(3)
      
      // Should log the error for the failed label
      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toBe("Failed to create label 'failing':")
      
      // Restore original method
      if (originalExecuteGhCommand) {
        Object.defineProperty(client, 'executeGhCommand', originalExecuteGhCommand)
      }
      
      consoleSpy.mockRestore()
    })

    test('should handle empty missing labels array', async () => {
      await client.testCreateMissingLabels([])

      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(0)
    })

    test('should use default label colors from getDefaultLabelColors', async () => {
      const missingLabels = ['spec', 'datamodel', 'contracts']
      
      await client.testCreateMissingLabels(missingLabels)

      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(3)
      
      // Check that correct colors are used (from actual implementation)
      expect(calls[0].args).toContain('0052CC') // spec color (blue)
      expect(calls[1].args).toContain('D93F0B') // datamodel color (orange)
      expect(calls[2].args).toContain('B60205') // contracts color (red)
    })
  })

  describe('updateLabelCache', () => {
    test('should add labels to cache', () => {
      const labels = ['bug', 'enhancement', 'test']
      
      expect(client.getCheckedLabelsSize()).toBe(0)
      
      client.testUpdateLabelCache(labels)
      
      expect(client.getCheckedLabelsSize()).toBe(3)
      expect(client.hasCheckedLabel('bug')).toBe(true)
      expect(client.hasCheckedLabel('enhancement')).toBe(true)
      expect(client.hasCheckedLabel('test')).toBe(true)
    })

    test('should handle duplicate labels', () => {
      const labels = ['bug', 'bug', 'test']
      
      client.testUpdateLabelCache(labels)
      
      // Set should deduplicate
      expect(client.getCheckedLabelsSize()).toBe(2)
    })

    test('should clear cache when exceeding MAX_CACHE_SIZE', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Add labels up to the limit
      const labels: string[] = []
      for (let i = 0; i < 1000; i++) {
        labels.push(`label-${i}`)
      }
      
      client.testUpdateLabelCache(labels)
      expect(client.getCheckedLabelsSize()).toBe(1000)
      
      // Add one more to trigger cache clear
      client.testUpdateLabelCache(['label-1000'])
      
      // Cache should be cleared and warning logged
      expect(client.getCheckedLabelsSize()).toBe(0)
      expect(consoleSpy).toHaveBeenCalledWith('Label cache cleared due to size limit (1000)')
      
      consoleSpy.mockRestore()
    })

    test('should handle empty array', () => {
      client.testUpdateLabelCache([])
      expect(client.getCheckedLabelsSize()).toBe(0)
    })
  })

  describe('getDefaultLabelColors', () => {
    test('should return expected default colors', () => {
      const colors = client.testGetDefaultLabelColors()
      
      expect(colors).toEqual({
        spec: '0052CC', // blue
        plan: '5319E7', // purple
        research: '006B75', // teal
        task: 'FBCA04', // yellow
        quickstart: '0E8A16', // green
        datamodel: 'D93F0B', // orange
        contracts: 'B60205', // red
        subtask: '7B68EE', // medium slate blue
        common: 'CCCCCC', // gray
      })
    })
  })

  describe('ensureLabelsExist - Integration', () => {
    test('should handle complete flow successfully', async () => {
      const existingLabels = JSON.stringify([
        { name: 'bug' },
        { name: 'enhancement' }
      ])
      client.setMockExecuteGhCommandResult(existingLabels)
      
      const labels = ['bug', 'enhancement', 'feature', 'test']
      await client.ensureLabelsExist(labels)
      
      const calls = client.getExecuteGhCommandCalls()
      
      // Should check existing labels
      expect(calls[0].args).toEqual(['label', 'list', '--json', 'name'])
      
      // Should create missing labels (feature and test)
      expect(calls).toHaveLength(3) // 1 list + 2 creates
      expect(calls[1].args).toContain('feature')
      expect(calls[2].args).toContain('test')
      
      // Should update cache
      expect(client.hasCheckedLabel('bug')).toBe(true)
      expect(client.hasCheckedLabel('enhancement')).toBe(true)
      expect(client.hasCheckedLabel('feature')).toBe(true)
      expect(client.hasCheckedLabel('test')).toBe(true)
    })

    test('should skip already checked labels', async () => {
      // First call
      client.setMockExecuteGhCommandResult('[]')
      await client.ensureLabelsExist(['bug'])
      
      const firstCalls = client.getExecuteGhCommandCalls()
      expect(firstCalls).toHaveLength(2) // 1 list + 1 create
      
      // Clear calls
      client.clearExecuteGhCommandCalls()
      
      // Second call with same label
      await client.ensureLabelsExist(['bug'])
      
      const secondCalls = client.getExecuteGhCommandCalls()
      expect(secondCalls).toHaveLength(0) // Should skip as already checked
    })

    test('should handle partial overlap of checked labels', async () => {
      // Mark some labels as checked
      client.testUpdateLabelCache(['bug', 'enhancement'])
      
      client.setMockExecuteGhCommandResult('[]')
      await client.ensureLabelsExist(['bug', 'enhancement', 'feature', 'test'])
      
      const calls = client.getExecuteGhCommandCalls()
      
      // Should only process unchecked labels (feature and test)
      expect(calls[0].args).toEqual(['label', 'list', '--json', 'name'])
      expect(calls).toHaveLength(3) // 1 list + 2 creates for feature and test
    })

    test('should handle errors gracefully without throwing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      client.setMockExecuteGhCommandError(new Error('Network error'))
      
      // Should not throw
      await expect(client.ensureLabelsExist(['bug'])).resolves.toBeUndefined()
      
      // Should log warning
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to ensure labels exist:',
        'Error',
        'Network error',
        expect.any(String)
      )
      
      consoleSpy.mockRestore()
    })

    test('should handle empty labels array', async () => {
      await client.ensureLabelsExist([])
      
      const calls = client.getExecuteGhCommandCalls()
      expect(calls).toHaveLength(0)
    })

    test('should handle all labels already existing', async () => {
      const existingLabels = JSON.stringify([
        { name: 'bug' },
        { name: 'enhancement' },
        { name: 'feature' }
      ])
      client.setMockExecuteGhCommandResult(existingLabels)
      
      await client.ensureLabelsExist(['bug', 'enhancement', 'feature'])
      
      const calls = client.getExecuteGhCommandCalls()
      
      // Should only check existing labels, no creates needed
      expect(calls).toHaveLength(1)
      expect(calls[0].args).toEqual(['label', 'list', '--json', 'name'])
      
      // Should still update cache
      expect(client.hasCheckedLabel('bug')).toBe(true)
      expect(client.hasCheckedLabel('enhancement')).toBe(true)
      expect(client.hasCheckedLabel('feature')).toBe(true)
    })

    test('should handle non-Error objects in catch block', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Force a non-Error to be thrown
      const originalExecute = client['executeGhCommand']
      client['executeGhCommand'] = async function() {
        throw 'string error' // Non-Error object
      }
      
      await expect(client.ensureLabelsExist(['bug'])).resolves.toBeUndefined()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to ensure labels exist:',
        'string error'
      )
      
      client['executeGhCommand'] = originalExecute
      consoleSpy.mockRestore()
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle malformed JSON from gh command', async () => {
      client.setMockExecuteGhCommandResult('not valid json')
      
      await expect(client.testFindMissingLabels(['bug'])).rejects.toThrow()
    })

    test('should handle special characters in label names', async () => {
      const existingLabels = JSON.stringify([
        { name: 'bug/fix' },
        { name: 'feature:new' },
        { name: 'test-123' }
      ])
      client.setMockExecuteGhCommandResult(existingLabels)
      
      const uncheckedLabels = ['bug/fix', 'feature:new', 'test-123', 'normal']
      const result = await client.testFindMissingLabels(uncheckedLabels)
      
      expect(result).toEqual(['normal'])
    })

    test('should handle very long label lists efficiently', async () => {
      const manyLabels: Array<{ name: string }> = []
      for (let i = 0; i < 500; i++) {
        manyLabels.push({ name: `label-${i}` })
      }
      client.setMockExecuteGhCommandResult(JSON.stringify(manyLabels))
      
      const uncheckedLabels: string[] = []
      for (let i = 0; i < 600; i++) {
        uncheckedLabels.push(`label-${i}`)
      }
      
      const result = await client.testFindMissingLabels(uncheckedLabels)
      
      // Should find labels 500-599 as missing
      expect(result).toHaveLength(100)
      expect(result[0]).toBe('label-500')
      expect(result[99]).toBe('label-599')
    })
  })
})