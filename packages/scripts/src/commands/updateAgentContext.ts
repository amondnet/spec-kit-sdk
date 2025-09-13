/**
 * Update Agent Context Command
 *
 * Implements the updateAgentContext function that updates AI agent configuration files
 * with current project context. Equivalent to update-agent-context.sh/ps1 script functionality.
 */

import { SpecKitProject } from '../core/SpecKitProject.js';
import { files, paths } from '../utils/index.js';
import type {
  UpdateAgentContextResult,
  UpdateAgentContextOptions,
  SupportedAgentType
} from '../contracts/spec-kit-library.js';
import {
  SpecKitError,
  FeatureBranchError,
  GitRepositoryError,
  FileOperationError,
  SUPPORTED_AGENT_TYPES
} from '../contracts/spec-kit-library.js';

/**
 * Updates AI agent configuration files with current context
 *
 * This function:
 * 1. Validates the agent type
 * 2. Gets the agent configuration file path
 * 3. Gathers current project context (features, current branch, etc.)
 * 4. Updates or creates the agent configuration file
 * 5. Returns the update result
 *
 * @param agentType - Type of AI assistant to configure
 * @param options - Configuration options including JSON output
 * @returns Agent update result with file path and status
 * @throws Error if unsupported agent type or file permissions
 */
export async function updateAgentContext(
  agentType: SupportedAgentType,
  options: Pick<UpdateAgentContextOptions, 'json'> = {}
): Promise<UpdateAgentContextResult> {
  try {
    // Validate agent type
    if (!SUPPORTED_AGENT_TYPES.includes(agentType)) {
      throw new FeatureBranchError(
        `Unsupported agent type: ${agentType}. Supported types: ${SUPPORTED_AGENT_TYPES.join(', ')}`
      );
    }

    // Initialize project from current directory
    const project = await SpecKitProject.fromCurrentDirectory();

    // Get agent configuration file path
    const agentFile = paths.getAgentConfigPath(project.repoRoot, agentType);

    // Check if this is an update or creation
    const fileExists = await files.fileExists(agentFile);

    // Generate context content based on current project state
    const contextContent = await generateAgentContext(project, agentType);

    // Write the context file
    await files.writeFile(agentFile, contextContent);

    // Prepare the result
    const result: UpdateAgentContextResult = {
      AGENT_FILE: agentFile,
      UPDATED: true, // We always write content, so it's always updated
      AGENT_TYPE: agentType
    };

    // Output result based on format preference
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const action = fileExists ? 'Updated' : 'Created';
      console.log(`${action} ${agentType} agent configuration: ${agentFile}`);
      console.log(`Agent type: ${result.AGENT_TYPE}`);
    }

    return result;
  } catch (error) {
    // Handle different error types appropriately
    if (error instanceof SpecKitError) {
      throw error;
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new FileOperationError(`Failed to update agent context: ${errorMessage}`);
  }
}

/**
 * Generate agent-specific context content
 * @param project SpecKitProject instance
 * @param agentType Type of AI agent
 * @returns Context content as markdown string
 */
async function generateAgentContext(project: SpecKitProject, agentType: SupportedAgentType): Promise<string> {
  const features = await project.getFeatures();
  const currentFeature = await project.getCurrentFeature();
  const isOnFeatureBranch = project.isOnFeatureBranch();

  let content = `# ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent Context\n\n`;
  content += `*Auto-generated context file for ${agentType} AI assistant*\n\n`;
  content += `**Last Updated:** ${new Date().toISOString()}\n\n`;

  // Project overview
  content += `## Project Overview\n\n`;
  content += `- **Repository Root:** \`${project.repoRoot}\`\n`;
  content += `- **Current Branch:** \`${project.currentBranch}\`\n`;
  content += `- **Branch Type:** ${isOnFeatureBranch ? 'Feature Branch' : 'Non-feature Branch'}\n`;
  content += `- **Specs Directory:** \`${project.specsDir}\`\n`;
  content += `- **Templates Directory:** \`${project.templatesDir}\`\n\n`;

  // Current feature context (if applicable)
  if (currentFeature) {
    content += `## Current Feature\n\n`;
    content += `- **Feature Number:** ${currentFeature.number}\n`;
    content += `- **Feature Name:** ${currentFeature.name}\n`;
    content += `- **Description:** ${currentFeature.description}\n`;
    content += `- **Branch:** \`${currentFeature.branchName}\`\n\n`;

    const featurePaths = currentFeature.getRelativePaths();
    content += `### Feature Files\n\n`;
    content += `- **Specification:** \`${featurePaths.specFile}\`\n`;
    content += `- **Implementation Plan:** \`${featurePaths.planFile}\`\n`;
    content += `- **Tasks:** \`${featurePaths.tasksFile}\`\n`;
    content += `- **Research:** \`${featurePaths.researchFile}\`\n`;
    content += `- **Data Model:** \`${featurePaths.dataModelFile}\`\n`;
    content += `- **Quickstart:** \`${featurePaths.quickstartFile}\`\n`;
    content += `- **Contracts Directory:** \`${featurePaths.contractsDir}/\`\n\n`;

    // Current feature state
    const state = await currentFeature.getCurrentState();
    content += `- **Current State:** ${state}\n\n`;
  }

  // All features summary
  if (features.length > 0) {
    content += `## All Features (${features.length})\n\n`;
    for (const feature of features) {
      const state = await feature.getCurrentState();
      const isCurrentMarker = feature.isCurrentFeature() ? ' ⭐ (current)' : '';
      content += `- **${feature.number}:** ${feature.description} - *${state}*${isCurrentMarker}\n`;
    }
    content += `\n`;
  } else {
    content += `## Features\n\nNo features found in this project.\n\n`;
  }

  // Agent-specific instructions
  content += generateAgentSpecificInstructions(agentType);

  // Workflow commands
  content += `## Available Commands\n\n`;
  content += `- \`createNewFeature <description>\` - Create new feature specification\n`;
  content += `- \`setupPlan\` - Setup implementation planning (must be on feature branch)\n`;
  content += `- \`checkTaskPrerequisites\` - Check if all files exist for task execution\n`;
  content += `- \`getFeaturePaths\` - Get standardized paths for current feature\n`;
  content += `- \`updateAgentContext <agent>\` - Update this context file\n\n`;

  content += `---\n`;
  content += `\n*This context file is automatically maintained by the spec-kit library.*\n`;

  return content;
}

