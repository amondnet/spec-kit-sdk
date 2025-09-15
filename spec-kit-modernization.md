# [RFC] Modernize spec-kit with Bun, TypeScript, and Extensible Architecture

## 🎯 Executive Summary

Propose a comprehensive modernization of spec-kit to create a cross-platform, testable, and extensible Spec-Driven Development framework using Bun and TypeScript.

## 📋 Problem Statement

### Current Limitations

1. **Platform Dependency**:
   - Separate bash and PowerShell scripts required
   - Inconsistent behavior across platforms
   - Maintenance burden of dual implementations

2. **Limited Testability**:
   - Bash scripts are difficult to unit test
   - No test coverage for core functionality
   - Integration testing requires manual verification

3. **Poor Extensibility**:
   - Hard-coded behaviors in scripts
   - No plugin system for custom features
   - Templates are static with no transformation capabilities

4. **Type Safety Issues**:
   - No compile-time checks
   - Runtime errors only discovered during execution
   - Difficult to refactor safely

## 🚀 Proposed Solution

### Architecture Overview

```
spec-kit/
├── packages/
│   ├── @spec-kit/core/           # Core functionality
│   ├── @spec-kit/cli/            # CLI interface
│   ├── @spec-kit/plugins/        # Plugin system
│   ├── @spec-kit/templates/      # Template engine
│   └── @spec-kit/scripts/        # Migrated scripts
├── plugins/                      # Built-in plugins
│   ├── git-workflow/
│   ├── github-integration/
│   └── ai-assistant/
├── templates/                    # Default templates
├── tests/                        # Integration tests
└── bun.lockb                     # Bun lockfile
```

## 📦 1. Bun으로 크로스 플랫폼 지원

### Implementation Strategy

```typescript
// packages/@spec-kit/cli/src/index.ts
import { Command } from "commander";
import { SpecKit } from "@spec-kit/core";

const program = new Command()
  .name("spec-kit")
  .description("Spec-Driven Development CLI")
  .version("2.0.0");

// Cross-platform compilation
await Bun.build({
  entrypoints: ["./src/index.ts"],
  compile: true,
  target: "bun", // or bun-windows-x64, bun-darwin-arm64, etc.
  outfile: "spec-kit",
});
```

### Build Configuration

```json
// package.json
{
  "scripts": {
    "build": "bun run build:all",
    "build:all": "bun run build:windows && bun run build:mac && bun run build:linux",
    "build:windows": "bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile=dist/spec-kit-win.exe",
    "build:mac": "bun build ./src/index.ts --compile --target=bun-darwin-arm64 --outfile=dist/spec-kit-mac",
    "build:linux": "bun build ./src/index.ts --compile --target=bun-linux-x64 --outfile=dist/spec-kit-linux"
  }
}
```

### Benefits
- ✅ Single codebase for all platforms
- ✅ Native executables without runtime dependencies
- ✅ 28x faster installation than npm
- ✅ Built-in TypeScript support

## 🔧 2. TypeScript로 동작 확장 및 수정 용이성

### Hook System Architecture

```typescript
// packages/@spec-kit/core/src/hooks.ts
export interface Hook {
  name: string;
  priority?: number;
}

export interface LifecycleHooks {
  beforeSpecCreate?: Hook[];
  afterSpecCreate?: Hook[];
  beforePlanGenerate?: Hook[];
  afterPlanGenerate?: Hook[];
  beforeTaskCreate?: Hook[];
  afterTaskCreate?: Hook[];
}

export class HookManager {
  private hooks: Map<string, Hook[]> = new Map();

  register(event: string, hook: Hook): void {
    const existingHooks = this.hooks.get(event) || [];
    existingHooks.push(hook);
    existingHooks.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    this.hooks.set(event, existingHooks);
  }

  async execute(event: string, context: any): Promise<void> {
    const hooks = this.hooks.get(event) || [];
    for (const hook of hooks) {
      await hook.execute(context);
    }
  }
}
```

### Plugin System

