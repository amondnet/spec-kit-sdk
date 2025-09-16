import type { SyncAdapter } from '../../src/types/index.js'
import { describe, expect, it } from 'bun:test'

// Mock adapter - simplified for basic testing
function createMockAdapter(): SyncAdapter {
  return {
    checkAuth: async () => true,
    getStatus: async () => ({
      status: 'synced',
      hasChanges: false,
      conflicts: [],
    }),
    push: async () => ({ success: true, message: 'Pushed' }),
    pull: async () => ({ path: '', name: 'test', files: new Map() }),
  } as any
}

describe('listCommand', () => {
  it('should create command function', () => {
    // Basic test to ensure the command function exists and can be imported
    const { listCommand } = require('../../src/commands/list.command.js')
    expect(typeof listCommand).toBe('function')
  })

  it('should accept options parameter', () => {
    const { listCommand } = require('../../src/commands/list.command.js')
    const adapter = createMockAdapter()

    // Should not throw with options
    expect(() => listCommand(adapter, { verbose: true })).not.toThrow()
    expect(() => listCommand(adapter, { filter: 'test' })).not.toThrow()
  })
})
