import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import type { GitHubIssue } from '../types/index.js';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export class GitHubClient {
  private async execute(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr && !stderr.includes('gh issue view')) {
        console.warn('GitHub CLI warning:', stderr);
      }
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`GitHub CLI error: ${error.message}`);
    }
  }

  async createIssue(
    title: string,
    body: string,
    labels?: string[]
  ): Promise<number> {
    // Write body to temp file to avoid shell escaping issues
    const tempFile = join(tmpdir(), `gh-issue-${Date.now()}.md`);
    try {
      writeFileSync(tempFile, body);
      
      const labelFlag = labels?.length ? `--label "${labels.join(',')}"` : '';
      const command = `gh issue create --title "${title}" --body-file "${tempFile}" ${labelFlag}`;
      
      const result = await this.execute(command);
      // The gh issue create command returns the issue URL, we need to extract the number
      const match = result.match(/\/(\d+)$/);
      if (!match) {
        throw new Error(`Failed to parse issue number from: ${result}`);
      }
      return parseInt(match[1], 10);
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async updateIssue(
    number: number,
    updates: { title?: string; body?: string; labels?: string[] }
  ): Promise<void> {
    const flags: string[] = [];
    let tempFile: string | undefined;
    
    try {
      if (updates.title) {
        flags.push(`--title "${updates.title}"`);
      }
      if (updates.body) {
        // Write body to temp file to avoid shell escaping issues
        tempFile = join(tmpdir(), `gh-issue-edit-${Date.now()}.md`);
        writeFileSync(tempFile, updates.body);
        flags.push(`--body-file "${tempFile}"`);
      }
      if (updates.labels) {
        flags.push(`--add-label "${updates.labels.join(',')}"`);
      }
      
      if (flags.length > 0) {
        const command = `gh issue edit ${number} ${flags.join(' ')}`;
        await this.execute(command);
      }
    } finally {
      // Clean up temp file if created
      if (tempFile) {
        try {
          unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  async getIssue(number: number): Promise<GitHubIssue | null> {
    try {
      const command = `gh issue view ${number} --json number,title,body,state,labels,assignees,milestone`;
      const result = await this.execute(command);
      const parsed = JSON.parse(result);
      
      return {
        number: parsed.number,
        title: parsed.title,
        body: parsed.body,
        state: parsed.state,
        labels: parsed.labels?.map((l: any) => l.name),
        assignees: parsed.assignees?.map((a: any) => a.login),
        milestone: parsed.milestone?.number
      };
    } catch {
      return null;
    }
  }

  async listIssues(labels?: string[]): Promise<GitHubIssue[]> {
    const labelFlag = labels?.length ? `--label "${labels.join(',')}"` : '';
    const command = `gh issue list ${labelFlag} --json number,title,body,state,labels --limit 100`;
    
    const result = await this.execute(command);
    const parsed = JSON.parse(result);
    
    return parsed.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels?.map((l: any) => l.name)
    }));
  }

  async createSubtask(
    parentNumber: number,
    title: string,
    body: string
  ): Promise<number> {
    // First create the issue
    const subtaskNumber = await this.createIssue(title, body, ['subtask']);
    
    // Then link it as a subtask using gh-sub-issue extension
    try {
      const command = `gh sub-issue add ${parentNumber} ${subtaskNumber}`;
      await this.execute(command);
    } catch (error) {
      console.warn(`Note: gh-sub-issue extension may not be installed. Subtask created but not linked.`);
    }
    
    return subtaskNumber;
  }

  async getSubtasks(parentNumber: number): Promise<number[]> {
    try {
      const command = `gh sub-issue list ${parentNumber} --json number`;
      const result = await this.execute(command);
      const parsed = JSON.parse(result);
      return parsed.map((item: any) => item.number);
    } catch {
      // If gh-sub-issue is not installed, return empty array
      return [];
    }
  }

  async addComment(issueNumber: number, body: string): Promise<void> {
    // Write body to temp file to avoid shell escaping issues
    const tempFile = join(tmpdir(), `gh-comment-${Date.now()}.md`);
    try {
      writeFileSync(tempFile, body);
      const command = `gh issue comment ${issueNumber} --body-file "${tempFile}"`;
      await this.execute(command);
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async closeIssue(number: number): Promise<void> {
    const command = `gh issue close ${number}`;
    await this.execute(command);
  }

  async reopenIssue(number: number): Promise<void> {
    const command = `gh issue reopen ${number}`;
    await this.execute(command);
  }

  async checkAuth(): Promise<boolean> {
    try {
      const command = 'gh auth status';
      await this.execute(command);
      return true;
    } catch {
      return false;
    }
  }
}