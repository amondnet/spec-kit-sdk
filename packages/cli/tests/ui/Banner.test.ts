import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { Banner } from '../../src/ui/Banner.js'
import { consoleUtils } from '../../src/ui/Console.js'

describe('Banner', () => {
  let originalCenter: any
  let originalLog: any
  let centerCalls: any[] = []
  let logCalls: any[] = []

  beforeEach(() => {
    // Save original methods
    originalCenter = consoleUtils.center
    originalLog = consoleUtils.log

    // Reset call tracking
    centerCalls = []
    logCalls = []

    // Mock methods
    consoleUtils.center = mock((text: string) => {
      centerCalls.push([text])
    })

    consoleUtils.log = mock((...args: any[]) => {
      logCalls.push(args)
    })
  })

  afterEach(() => {
    // Restore original methods
    consoleUtils.center = originalCenter
    consoleUtils.log = originalLog
  })

  describe('show', () => {
    test('should call showFull by default', () => {
      const originalShowFull = Banner.showFull
      let showFullCalled = 0

      Banner.showFull = mock(() => {
        showFullCalled++
      })

      Banner.show()

      expect(showFullCalled).toBe(1)

      Banner.showFull = originalShowFull
    })

    test('should call showMini when mini is true', () => {
      const originalShowMini = Banner.showMini
      let showMiniCalled = 0

      Banner.showMini = mock(() => {
        showMiniCalled++
      })

      Banner.show(true)

      expect(showMiniCalled).toBe(1)

      Banner.showMini = originalShowMini
    })
  })

  describe('showFull', () => {
    test('should display the full banner with gradient colors', () => {
      Banner.showFull()

      // Check that center was called for each line of the banner
      const expectedLines = 6 // Number of lines in the ASCII art
      const taglineCall = 1

      expect(centerCalls.length).toBe(expectedLines + taglineCall)
      expect(logCalls.length).toBe(1) // Empty line
    })

    test('should display the tagline', () => {
      Banner.showFull()

      // Check that the tagline was centered
      const lastCall = centerCalls[centerCalls.length - 1][0]

      // The tagline should contain the text (without checking for exact formatting)
      expect(lastCall).toContain('Spec-Driven Development Toolkit')
    })
  })

  describe('showMini', () => {
    test('should display the mini banner', () => {
      Banner.showMini()

      // Mini banner has 3 lines plus tagline
      const expectedLines = 3
      const taglineCall = 1

      expect(centerCalls.length).toBe(expectedLines + taglineCall)
      expect(logCalls.length).toBe(1) // Empty line
    })

    test('should display the tagline in mini mode', () => {
      Banner.showMini()

      const lastCall = centerCalls[centerCalls.length - 1][0]

      expect(lastCall).toContain('Spec-Driven Development Toolkit')
    })
  })
})
