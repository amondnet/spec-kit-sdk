# TESTING.md

This document provides comprehensive testing guidelines for the spec-kit-sdk project, combining industry best practices with project-specific patterns.

## Testing Philosophy

### FIRST Principles

All tests should follow the FIRST principles:

- **Fast**: Tests should run quickly
- **Isolated**: Tests should not depend on each other
- **Repeatable**: Tests should produce consistent results in any environment
- **Self-checking**: Tests should have clear pass/fail outcomes
- **Timely**: Tests should be written alongside production code

### Testing Approach

We follow a hybrid approach combining Classical TDD and Mockist TDD:

- **Classical TDD**: Use real objects when possible, focus on final state
- **Mockist TDD**: Use test doubles for external dependencies and complex collaborations

## Test Double Patterns

Based on Martin Fowler's Test Double taxonomy, we use these patterns:

### 1. Dummy Objects
Objects passed around but never actually used. Typically fill parameter lists.

```typescript
// Example: Dummy callback that's never called
const dummyCallback = () => {}
await someFunction(data, dummyCallback)
```

### 2. Fake Objects
Working implementations with shortcuts unsuitable for production.

**Example**: `MockSyncAdapter` (plugins/sync/test/fixtures/mock-adapter.ts:5)
```typescript
export class MockSyncAdapter extends SyncAdapter {
  private mockSpecs = new Map<string, any>() // In-memory storage instead of real sync

  async push(spec: SpecDocument): Promise<RemoteRef> {
    // Simplified implementation for testing
    this.mockSpecs.set(spec.name, { id: Math.random(), title: spec.name })
    return { id: mockData.id, type: 'parent' }
  }
}
```

### 3. Stubs
Provide predetermined answers to calls made during tests.

```typescript
// Example: Stub that returns predefined values
class StubAuthService {
  async checkAuth(): Promise<boolean> {
    return true // Always returns true
  }
}
```

### 4. Spies
Stubs that record information about how they were called.

```typescript
// Example: Tracking calls in our test doubles
class SpyGitHubClient {
  public createIssueCalls: Array<{ title: string, body: string }> = []

  async createIssue(title: string, body: string): Promise<number> {
    this.createIssueCalls.push({ title, body }) // Records the call
    return 123
  }
}
```

### 5. Mocks
Pre-programmed with expectations of the calls they should receive.

**Example**: `EnhancedMockGitHubClient` (plugins/sync/test/mocks/github-client.mock.ts:16)
```typescript
export class EnhancedMockGitHubClient extends GitHubClient {
  // Call tracking for behavior verification
  public createIssueCalls: Array<{ title: string, body: string, labels?: string[] }> = []
  public updateIssueCalls: Array<{ number: number, updates: GitHubIssueUpdate }> = []

  // Error injection capabilities
  private methodErrorMap = new Map<string, Error>()

  setMethodError(methodName: string, error: Error): void {
    this.methodErrorMap.set(methodName, error)
  }

  override async createIssue(title: string, body: string, labels?: string[]): Promise<number> {
    this.checkMethodError('createIssue') // Can throw expected errors
    this.createIssueCalls.push({ title, body, labels })
    return this.mockCreateIssueResult ?? this.nextIssueId++
  }
}
```

## Verification Strategies

### State Verification
Verify the final state after an operation.

```typescript
test('should update issue state', async () => {
  // Arrange
  const mockClient = new EnhancedMockGitHubClient()
  mockClient.setMockIssue(123, { number: 123, state: 'OPEN' })

  // Act
  await mockClient.closeIssue(123)

  // Assert - Check final state
  const issue = await mockClient.getIssue(123)
  expect(issue?.state).toBe('CLOSED')
})
```

### Behavior Verification
Verify the interactions between objects.

```typescript
test('should call GitHub API with correct parameters', async () => {
  // Arrange
  const mockClient = new MockGitHubClient()
  const adapter = new GitHubAdapter({ owner: 'test', repo: 'test' })
  adapter.client = mockClient

  // Act
  await adapter.push(mockSpec)

  // Assert - Check behavior
  expect(mockClient.createIssueCalls).toHaveLength(1)
  expect(mockClient.createIssueCalls[0]).toEqual({
    title: 'Test Spec',
    body: expect.stringContaining('This is a test'),
    labels: ['spec']
  })
})
```

## Test Structure

### Naming Conventions
Use descriptive test names that clearly indicate the scenario and expected behavior. Group related tests using `describe` blocks to organize by method or functionality.

```typescript
// ✅ Good - Group by method, clear scenario descriptions
describe('GitHubAdapter', () => {
  describe('push', () => {
    test('should create GitHub issue when spec is valid', async () => {})
    test('should handle missing labels gracefully', async () => {})
  })

  describe('getLabels', () => {
    test('should fallback to file type when document type missing from config', () => {})
    test('should combine common and type labels correctly', () => {})
  })
})

// ❌ Avoid - unclear or too generic
test('test push', async () => {})
test('labels work correctly', () => {})
```

### Arrange-Act-Assert (AAA) Pattern
Structure tests in three clear sections:

```typescript
test('should_combine_common_and_type_labels', () => {
  // Arrange
  const adapter = new GitHubAdapter({
    owner: 'test',
    repo: 'test',
    labels: {
      spec: ['spec', 'feature'],
      common: ['project', 'epic']
    }
  })

  // Act
  const result = adapter.getLabels('spec')

  // Assert
  expect(result).toEqual(['project', 'epic', 'spec', 'feature'])
})
```

### Test Organization
Group related tests using nested `describe` blocks:

```typescript
describe('GitHubAdapter', () => {
  describe('Label configuration', () => {
    test('should use default labels when no config provided', () => {})
    test('should use single string label from config', () => {})
    test('should use array labels from config', () => {})
  })

  describe('Repository configuration', () => {
    test('should pass owner and repo to GitHubClient', () => {})
  })
})
```

## Best Practices

### Test Independence
Each test should be independent and not rely on other tests:

```typescript
describe('GitHubAdapter', () => {
  let adapter: GitHubAdapter
  let mockClient: MockGitHubClient

  beforeEach(() => {
    mockClient = new MockGitHubClient()
    mockClient.reset() // Clean state for each test
  })
})
```

### Error Testing
Test both success and failure scenarios:

```typescript
test('should handle authentication failure', async () => {
  // Arrange
  const mockClient = new EnhancedMockGitHubClient()
  mockClient.setMockAuthResult(false)

  // Act & Assert
  await expect(adapter.authenticate()).resolves.toBe(false)
})

test('should handle API errors gracefully', async () => {
  // Arrange
  const mockClient = new EnhancedMockGitHubClient()
  mockClient.setMethodError('createIssue', new Error('API Error'))

  // Act & Assert
  await expect(adapter.push(mockSpec)).rejects.toThrow('API Error')
})
```

### Private Method Testing
Don't test private methods directly. Test them through public interfaces:

```typescript
// ❌ Don't do this
test('private method works', () => {
  // @ts-expect-error - accessing private method
  expect(adapter.privateMethod()).toBe(expected)
})

// ✅ Do this instead
test('public method that uses private method works', () => {
  const result = adapter.publicMethod()
  expect(result).toBe(expected)
})
```

## Anti-Patterns to Avoid

### 1. Magic Strings and Numbers
```typescript
// ❌ Avoid
expect(result.id).toBe(123)
expect(result.status).toBe('open')

// ✅ Better
const EXPECTED_ISSUE_ID = 123
const ISSUE_STATUS_OPEN = 'open'
expect(result.id).toBe(EXPECTED_ISSUE_ID)
expect(result.status).toBe(ISSUE_STATUS_OPEN)
```

### 2. Testing Implementation Details
```typescript
// ❌ Avoid - testing internal structure
expect(adapter.client.owner).toBe('test-owner')

// ✅ Better - testing behavior
const result = await adapter.push(spec)
expect(result.id).toBeDefined()
```

### 3. Multiple Acts per Test
```typescript
// ❌ Avoid
test('multiple operations', async () => {
  await adapter.createIssue() // First act
  await adapter.updateIssue() // Second act - confusing
})

// ✅ Better - separate tests
test('should create issue', async () => {
  const result = await adapter.createIssue()
  expect(result).toBeDefined()
})

test('should update issue', async () => {
  const result = await adapter.updateIssue(123, updates)
  expect(result).toBeUndefined()
})
```

### 4. Overly Complex Test Setup
```typescript
// ❌ Avoid - complex setup obscures test intent
test('complex scenario', () => {
  const spec = createComplexSpecWithMultipleFilesAndDependencies()
  // ... 20 lines of setup
  expect(result).toBe(expected)
})

// ✅ Better - simple, focused setup
test('should handle basic spec', () => {
  const spec = createMockSpec('simple-feature')
  expect(adapter.push(spec)).resolves.toBeDefined()
})
```

## Project-Specific Guidelines

### Using Our Test Doubles

1. **Use `EnhancedMockGitHubClient`** for comprehensive GitHub API testing
2. **Use `MockSyncAdapter`** for sync engine testing
3. **Use `MockSpecToIssueMapper`** for mapping logic testing

### Test File Organization
```
plugins/sync/test/
├── adapters/           # Adapter-specific tests
├── core/              # Core functionality tests
├── fixtures/          # Test data and helpers
├── mocks/             # Reusable test doubles
└── schemas/           # Schema validation tests
```

### Running Tests
```bash
# Run all tests
bun test

# Run specific test file
bun test plugins/sync/test/adapters/github.adapter.test.ts

# Run with coverage
bun test --coverage
```

### Test Configuration
Tests should be deterministic and independent. Our test doubles provide:
- **State management**: Track internal state for verification
- **Error injection**: Test error handling scenarios
- **Call tracking**: Verify behavior and interactions
- **Reset functionality**: Clean state between tests

## Resources

- [Microsoft Unit Testing Best Practices](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
- [Martin Fowler - Test Doubles](https://martinfowler.com/bliki/TestDouble.html)
- [Martin Fowler - Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html)
- [Project Standards](./STANDARDS.md)
- [Architecture Guide](./ARCHITECTURE.md)