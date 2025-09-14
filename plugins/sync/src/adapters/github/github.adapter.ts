import { SyncAdapter, type RemoteRef, type AdapterCapabilities } from '../base.adapter.js';
import type { SpecDocument, SyncOptions, SyncStatus } from '../../types/index.js';
import { GitHubClient } from './api.js';
import { SpecToIssueMapper } from './mapper.js';
import crypto from 'crypto';

export class GitHubAdapter extends SyncAdapter {
  readonly platform = 'github' as const;
  private client: GitHubClient;
  private mapper: SpecToIssueMapper;

  constructor(private config: { owner: string; repo: string; auth?: string }) {
    super();
    this.client = new GitHubClient();
    this.mapper = new SpecToIssueMapper();
  }

  async authenticate(): Promise<boolean> {
    return await this.client.checkAuth();
  }

  async checkAuth(): Promise<boolean> {
    return await this.client.checkAuth();
  }

  async push(spec: SpecDocument, options?: SyncOptions): Promise<RemoteRef> {
    const mainFile = spec.files.get('spec.md');
    if (!mainFile) {
      throw new Error(`No spec.md file found in ${spec.name}`);
    }

    const issueNumber = mainFile.frontmatter.github_issue;

    if (issueNumber && !options?.force) {
      // Update existing issue
      const title = this.mapper.generateTitle(spec.name, 'spec');
      const body = this.mapper.generateBody(mainFile.markdown, spec);

      await this.client.updateIssue(issueNumber, { title, body });

      return {
        id: issueNumber,
        type: 'parent',
        url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`
      };
    } else {
      // Create new issue
      const title = this.mapper.generateTitle(spec.name, 'spec');
      const body = this.mapper.generateBody(mainFile.markdown, spec);
      const labels = ['spec'];

      const newIssueNumber = await this.client.createIssue(title, body, labels);

      // Create subtasks if supported
      if (this.capabilities().supportsSubtasks) {
        await this.createSubtasks(spec, newIssueNumber);
      }

      return {
        id: newIssueNumber,
        type: 'parent',
        url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${newIssueNumber}`
      };
    }
  }

  async pull(ref: RemoteRef, options?: SyncOptions): Promise<SpecDocument> {
    const issue = await this.client.getIssue(ref.id as number);
    if (!issue) {
      throw new Error(`Issue #${ref.id} not found`);
    }

    return this.mapper.issueToSpec(issue);
  }

  async getStatus(spec: SpecDocument): Promise<SyncStatus> {
    const mainFile = spec.files.get('spec.md');
    if (!mainFile) {
      return {
        status: 'unknown',
        hasChanges: false
      };
    }

    const issueNumber = mainFile.frontmatter.github_issue;
    if (!issueNumber) {
      return {
        status: 'draft',
        hasChanges: true
      };
    }

    // Calculate current content hash
    const currentHash = crypto
      .createHash('sha256')
      .update(mainFile.markdown)
      .digest('hex')
      .substring(0, 8);

    const storedHash = mainFile.frontmatter.sync_hash;
    const hasLocalChanges = currentHash !== storedHash;

    // Check if remote has changes
    const issue = await this.client.getIssue(issueNumber);
    if (!issue) {
      return {
        status: 'conflict',
        hasChanges: true,
        remoteId: issueNumber,
        conflicts: ['Remote issue not found']
      };
    }

    // Simple conflict detection based on modification dates
    const lastSync = mainFile.frontmatter.last_sync ? new Date(mainFile.frontmatter.last_sync) : null;
    const hasRemoteChanges = lastSync ? false : true; // GitHub API doesn't provide updated_at easily

    if (hasLocalChanges && hasRemoteChanges) {
      return {
        status: 'conflict',
        hasChanges: true,
        remoteId: issueNumber,
        lastSync,
        conflicts: ['Both local and remote have changes']
      };
    }

    if (hasLocalChanges) {
      return {
        status: 'draft',
        hasChanges: true,
        remoteId: issueNumber,
        lastSync
      };
    }

    return {
      status: 'synced',
      hasChanges: false,
      remoteId: issueNumber,
      lastSync
    };
  }

  async resolveConflict(local: SpecDocument, remote: SpecDocument, strategy?: string): Promise<SpecDocument> {
    switch (strategy) {
      case 'theirs':
        return remote;
      case 'ours':
        return local;
      default:
        throw new Error('Manual conflict resolution required');
    }
  }

  capabilities(): AdapterCapabilities {
    return {
      supportsBatch: false,
      supportsSubtasks: true,
      supportsLabels: true,
      supportsAssignees: true,
      supportsMilestones: true,
      supportsComments: true,
      supportsConflictResolution: true
    };
  }

  async createSubtask(parent: RemoteRef, title: string, body: string): Promise<RemoteRef> {
    const subtaskNumber = await this.client.createSubtask(parent.id as number, title, body);

    return {
      id: subtaskNumber,
      type: 'subtask',
      url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${subtaskNumber}`
    };
  }

  async getSubtasks(parent: RemoteRef): Promise<RemoteRef[]> {
    const subtaskNumbers = await this.client.getSubtasks(parent.id as number);

    return subtaskNumbers.map(num => ({
      id: num,
      type: 'subtask' as const,
      url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${num}`
    }));
  }

  async addComment(ref: RemoteRef, body: string): Promise<void> {
    await this.client.addComment(ref.id as number, body);
  }

  async close(ref: RemoteRef): Promise<void> {
    await this.client.closeIssue(ref.id as number);
  }

  async reopen(ref: RemoteRef): Promise<void> {
    await this.client.reopenIssue(ref.id as number);
  }

  private async createSubtasks(spec: SpecDocument, parentIssueNumber: number): Promise<void> {
    const subtaskFiles = [
      'plan.md',
      'research.md',
      'quickstart.md',
      'data-model.md',
      'tasks.md'
    ];

    for (const filename of subtaskFiles) {
      const file = spec.files.get(filename);
      if (file) {
        const fileType = filename.replace('.md', '');
        const title = this.mapper.generateTitle(spec.name, fileType);
        const body = this.mapper.generateBody(file.markdown, spec);

        await this.client.createSubtask(parentIssueNumber, title, body);
      }
    }
  }
}