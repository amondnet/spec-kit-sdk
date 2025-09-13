/**
 * Test setup file for common test utilities
 * Mock functions and helpers for Bun tests
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";

// Mock process environment for cross-platform testing
export interface MockProcessEnv {
  platform: 'win32' | 'darwin' | 'linux';
  env: Record<string, string>;
  cwd: string;
  sep: string;
}

export class PlatformMocker {
  private originalPlatform: string;
  private originalEnv: Record<string, string>;
  private originalCwd: string;

  constructor() {
    this.originalPlatform = process.platform;
    this.originalEnv = { ...process.env };
    this.originalCwd = process.cwd();
  }

  mockPlatform(platform: 'win32' | 'darwin' | 'linux') {
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: true,
      configurable: true
    });

    // Mock path separator based on platform
    const path = require('path');
    if (platform === 'win32') {
      path.sep = '\\';
      path.delimiter = ';';
    } else {
      path.sep = '/';
      path.delimiter = ':';
    }
  }

  mockEnv(env: Record<string, string>) {
    process.env = { ...this.originalEnv, ...env };
  }

  mockCwd(cwd: string) {
    // Mock process.cwd for testing
    const originalCwd = process.cwd;
    process.cwd = () => cwd;
  }

  restore() {
    Object.defineProperty(process, 'platform', {
      value: this.originalPlatform,
      writable: true,
      configurable: true
    });
    process.env = this.originalEnv;
    // Note: Cannot easily restore process.cwd, so tests should handle this
  }
}

// Mock file system operations
export class FileSystemMocker {
  private fsPromises = require('fs/promises');
  private originalMethods: Record<string, any> = {};

  mockMethods() {
    // Store original methods
    this.originalMethods.readdir = this.fsPromises.readdir;
    this.originalMethods.readFile = this.fsPromises.readFile;
    this.originalMethods.writeFile = this.fsPromises.writeFile;
    this.originalMethods.mkdir = this.fsPromises.mkdir;
    this.originalMethods.stat = this.fsPromises.stat;
    this.originalMethods.access = this.fsPromises.access;

    // Mock file system operations with Bun-compatible mocks
    this.fsPromises.readdir = this.createMockFunction();
    this.fsPromises.readFile = this.createMockFunction();
    this.fsPromises.writeFile = this.createMockFunction();
    this.fsPromises.mkdir = this.createMockFunction();
    this.fsPromises.stat = this.createMockFunction();
    this.fsPromises.access = this.createMockFunction();
  }

  private createMockFunction() {
    const mockFn = (...args: any[]) => Promise.resolve();
    mockFn.mockResolvedValue = (value: any) => {
      mockFn.implementation = () => Promise.resolve(value);
      return mockFn;
    };
    mockFn.mockRejectedValue = (error: any) => {
      mockFn.implementation = () => Promise.reject(error);
      return mockFn;
    };
    mockFn.mockImplementation = (fn: Function) => {
      mockFn.implementation = fn;
      return mockFn;
    };
    return mockFn;
  }

  mockFileExists(path: string, exists: boolean = true) {
    if (exists) {
      this.fsPromises.access.mockResolvedValue(undefined);
      this.fsPromises.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    } else {
      this.fsPromises.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));
    }
  }

  mockDirectoryExists(path: string, exists: boolean = true) {
    if (exists) {
      this.fsPromises.access.mockResolvedValue(undefined);
      this.fsPromises.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false });
    } else {
      this.fsPromises.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));
    }
  }

  mockReaddir(path: string, files: string[]) {
    this.fsPromises.readdir.mockImplementation((dirPath: string) => {
      if (dirPath === path) {
        return Promise.resolve(files);
      }
      return Promise.reject(new Error('ENOENT: no such file or directory'));
    });
  }

  mockReadFile(path: string, content: string) {
    this.fsPromises.readFile.mockImplementation((filePath: string) => {
      if (filePath === path) {
        return Promise.resolve(content);
      }
      return Promise.reject(new Error('ENOENT: no such file or directory'));
    });
  }

  restore() {
    // Restore original methods
    Object.assign(this.fsPromises, this.originalMethods);
  }
}

// Mock Git operations
export class GitMocker {
  private simpleGit = require('simple-git');
  private mockGit: any;

  constructor() {
    this.mockGit = {
      branch: this.createMockFunction(),
      checkout: this.createMockFunction(),
      checkoutBranch: this.createMockFunction(),
      add: this.createMockFunction(),
      commit: this.createMockFunction(),
      push: this.createMockFunction(),
      status: this.createMockFunction(),
      log: this.createMockFunction(),
      raw: this.createMockFunction()
    };
  }

  private createMockFunction() {
    const mockFn = (...args: any[]) => Promise.resolve();
    mockFn.mockResolvedValue = (value: any) => {
      mockFn.implementation = () => Promise.resolve(value);
      return mockFn;
    };
    mockFn.mockRejectedValue = (error: any) => {
      mockFn.implementation = () => Promise.reject(error);
      return mockFn;
    };
    mockFn.mockImplementation = (fn: Function) => {
      mockFn.implementation = fn;
      return mockFn;
    };
    return mockFn;
  }

  mockBranchList(branches: string[], current: string = 'main') {
    this.mockGit.branch.mockResolvedValue({
      all: branches,
      current: current,
      branches: branches.reduce((acc, branch) => {
        acc[branch] = { current: branch === current };
        return acc;
      }, {} as Record<string, any>)
    });
  }

  mockStatus(status: any = { isClean: () => true }) {
    this.mockGit.status.mockResolvedValue(status);
  }

  mockLog(commits: Array<{ hash: string; message: string; author_name: string; date: string }>) {
    this.mockGit.log.mockResolvedValue({
      latest: commits[0] || null,
      total: commits.length,
      all: commits
    });
  }

  getMock() {
    return this.mockGit;
  }
}

// Test utilities for JSON comparison
export class JsonComparator {
  /**
   * Compare two JSON objects ignoring property order
   */
  static compareIgnoreOrder(obj1: any, obj2: any): boolean {
    return JSON.stringify(this.sortObject(obj1)) === JSON.stringify(this.sortObject(obj2));
  }

  /**
   * Sort object properties recursively for consistent comparison
   */
  static sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }

    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObject(obj[key]);
    });

    return sorted;
  }

  /**
   * Check if JSON string is properly formatted
   */
  static isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compare JSON strings with detailed diff information
   */
  static compareJsonStrings(str1: string, str2: string): {
    isEqual: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    if (!this.isValidJson(str1)) {
      differences.push('First JSON string is invalid');
    }

    if (!this.isValidJson(str2)) {
      differences.push('Second JSON string is invalid');
    }

    if (differences.length > 0) {
      return { isEqual: false, differences };
    }

    const obj1 = JSON.parse(str1);
    const obj2 = JSON.parse(str2);

    const isEqual = this.compareIgnoreOrder(obj1, obj2);

    if (!isEqual) {
      differences.push('JSON objects are not structurally equal');
      differences.push(`Object 1: ${JSON.stringify(this.sortObject(obj1), null, 2)}`);
      differences.push(`Object 2: ${JSON.stringify(this.sortObject(obj2), null, 2)}`);
    }

    return { isEqual, differences };
  }
}

// Common test data generators
export class TestDataGenerator {
  static generateFeatureName(): string {
    const adjectives = ['fast', 'smart', 'cool', 'awesome', 'great'];
    const nouns = ['feature', 'component', 'module', 'service', 'tool'];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    return `${adj} ${noun}`;
  }

  static generateFeatureNumber(): string {
    return String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  }

  static generateBranchName(featureNum: string, description: string): string {
    const slug = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${featureNum}-${slug}`;
  }

  static generateSpecPath(featureNum: string, description: string): string {
    const branchName = this.generateBranchName(featureNum, description);
    return `specs/${branchName}/spec.md`;
  }
}

// Export common testing utilities
export {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach
};

// Global test configuration
export const TEST_CONFIG = {
  timeout: 30000,
  retries: 3,
  platforms: ['win32', 'darwin', 'linux'] as const,
  mockData: {
    sampleSpecs: [
      '001-user-auth',
      '002-dashboard',
      '003-api-integration'
    ],
    sampleCommits: [
      { hash: 'abc123', message: 'feat: add user auth', author_name: 'Test User', date: '2023-01-01' },
      { hash: 'def456', message: 'fix: dashboard bug', author_name: 'Test User', date: '2023-01-02' }
    ]
  }
};