```typescript
// packages/@spec-kit/plugins/src/plugin.ts
export interface SpecKitPlugin {
  name: string;
  version: string;
  hooks?: LifecycleHooks;
  commands?: Command[];
  templates?: Template[];

  install(specKit: SpecKit): Promise<void>;
  uninstall(specKit: SpecKit): Promise<void>;
}

// Example plugin
export class GitWorkflowPlugin implements SpecKitPlugin {
  name = "git-workflow";
  version = "1.0.0";

  hooks = {
    afterSpecCreate: [{
      name: "create-branch",
      priority: 10,
      execute: async (context) => {
        await this.createFeatureBranch(context);
      }
    }]
  };

  async install(specKit: SpecKit) {
    specKit.hooks.registerHooks(this.hooks);
  }
}
```

## 📦 3. Script를 Package로 분리하여 테스트 가능하도록 수정

### Current Script Migration

```typescript
// packages/@spec-kit/scripts/src/create-new-feature.ts
import { GitService } from "./services/git";
import { FileService } from "./services/file";
import { TemplateService } from "./services/template";

export interface CreateFeatureOptions {
  description: string;
  jsonMode?: boolean;
  template?: string;
}

export class CreateFeatureCommand {
  constructor(
    private git: GitService,
    private file: FileService,
    private template: TemplateService
  ) {}

  async execute(options: CreateFeatureOptions): Promise<FeatureResult> {
    // Get next feature number
    const featureNum = await this.getNextFeatureNumber();

    // Create branch
    const branchName = this.generateBranchName(options.description, featureNum);
    await this.git.createBranch(branchName);

    // Create spec file from template
    const specPath = await this.createSpecFile(featureNum, options.template);

    return {
      branchName,
      specPath,
      featureNumber: featureNum
    };
  }
}
```

### Testing Strategy

```typescript
// packages/@spec-kit/scripts/tests/create-new-feature.test.ts
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { CreateFeatureCommand } from "../src/create-new-feature";

describe("CreateFeatureCommand", () => {
  let command: CreateFeatureCommand;
  let mockGit: any;
  let mockFile: any;

  beforeEach(() => {
    mockGit = {
      createBranch: mock(() => Promise.resolve())
    };
    mockFile = {
      createDirectory: mock(() => Promise.resolve()),
      writeFile: mock(() => Promise.resolve())
    };

    command = new CreateFeatureCommand(mockGit, mockFile, mockTemplate);
  });

  test("should create feature with correct branch name", async () => {
    const result = await command.execute({
      description: "Add user authentication"
    });

    expect(result.branchName).toBe("001-add-user-authentication");
    expect(mockGit.createBranch).toHaveBeenCalledWith("001-add-user-authentication");
  });

  test("should handle existing features correctly", async () => {
    // Mock existing features
    mockFile.listDirectories = mock(() => ["001-feature", "002-feature"]);

    const result = await command.execute({
      description: "New feature"
    });

    expect(result.featureNumber).toBe("003");
  });
});
```

### Package Structure

```typescript
// packages/@spec-kit/scripts/package.json
{
  "name": "@spec-kit/scripts",
  "version": "2.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./create-feature": {
      "import": "./dist/create-feature.js",
      "types": "./dist/create-feature.d.ts"
    },
    "./setup-plan": {
      "import": "./dist/setup-plan.js",
      "types": "./dist/setup-plan.d.ts"
    }
  },
  "scripts": {
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "build": "bun build ./src/index.ts --target=bun --outdir=./dist"
  },
  "dependencies": {
    "@spec-kit/core": "workspace:*",
    "simple-git": "^3.20.0"
  },
  "devDependencies": {
    "@types/bun": "^1.0.0"
  }
}
```

## 🎨 4. Command 및 Template 확장 및 수정 용이성

### Extensible Command System

```typescript
// packages/@spec-kit/cli/src/command-registry.ts
export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();

  register(command: CommandDefinition): void {
    this.commands.set(command.name, command);
  }

  async execute(name: string, args: any[]): Promise<void> {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }

    // Execute pre-hooks
    await this.hooks.execute(`before:${name}`, { args });

    // Execute command
    const result = await command.execute(args);

    // Execute post-hooks
    await this.hooks.execute(`after:${name}`, { args, result });
  }
}
```

### Template Engine

