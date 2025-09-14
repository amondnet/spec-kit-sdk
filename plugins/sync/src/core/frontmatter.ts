import matter from 'gray-matter';
import crypto from 'crypto';
import type { SpecFrontmatter, SpecFile } from '../types/index.js';

export function parseMarkdownWithFrontmatter(content: string, filepath: string): SpecFile {
  const parsed = matter(content);
  const frontmatter = parsed.data as SpecFrontmatter;
  
  return {
    path: filepath,
    filename: filepath.split('/').pop() || '',
    content: parsed.content,
    frontmatter,
    markdown: parsed.content
  };
}

export function stringifyMarkdownWithFrontmatter(file: SpecFile): string {
  return matter.stringify(file.markdown, file.frontmatter);
}

export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 12);
}

export function updateFrontmatter(file: SpecFile, updates: Partial<SpecFrontmatter>): SpecFile {
  return {
    ...file,
    frontmatter: {
      ...file.frontmatter,
      ...updates,
      last_sync: new Date().toISOString(),
      sync_hash: calculateContentHash(file.markdown)
    }
  };
}

export function hasContentChanged(file: SpecFile): boolean {
  const currentHash = calculateContentHash(file.markdown);
  return currentHash !== file.frontmatter.sync_hash;
}

export function mergeFrontmatter(
  local: SpecFrontmatter,
  remote: SpecFrontmatter
): SpecFrontmatter {
  // Prefer remote GitHub issue numbers
  const merged: SpecFrontmatter = {
    ...local,
    github_issue: remote.github_issue || local.github_issue,
    parent_issue: remote.parent_issue || local.parent_issue,
    issue_type: remote.issue_type || local.issue_type
  };

  // Determine sync status based on timestamps
  if (local.last_sync && remote.last_sync) {
    const localTime = new Date(local.last_sync).getTime();
    const remoteTime = new Date(remote.last_sync).getTime();
    
    if (localTime > remoteTime) {
      merged.sync_status = 'conflict';
    } else {
      merged.sync_status = 'synced';
    }
  }

  return merged;
}

export function createDefaultFrontmatter(
  issueNumber?: number,
  parentIssue?: number
): SpecFrontmatter {
  return {
    github_issue: issueNumber,
    issue_type: parentIssue ? 'subtask' : 'parent',
    parent_issue: parentIssue,
    sync_status: 'draft',
    last_sync: new Date().toISOString(),
    auto_sync: true
  };
}