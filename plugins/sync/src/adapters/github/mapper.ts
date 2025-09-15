import type { GitHubIssue, SpecDocument, SpecFile } from '../../types/index.js'

export class SpecToIssueMapper {
  generateTitle(specName: string, fileType: string): string {
    const cleanName = specName.replace(/^\d+-/, '').replace(/-/g, ' ')
    const capitalizedName = cleanName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    switch (fileType) {
      case 'spec':
        return `Feature Specification: ${capitalizedName}`
      case 'plan':
        return `Plan: ${capitalizedName}`
      case 'research':
        return `Research: ${capitalizedName}`
      case 'quickstart':
        return `Quickstart: ${capitalizedName}`
      case 'data-model':
      case 'datamodel':
        return `Data Model: ${capitalizedName}`
      case 'tasks':
        return `Tasks: ${capitalizedName}`
      case 'contracts':
        return `API Contracts: ${capitalizedName}`
      default:
        return `${fileType}: ${capitalizedName}`
    }
  }

  generateBody(markdown: string, spec: SpecDocument): string {
    // Remove frontmatter from markdown for GitHub issue body
    const cleanMarkdown = this.removeFrontmatter(markdown)

    // Add footer with metadata
    const footer = this.generateFooter(spec)

    return `${cleanMarkdown}\n\n---\n\n${footer}`
  }

  issueToSpec(issue: GitHubIssue): SpecDocument {
    // Extract spec name from title
    const specName = this.extractSpecName(issue.title)

    // Create a basic spec document structure
    const specFile: SpecFile = {
      path: `specs/${specName}/spec.md`,
      filename: 'spec.md',
      frontmatter: {
        issue_type: 'parent',
        sync_status: 'synced',
        last_sync: new Date().toISOString(),
        auto_sync: true,
        github: {
          issue_number: issue.number,
        },
      },
      content: issue.body,
      markdown: issue.body,
    }

    return {
      name: specName,
      path: `specs/${specName}`,
      issueNumber: issue.number,
      files: new Map([['spec.md', specFile]]),
    }
  }

  private removeFrontmatter(content: string): string {
    // Remove YAML frontmatter if present
    if (content.startsWith('---')) {
      const endIndex = content.indexOf('---', 3)
      if (endIndex !== -1) {
        return content.substring(endIndex + 3).trim()
      }
    }
    return content
  }

  private addFrontmatter(content: string, frontmatter: any): string {
    const yamlLines = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${this.formatYamlValue(value)}`)
      .join('\n')

    return `---\n${yamlLines}\n---\n\n${content}`
  }

  private formatYamlValue(value: any): string {
    if (typeof value === 'string') {
      return value.includes(' ') ? `"${value}"` : value
    }
    return String(value)
  }

  private generateFooter(spec: SpecDocument): string {
    return [
      `**Spec:** \`${spec.name}\``,
      `**Path:** \`${spec.path}\``,
      `**Synced:** ${new Date().toISOString()}`,
    ].join('  \n')
  }

  private extractSpecName(title: string): string {
    // Extract spec name from title like "Feature Specification: User Authentication"
    const match = title.match(/^(?:Feature Specification|Plan|Research|Quickstart|Data Model|Tasks|API Contracts):\s(.*)$/i)
    if (match) {
      return match[1]
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    }

    // Fallback: use the full title
    return title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
  }
}