```typescript
// packages/@spec-kit/templates/src/engine.ts
export interface TemplateTransformer {
  name: string;
  transform(content: string, context: any): string;
}

export class TemplateEngine {
  private transformers: TemplateTransformer[] = [];
  private templates: Map<string, Template> = new Map();

  registerTransformer(transformer: TemplateTransformer): void {
    this.transformers.push(transformer);
  }

  async render(templateName: string, context: any): Promise<string> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    let content = await template.load();

    // Apply transformers
    for (const transformer of this.transformers) {
      content = await transformer.transform(content, context);
    }

    return content;
  }
}

// Built-in transformers
export class MustacheTransformer implements TemplateTransformer {
  name = "mustache";

  transform(content: string, context: any): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] || match;
    });
  }
}

export class MarkdownTransformer implements TemplateTransformer {
  name = "markdown";

  transform(content: string, context: any): string {
    // Process markdown-specific transformations
    return content;
  }
}
```

### Custom Command Example

```typescript
// plugins/custom-commands/src/index.ts
import { SpecKitPlugin, Command } from "@spec-kit/core";

export class CustomCommandsPlugin implements SpecKitPlugin {
  name = "custom-commands";
  version = "1.0.0";

  commands = [
    {
      name: "generate-api",
      description: "Generate API from spec",
      options: [
        { name: "--format", description: "Output format", default: "openapi" }
      ],
      execute: async (args) => {
        const spec = await this.loadSpec(args.spec);
        const api = await this.generateAPI(spec, args.format);
        await this.writeAPI(api, args.output);
      }
    }
  ];

  templates = [
    {
      name: "api-spec",
      path: "./templates/api-spec.md",
      transformers: ["mustache", "markdown"]
    }
  ];
}
```

## 📊 Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Bun monorepo structure
- [ ] Create core packages scaffold
- [ ] Implement basic plugin system
- [ ] Set up testing framework

### Phase 2: Migration (Week 3-4)
- [ ] Convert bash scripts to TypeScript
- [ ] Implement cross-platform path handling
- [ ] Create compatibility layer for existing projects
- [ ] Write comprehensive tests

### Phase 3: Enhancement (Week 5-6)
- [ ] Implement hook system
- [ ] Create template engine
- [ ] Build extensible command registry
- [ ] Add plugin marketplace support

### Phase 4: Polish (Week 7-8)
- [ ] Documentation and examples
- [ ] Performance optimization
- [ ] Migration guide for existing users
- [ ] Release preparation

## 🔄 Migration Strategy

### Backwards Compatibility

```typescript
// packages/@spec-kit/cli/src/legacy.ts
export class LegacyAdapter {
  async runBashScript(scriptPath: string, args: string[]): Promise<void> {
    // Detect and run legacy bash scripts
    if (await this.isLegacyProject()) {
      console.warn("Running in legacy mode. Consider upgrading to spec-kit 2.0");
      await Bun.spawn(["bash", scriptPath, ...args]);
    } else {
      // Use new TypeScript implementation
      await this.runModernCommand(scriptPath, args);
    }
  }
}
```

### Migration Tool

```bash
# Automated migration command
spec-kit migrate --from=1.x --to=2.0

# Features:
# - Convert bash scripts to TypeScript modules
# - Update configuration files
# - Install Bun if not present
# - Generate compatibility reports
```

## 📈 Benefits Summary

| Aspect | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| **Platforms** | 2 (bash/PS) | Universal | 100% coverage |
| **Test Coverage** | ~0% | >80% | Reliability ⬆️ |
| **Extension Points** | 0 | Unlimited | Full extensibility |
| **Type Safety** | None | Full | Zero runtime errors |
| **Performance** | Baseline | 3-5x faster | Bun optimization |
| **Maintenance** | High | Low | Single codebase |

## 🎯 Success Criteria

1. **Cross-Platform**: Works identically on Windows, macOS, Linux
2. **Testable**: >80% code coverage with automated tests
3. **Extensible**: Support for 3rd party plugins
4. **Fast**: <100ms command execution time
5. **Type-Safe**: Zero TypeScript errors
6. **Compatible**: Existing projects continue to work

## 📚 References

- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Commander.js](https://github.com/tj/commander.js)
- [Plugin Architecture Patterns](https://www.patterns.dev/posts/plugin-pattern)

## 🤝 Call for Feedback

This RFC proposes significant changes to spec-kit. We welcome community feedback on:

1. Migration concerns for existing projects
2. Additional plugin ideas
3. Performance requirements
4. API design preferences

Please comment with your thoughts, concerns, and suggestions!

---

**Labels**: `enhancement`, `architecture`, `rfc`, `breaking-change`
**Milestone**: v2.0.0
**Assignees**: @maintainers