/**
 * Generate agent-specific instructions and tips
 * @param agentType Type of AI agent
 * @returns Agent-specific markdown content
 */
function generateAgentSpecificInstructions(agentType: SupportedAgentType): string {
  let content = `## ${agentType.charAt(0).toUpperCase() + agentType.slice(1)}-Specific Instructions\n\n`;

  switch (agentType) {
    case 'claude':
      content += `### Claude Code Integration\n\n`;
      content += `- Use the \`/specify\`, \`/plan\`, and \`/tasks\` commands for Spec-Driven Development\n`;
      content += `- Commands execute TypeScript functions that maintain SDD workflow consistency\n`;
      content += `- Always work within feature branches for new development\n`;
      content += `- Follow the template structures defined in the templates directory\n\n`;
      break;

    case 'copilot':
      content += `### GitHub Copilot Integration\n\n`;
      content += `- Use spec-kit CLI commands: \`npx spec-kit-cli create-feature\`, etc.\n`;
      content += `- Reference specification files when implementing features\n`;
      content += `- Follow the established patterns in existing features\n`;
      content += `- Maintain consistency with project structure and conventions\n\n`;
      break;

    case 'gemini':
      content += `### Gemini Integration\n\n`;
      content += `- Use the spec-kit TypeScript API for programmatic access\n`;
      content += `- Reference this context file for current project state\n`;
      content += `- Follow Spec-Driven Development methodology\n`;
      content += `- Ensure all features follow the established patterns\n\n`;
      break;
  }

  return content;
}

/**
 * Command line interface handler for updateAgentContext
 * Parses arguments and calls the main function
 * @param args Command line arguments
 */
export async function updateAgentContextCommand(args: string[]): Promise<void> {
  try {
    // Parse command line arguments
    const options: Pick<UpdateAgentContextOptions, 'json'> = {};
    let agentType: SupportedAgentType | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--json' || arg === '-j') {
        options.json = true;
      } else if (arg === '--help' || arg === '-h') {
        printHelp();
        return;
      } else if (!agentType && SUPPORTED_AGENT_TYPES.includes(arg as SupportedAgentType)) {
        agentType = arg as SupportedAgentType;
      }
    }

    // Validate that agent type was provided
    if (!agentType) {
      console.error('Error: Agent type is required');
      console.error(`Supported types: ${SUPPORTED_AGENT_TYPES.join(', ')}`);
      console.error('Usage: updateAgentContext <agent-type> [--json]');
      process.exit(1);
    }

    // Execute the command
    await updateAgentContext(agentType, options);
  } catch (error) {
    if (error instanceof SpecKitError) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    console.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Print help information for the updateAgentContext command
 */
function printHelp(): void {
  console.log(`
Usage: updateAgentContext <agent-type> [options]

Updates AI agent configuration files with current project context.

Arguments:
  agent-type         Type of AI agent to configure
                     Options: ${SUPPORTED_AGENT_TYPES.join(', ')}

Options:
  --json, -j         Output result in JSON format
  --help, -h         Show this help message

Examples:
  updateAgentContext claude
  updateAgentContext copilot --json

This command will:
1. Gather current project context (features, branch info, etc.)
2. Generate agent-specific configuration content
3. Update or create the appropriate agent configuration file:
   - claude: .claude/docs/tasks/context.md
   - copilot: .github/copilot/context.md
   - gemini: .gemini/context.md
`);
}