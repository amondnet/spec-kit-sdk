import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  embedUuidInIssueBody,
  extractUuidFromIssueBody,
  hasUuidMetadata,
  isValidUuid,
} from '../../src/adapters/github/uuid-utils'
import { generateSpecId } from '../../src/core/frontmatter'
import { SpecScanner } from '../../src/core/scanner'
import { EnhancedMockGitHubClient } from '../mocks/github-client.mock'

describe('UUID Performance Tests', () => {
  let testDir: string
  let specsDir: string
  let scanner: SpecScanner
  let mockClient: EnhancedMockGitHubClient

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'uuid-perf-test-'))
    specsDir = path.join(testDir, 'specs')
    await fs.mkdir(specsDir, { recursive: true })

    scanner = new SpecScanner(specsDir)
    mockClient = new EnhancedMockGitHubClient()
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  const createSpecDirectory = async (dirName: string, specContent: string) => {
    const specDirPath = path.join(specsDir, dirName)
    await fs.mkdir(specDirPath, { recursive: true })
    await fs.writeFile(path.join(specDirPath, 'spec.md'), specContent)
    return specDirPath
  }

  const measurePerformance = async <T>(operation: () => Promise<T>): Promise<{ result: T, duration: number }> => {
    const startTime = performance.now()
    const result = await operation()
    const endTime = performance.now()
    return { result, duration: endTime - startTime }
  }

  describe('UUID generation performance', () => {
    test('generates UUIDs efficiently', async () => {
      const iterations = 1000

      const { duration } = await measurePerformance(async () => {
        const uuids: string[] = []
        for (let i = 0; i < iterations; i++) {
          uuids.push(generateSpecId())
        }
        return uuids
      })

      // Should generate 1000 UUIDs in under 100ms
      expect(duration).toBeLessThan(100)
      console.log(`Generated ${iterations} UUIDs in ${duration.toFixed(2)}ms (${(iterations / duration * 1000).toFixed(0)} UUIDs/sec)`)
    })

    test('validates UUID uniqueness at scale', async () => {
      const iterations = 10000
      const uuids = new Set<string>()

      const { result, duration } = await measurePerformance(async () => {
        for (let i = 0; i < iterations; i++) {
          const uuid = generateSpecId()

          // Ensure uniqueness
          if (uuids.has(uuid)) {
            throw new Error(`Duplicate UUID generated: ${uuid}`)
          }
          uuids.add(uuid)
        }
        return uuids.size
      })

      expect(result).toBe(iterations)
      expect(duration).toBeLessThan(500) // Should complete in under 500ms

      console.log(`Generated ${iterations} unique UUIDs in ${duration.toFixed(2)}ms`)
    })

    test('UUID format validation performance', async () => {
      const validUuids = Array.from({ length: 1000 }, () => generateSpecId())
      const invalidUuids = [
        'not-a-uuid',
        '123-456-789',
        '',
        'invalid-uuid-format',
        '550e8400-e29b-41d4-a716-44665544000', // too short
        '550e8400-e29b-41d4-a716-446655440000-extra', // too long
      ]

      const { duration: validDuration } = await measurePerformance(async () => {
        return validUuids.every(uuid => isValidUuid(uuid))
      })

      const { duration: invalidDuration } = await measurePerformance(async () => {
        return invalidUuids.every(uuid => !isValidUuid(uuid))
      })

      // Should validate 1000 UUIDs very quickly
      expect(validDuration).toBeLessThan(10)
      expect(invalidDuration).toBeLessThan(5)

      console.log(`Validated ${validUuids.length} valid UUIDs in ${validDuration.toFixed(2)}ms`)
      console.log(`Validated ${invalidUuids.length} invalid UUIDs in ${invalidDuration.toFixed(2)}ms`)
    })
  })

  describe('UUID search performance', () => {
    test('searches UUIDs efficiently with small datasets', async () => {
      const numIssues = 100
      const targetUuid = generateSpecId()

      // Create mock issues with UUIDs
      const mockIssues = Array.from({ length: numIssues }, (_, i) => ({
        number: i + 1,
        title: `Issue ${i + 1}`,
        uuid: i === 50 ? targetUuid : generateSpecId(), // Target at middle
        content: `Content for issue ${i + 1}`,
      }))

      mockClient.addMockIssuesWithUuids(mockIssues)

      const { result, duration } = await measurePerformance(async () => {
        return await mockClient.searchIssueByUuid(targetUuid)
      })

      expect(result).toBeDefined()
      expect(result?.number).toBe(51) // 0-based index 50 + 1
      expect(duration).toBeLessThan(5) // Should be very fast for small datasets

      console.log(`Found UUID in ${numIssues} issues in ${duration.toFixed(2)}ms`)
    })

    test('searches UUIDs efficiently with large datasets', async () => {
      const numIssues = 1000
      const targetUuid = generateSpecId()

      // Create mock issues with UUIDs
      const mockIssues = Array.from({ length: numIssues }, (_, i) => ({
        number: i + 1,
        title: `Issue ${i + 1}`,
        uuid: i === 999 ? targetUuid : generateSpecId(), // Target at end (worst case)
        content: `Content for issue ${i + 1}`,
      }))

      mockClient.addMockIssuesWithUuids(mockIssues)

      const { result, duration } = await measurePerformance(async () => {
        return await mockClient.searchIssueByUuid(targetUuid)
      })

      expect(result).toBeDefined()
      expect(result?.number).toBe(1000)
      expect(duration).toBeLessThan(20) // Should still be fast for 1000 issues

      console.log(`Found UUID in ${numIssues} issues in ${duration.toFixed(2)}ms`)
    })

    test('handles non-existent UUID search efficiently', async () => {
      const numIssues = 500
      const nonExistentUuid = generateSpecId()

      // Create mock issues without the target UUID
      const mockIssues = Array.from({ length: numIssues }, (_, i) => ({
        number: i + 1,
        title: `Issue ${i + 1}`,
        uuid: generateSpecId(),
        content: `Content for issue ${i + 1}`,
      }))

      mockClient.addMockIssuesWithUuids(mockIssues)

      const { result, duration } = await measurePerformance(async () => {
        return await mockClient.searchIssueByUuid(nonExistentUuid)
      })

      expect(result).toBeNull()
      expect(duration).toBeLessThan(15) // Should scan all issues quickly

      console.log(`Searched ${numIssues} issues for non-existent UUID in ${duration.toFixed(2)}ms`)
    })
  })

  describe('file I/O performance for UUID persistence', () => {
    test('persists UUIDs to single file efficiently', async () => {
      const specContent = `---
title: Performance Test
sync_status: draft
---

# Performance Test

Testing UUID persistence performance.`

      await createSpecDirectory('perf-single', specContent)

      const { duration } = await measurePerformance(async () => {
        const specs = await scanner.scanAll()
        return specs[0]
      })

      // Single file should be very fast
      expect(duration).toBeLessThan(50)

      console.log(`Scanned and persisted UUID for single spec in ${duration.toFixed(2)}ms`)
    })

    test('persists UUIDs to multiple files efficiently', async () => {
      const numSpecs = 50
      const specContent = `---
title: Performance Test
sync_status: draft
---

# Performance Test

Testing UUID persistence performance.`

      // Create multiple spec directories
      const createPromises = Array.from({ length: numSpecs }, (_, i) =>
        createSpecDirectory(`perf-${i.toString().padStart(3, '0')}`, specContent))
      await Promise.all(createPromises)

      const { result, duration } = await measurePerformance(async () => {
        return await scanner.scanAll()
      })

      expect(result).toHaveLength(numSpecs)
      // All specs should have UUIDs generated
      result.forEach((spec) => {
        const specFile = spec.files.get('spec.md')
        expect(specFile?.frontmatter.spec_id).toBeDefined()
      })

      // Should handle 50 files in reasonable time
      expect(duration).toBeLessThan(1000) // 1 second

      console.log(`Scanned and persisted UUIDs for ${numSpecs} specs in ${duration.toFixed(2)}ms (${(duration / numSpecs).toFixed(2)}ms per spec)`)
    })

    test('handles large spec files efficiently', async () => {
      const largeContent = `---
title: Large Spec Performance Test
sync_status: draft
---

# Large Spec Performance Test

${'This is a large spec with lots of content.\n'.repeat(1000)}

## Section 1

${'More content here.\n'.repeat(500)}

## Section 2

${'Even more content.\n'.repeat(500)}`

      await createSpecDirectory('perf-large', largeContent)

      const { result, duration } = await measurePerformance(async () => {
        const specs = await scanner.scanAll()
        return specs[0]
      })

      expect(result).toBeDefined()
      const specFile = result.files.get('spec.md')
      expect(specFile?.frontmatter.spec_id).toBeDefined()

      // Should handle large files efficiently
      expect(duration).toBeLessThan(100)

      console.log(`Processed large spec file (~50KB) in ${duration.toFixed(2)}ms`)
    })
  })

  describe('UUID embedding and extraction performance', () => {
    test('embeds UUIDs in issue bodies efficiently', async () => {
      const uuid = generateSpecId()
      const baseBody = 'This is a test issue body with some content.'
      const iterations = 1000

      const { duration } = await measurePerformance(async () => {
        for (let i = 0; i < iterations; i++) {
          embedUuidInIssueBody(baseBody, uuid)
        }
      })

      expect(duration).toBeLessThan(50) // Should be very fast
      console.log(`Embedded UUID in ${iterations} issue bodies in ${duration.toFixed(2)}ms`)
    })

    test('extracts UUIDs from issue bodies efficiently', async () => {
      const uuid = generateSpecId()
      const bodyWithUuid = embedUuidInIssueBody('Test content', uuid)
      const iterations = 1000

      const { duration } = await measurePerformance(async () => {
        for (let i = 0; i < iterations; i++) {
          const extracted = extractUuidFromIssueBody(bodyWithUuid)
          if (extracted !== uuid) {
            throw new Error(`UUID extraction failed: expected ${uuid}, got ${extracted}`)
          }
        }
      })

      expect(duration).toBeLessThan(20) // Should be very fast
      console.log(`Extracted UUID from ${iterations} issue bodies in ${duration.toFixed(2)}ms`)
    })

    test('detects UUID metadata efficiently', async () => {
      const uuid = generateSpecId()
      const bodyWithUuid = embedUuidInIssueBody('Test content', uuid)
      const bodyWithoutUuid = 'Test content without UUID'
      const iterations = 500

      const { duration } = await measurePerformance(async () => {
        for (let i = 0; i < iterations; i++) {
          const hasUuid1 = hasUuidMetadata(bodyWithUuid)
          const hasUuid2 = hasUuidMetadata(bodyWithoutUuid)

          if (!hasUuid1 || hasUuid2) {
            throw new Error('UUID metadata detection failed')
          }
        }
      })

      expect(duration).toBeLessThan(15)
      console.log(`Detected UUID metadata in ${iterations * 2} bodies in ${duration.toFixed(2)}ms`)
    })

    test('handles very large issue bodies efficiently', async () => {
      const uuid = generateSpecId()
      const largeContent = 'A'.repeat(100000) // 100KB content

      const { result: embedResult, duration: embedDuration } = await measurePerformance(async () => {
        return embedUuidInIssueBody(largeContent, uuid)
      })

      const { result: extractResult, duration: extractDuration } = await measurePerformance(async () => {
        return extractUuidFromIssueBody(embedResult)
      })

      expect(extractResult).toBe(uuid)
      expect(embedDuration).toBeLessThan(10) // Should be fast even for large content
      expect(extractDuration).toBeLessThan(10)

      console.log(`Embedded UUID in 100KB body in ${embedDuration.toFixed(2)}ms`)
      console.log(`Extracted UUID from 100KB body in ${extractDuration.toFixed(2)}ms`)
    })
  })

  describe('concurrent operations performance', () => {
    test('handles concurrent UUID generation efficiently', async () => {
      const concurrency = 10
      const iterations = 100

      const { duration } = await measurePerformance(async () => {
        const promises = Array.from({ length: concurrency }, async () => {
          const uuids = new Set<string>()
          for (let i = 0; i < iterations; i++) {
            uuids.add(generateSpecId())
          }
          return uuids
        })

        const results = await Promise.all(promises)

        // Verify no duplicates across all concurrent operations
        const allUuids = new Set<string>()
        results.forEach((uuidSet) => {
          uuidSet.forEach((uuid) => {
            if (allUuids.has(uuid)) {
              throw new Error(`Duplicate UUID found in concurrent generation: ${uuid}`)
            }
            allUuids.add(uuid)
          })
        })

        return allUuids.size
      })

      const totalGenerated = concurrency * iterations
      expect(duration).toBeLessThan(200) // Should handle concurrent generation well

      console.log(`Generated ${totalGenerated} UUIDs concurrently (${concurrency} threads) in ${duration.toFixed(2)}ms`)
    })

    test('handles concurrent spec scanning efficiently', async () => {
      const numSpecs = 20
      const specContent = `---
title: Concurrent Test
sync_status: draft
---

# Concurrent Test

Testing concurrent scanning.`

      // Create specs
      await Promise.all(
        Array.from({ length: numSpecs }, (_, i) =>
          createSpecDirectory(`concurrent-${i.toString().padStart(2, '0')}`, specContent)),
      )

      const { result, duration } = await measurePerformance(async () => {
        // Run multiple scanners concurrently
        const scanners = Array.from({ length: 3 }, () => new SpecScanner(specsDir))
        const scanPromises = scanners.map(s => s.scanAll())

        const results = await Promise.all(scanPromises)

        // All scanners should find the same number of specs
        results.forEach((specs) => {
          expect(specs).toHaveLength(numSpecs)
        })

        return results[0]
      })

      expect(result).toHaveLength(numSpecs)
      expect(duration).toBeLessThan(500) // Should handle concurrent scanning

      console.log(`Scanned ${numSpecs} specs with 3 concurrent scanners in ${duration.toFixed(2)}ms`)
    })
  })

  describe('memory usage optimization', () => {
    test('maintains reasonable memory usage during bulk operations', async () => {
      const numIssues = 2000
      const initialMemory = process.memoryUsage().heapUsed

      // Create a large number of mock issues
      const mockIssues = Array.from({ length: numIssues }, (_, i) => ({
        number: i + 1,
        title: `Bulk Issue ${i + 1}`,
        uuid: generateSpecId(),
        content: `Content for bulk issue ${i + 1}`.repeat(10), // Make content larger
      }))

      mockClient.addMockIssuesWithUuids(mockIssues)

      // Perform multiple searches
      const searchPromises = Array.from({ length: 100 }, async (_, i) => {
        const targetIssue = mockIssues[i * 20] // Search for every 20th issue
        return await mockClient.searchIssueByUuid(targetIssue.uuid)
      })

      await Promise.all(searchPromises)

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(50)

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for ${numIssues} issues and 100 searches`)
    })
  })
})
