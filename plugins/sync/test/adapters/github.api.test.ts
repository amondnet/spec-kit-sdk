import { describe, expect, test } from 'bun:test'
import { GitHubClient } from '../../src/adapters/github/api.js'

describe('GitHubClient', () => {
  describe('Constructor', () => {
    test('should store owner and repo when provided', () => {
      const client = new GitHubClient('test-owner', 'test-repo')

      // @ts-expect-error - accessing private property for testing
      expect(client.owner).toBe('test-owner')
      // @ts-expect-error - accessing private property for testing
      expect(client.repo).toBe('test-repo')
      // @ts-expect-error - accessing private property for testing
      expect(client.repoFlag).toBe('--repo test-owner/test-repo')
    })

    test('should not set repoFlag when owner or repo missing', () => {
      const client1 = new GitHubClient('test-owner', undefined)
      // @ts-expect-error - accessing private property for testing
      expect(client1.repoFlag).toBeUndefined()

      const client2 = new GitHubClient(undefined, 'test-repo')
      // @ts-expect-error - accessing private property for testing
      expect(client2.repoFlag).toBeUndefined()

      const client3 = new GitHubClient()
      // @ts-expect-error - accessing private property for testing
      expect(client3.repoFlag).toBeUndefined()
    })
  })

  describe('getRepoFlag', () => {
    test('should return cached repoFlag when available', async () => {
      const client = new GitHubClient('cached-owner', 'cached-repo')

      // @ts-expect-error - accessing private method for testing
      const flag = await client.getRepoFlag()
      expect(flag).toBe('--repo cached-owner/cached-repo')
    })

    test('should use stored repoFlag on multiple calls', async () => {
      const client = new GitHubClient('multi-owner', 'multi-repo')

      // @ts-expect-error - accessing private method for testing
      const flag1 = await client.getRepoFlag()
      // @ts-expect-error - accessing private method for testing
      const flag2 = await client.getRepoFlag()

      expect(flag1).toBe('--repo multi-owner/multi-repo')
      expect(flag2).toBe('--repo multi-owner/multi-repo')
      // Both should be the same reference (cached)
      expect(flag1).toBe(flag2)
    })

    test('should auto-detect repository when not provided', async () => {
      const client = new GitHubClient()

      // Mock getDefaultRepository to simulate auto-detection
      // @ts-expect-error - accessing private method for testing
      client.getDefaultRepository = async () => ({
        owner: 'detected-owner',
        repo: 'detected-repo',
      })

      // @ts-expect-error - accessing private method for testing
      const flag = await client.getRepoFlag()
      expect(flag).toBe('--repo detected-owner/detected-repo')

      // Verify that the values were cached
      // @ts-expect-error - accessing private property for testing
      expect(client.owner).toBe('detected-owner')
      // @ts-expect-error - accessing private property for testing
      expect(client.repo).toBe('detected-repo')
      // @ts-expect-error - accessing private property for testing
      expect(client.repoFlag).toBe('--repo detected-owner/detected-repo')
    })

    test('should cache auto-detected repository for subsequent calls', async () => {
      const client = new GitHubClient()
      let callCount = 0

      // Mock getDefaultRepository to track calls
      // @ts-expect-error - accessing private method for testing
      client.getDefaultRepository = async () => {
        callCount++
        return {
          owner: 'auto-owner',
          repo: 'auto-repo',
        }
      }

      // First call should trigger auto-detection
      // @ts-expect-error - accessing private method for testing
      const flag1 = await client.getRepoFlag()
      expect(flag1).toBe('--repo auto-owner/auto-repo')
      expect(callCount).toBe(1)

      // Second call should use cached value
      // @ts-expect-error - accessing private method for testing
      const flag2 = await client.getRepoFlag()
      expect(flag2).toBe('--repo auto-owner/auto-repo')
      expect(callCount).toBe(1) // Should not call getDefaultRepository again
    })
  })

  describe('Repository configuration behavior', () => {
    test('should handle repository configuration in constructor', () => {
      // Test with both owner and repo
      const client1 = new GitHubClient('owner1', 'repo1')
      // @ts-expect-error - accessing private property for testing
      expect(client1.owner).toBe('owner1')
      // @ts-expect-error - accessing private property for testing
      expect(client1.repo).toBe('repo1')
      // @ts-expect-error - accessing private property for testing
      expect(client1.repoFlag).toBe('--repo owner1/repo1')

      // Test with missing owner
      const client2 = new GitHubClient(undefined, 'repo2')
      // @ts-expect-error - accessing private property for testing
      expect(client2.owner).toBeUndefined()
      // @ts-expect-error - accessing private property for testing
      expect(client2.repo).toBe('repo2')
      // @ts-expect-error - accessing private property for testing
      expect(client2.repoFlag).toBeUndefined()

      // Test with missing repo
      const client3 = new GitHubClient('owner3', undefined)
      // @ts-expect-error - accessing private property for testing
      expect(client3.owner).toBe('owner3')
      // @ts-expect-error - accessing private property for testing
      expect(client3.repo).toBeUndefined()
      // @ts-expect-error - accessing private property for testing
      expect(client3.repoFlag).toBeUndefined()

      // Test with no parameters
      const client4 = new GitHubClient()
      // @ts-expect-error - accessing private property for testing
      expect(client4.owner).toBeUndefined()
      // @ts-expect-error - accessing private property for testing
      expect(client4.repo).toBeUndefined()
      // @ts-expect-error - accessing private property for testing
      expect(client4.repoFlag).toBeUndefined()
    })

    test('should format repoFlag correctly', () => {
      const testCases = [
        { owner: 'facebook', repo: 'react', expected: '--repo facebook/react' },
        { owner: 'microsoft', repo: 'vscode', expected: '--repo microsoft/vscode' },
        { owner: 'torvalds', repo: 'linux', expected: '--repo torvalds/linux' },
        { owner: 'spec-kit', repo: 'spec-kit-sdk', expected: '--repo spec-kit/spec-kit-sdk' },
      ]

      testCases.forEach(({ owner, repo, expected }) => {
        const client = new GitHubClient(owner, repo)
        // @ts-expect-error - accessing private property for testing
        expect(client.repoFlag).toBe(expected)
      })
    })
  })
})
