import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { ConsoleUtils, consoleUtils } from '../../src/ui/Console.js'
import stripAnsi from 'strip-ansi'

describe('ConsoleUtils', () => {
  // Use a test instance to avoid singleton issues
  let testConsole: ConsoleUtils
  let logCalls: any[] = []
  let errorCalls: any[] = []
  let warnCalls: any[] = []
  let clearCalls: any[] = []

  let originalLog: any
  let originalError: any
  let originalWarn: any
  let originalClear: any

  beforeEach(() => {
    // Save original console methods
    originalLog = console.log
    originalError = console.error
    originalWarn = console.warn
    originalClear = console.clear

    // Reset call tracking
    logCalls = []
    errorCalls = []
    warnCalls = []
    clearCalls = []

    // Mock console methods
    console.log = (...args: any[]) => {
      logCalls.push(args)
    }

    console.error = (...args: any[]) => {
      errorCalls.push(args)
    }

    console.warn = (...args: any[]) => {
      warnCalls.push(args)
    }

    console.clear = () => {
      clearCalls.push([])
    }

    // Create a new test instance for most tests
    testConsole = new ConsoleUtils()
  })

  afterEach(() => {
    // Restore original console methods
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
    console.clear = originalClear
  })

  describe('getInstance', () => {
    test('should return the same instance (singleton)', () => {
      const instance1 = ConsoleUtils.getInstance()
      const instance2 = ConsoleUtils.getInstance()

      expect(instance1).toBe(instance2)
      expect(instance1).toBe(consoleUtils)
    })
  })

  describe('log', () => {
    test('should pass arguments to console.log', () => {
      testConsole.log('test', 123, { foo: 'bar' })

      expect(logCalls.length).toBe(1)
      expect(logCalls[0]).toEqual(['test', 123, { foo: 'bar' }])
    })
  })

  describe('error', () => {
    test('should display error message in red', () => {
      testConsole.error('Error occurred')

      expect(errorCalls.length).toBe(1)
      const call = errorCalls[0][0]
      expect(stripAnsi(call)).toBe('Error occurred')
    })

    test('should display error stack in debug mode', () => {
      const originalDebug = process.env.DEBUG
      process.env.DEBUG = 'true'

      // Create a new instance to pick up the debug setting
      const debugConsole = new ConsoleUtils()
      const error = new Error('Test error')
      debugConsole.error('Error occurred', error)

      expect(errorCalls.length).toBe(2) // Message + stack
      const stackCall = errorCalls[1][0]
      expect(stripAnsi(stackCall)).toContain('Test error')

      process.env.DEBUG = originalDebug
    })

    test('should not display error stack when not in debug mode', () => {
      const originalDebug = process.env.DEBUG
      process.env.DEBUG = 'false'

      const normalConsole = new ConsoleUtils()
      const error = new Error('Test error')
      normalConsole.error('Error occurred', error)

      expect(errorCalls.length).toBe(1) // Only message, no stack

      process.env.DEBUG = originalDebug
    })
  })

  describe('warn', () => {
    test('should display warning message in yellow', () => {
      testConsole.warn('Warning message')

      expect(warnCalls.length).toBe(1)
      const call = warnCalls[0][0]
      expect(stripAnsi(call)).toBe('Warning message')
    })
  })

  describe('success', () => {
    test('should display success message in green', () => {
      testConsole.success('Success!')

      expect(logCalls.length).toBe(1)
      const call = logCalls[0][0]
      expect(stripAnsi(call)).toBe('Success!')
    })
  })

  describe('info', () => {
    test('should display info message in cyan', () => {
      testConsole.info('Information')

      expect(logCalls.length).toBe(1)
      const call = logCalls[0][0]
      expect(stripAnsi(call)).toBe('Information')
    })
  })

  describe('debug', () => {
    test('should display debug message when DEBUG is enabled', () => {
      const originalDebug = process.env.DEBUG
      process.env.DEBUG = 'true'

      const debugConsole = new ConsoleUtils()
      debugConsole.debug('Debug message')

      expect(logCalls.length).toBe(1)
      const call = logCalls[0][0]
      expect(stripAnsi(call)).toBe('[DEBUG] Debug message')

      process.env.DEBUG = originalDebug
    })

    test('should not display debug message when DEBUG is disabled', () => {
      const originalDebug = process.env.DEBUG
      process.env.DEBUG = 'false'

      const normalConsole = new ConsoleUtils()
      normalConsole.debug('Debug message')

      expect(logCalls.length).toBe(0)

      process.env.DEBUG = originalDebug
    })
  })

  describe('panel', () => {
    test('should display content in a bordered panel', () => {
      testConsole.panel('Panel content', 'Title')

      // Should have 3 calls: top border, content line, bottom border
      expect(logCalls.length).toBe(3)

      const calls = logCalls.map(c => stripAnsi(c[0]))
      expect(calls[0]).toContain('Title')
      expect(calls[1]).toContain('Panel content')
      expect(calls[2]).toMatch(/^└─+┘$/)
    })

    test('should display panel without title', () => {
      testConsole.panel('Content only')

      expect(logCalls.length).toBe(3)

      const calls = logCalls.map(c => stripAnsi(c[0]))
      expect(calls[0]).toMatch(/^┌─+┐$/)
      expect(calls[1]).toContain('Content only')
    })

    test('should handle multi-line content', () => {
      testConsole.panel('Line 1\nLine 2\nLine 3')

      // 1 top border + 3 content lines + 1 bottom border = 5 calls
      expect(logCalls.length).toBe(5)
    })

    test('should support different border colors', () => {
      const colors = ['cyan', 'green', 'red', 'yellow'] as const

      colors.forEach(color => {
        logCalls = []
        testConsole.panel('Content', 'Title', color)
        expect(logCalls.length).toBe(3)
      })
    })
  })

  describe('center', () => {
    test('should center text based on terminal width', () => {
      // Mock terminal width
      const originalColumns = process.stdout.columns
      process.stdout.columns = 80

      testConsole.center('Centered text')

      expect(logCalls.length).toBe(1)
      const call = logCalls[0][0]

      // Text should have leading spaces for centering
      expect(call).toMatch(/^\s+Centered text$/)

      // Calculate expected padding
      const textLength = 'Centered text'.length
      const expectedPadding = Math.floor((80 - textLength) / 2)
      const actualPadding = call.indexOf('Centered text')
      expect(actualPadding).toBe(expectedPadding)

      process.stdout.columns = originalColumns
    })

    test('should handle multi-line text', () => {
      process.stdout.columns = 80

      testConsole.center('Line 1\nLine 2')

      expect(logCalls.length).toBe(2)

      const calls = logCalls.map(c => c[0])
      expect(calls[0]).toMatch(/^\s+Line 1$/)
      expect(calls[1]).toMatch(/^\s+Line 2$/)
    })

    test('should properly center text with ANSI color codes', () => {
      process.stdout.columns = 80

      // Text with ANSI codes (simulating colored text)
      const coloredText = '\x1b[31mRed Text\x1b[0m'
      testConsole.center(coloredText)

      expect(logCalls.length).toBe(1)
      const call = logCalls[0][0]

      // The visible text length should be 8 ("Red Text"), not including ANSI codes
      const visibleLength = 8
      const expectedPadding = Math.floor((80 - visibleLength) / 2)

      // Strip ANSI codes to check the actual position
      const strippedCall = stripAnsi(call)
      const actualPadding = strippedCall.indexOf('Red Text')
      expect(actualPadding).toBe(expectedPadding)
    })

    test('should handle very long text gracefully', () => {
      process.stdout.columns = 20

      testConsole.center('This is a very long text that exceeds terminal width')

      expect(logCalls.length).toBe(1)
      const call = logCalls[0][0]

      // Should not have negative padding
      expect(call).toBe('This is a very long text that exceeds terminal width')
    })
  })

  describe('clear', () => {
    test('should clear the console', () => {
      testConsole.clear()

      expect(clearCalls.length).toBe(1)
    })
  })
})