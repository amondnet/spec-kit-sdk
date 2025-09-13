# Spec-Kit SDK Constitution

## Core Principles

### Article I: Library-First Development
Every feature MUST start as a standalone library before integration:
- Libraries must be self-contained with clear boundaries
- Each library requires independent tests and documentation (llms.txt)
- No organizational-only libraries - clear purpose required
- Library contracts define interface before implementation

### Article II: CLI Interface Protocol
Every library MUST expose functionality via CLI:
- Text in/out protocol: stdin/args → stdout, errors → stderr
- Support both JSON (--json flag) and human-readable formats
- CLI serves as the universal integration point
- All operations must be scriptable and composable

### Article III: Test-First Development (NON-NEGOTIABLE)
TDD is MANDATORY for all development:
1. Tests written first
2. User approves test specifications
3. Tests must fail initially (Red)
4. Implementation to pass tests (Green)
5. Refactor with passing tests (Refactor)
- No implementation without failing tests first
- Test approval gates required before coding

### Article IV: Integration Testing Requirements
Integration tests required for:
- New library contract implementations
- Contract changes or version updates
- Inter-service/cross-library communication
- Shared schemas and data structures
- Real dependencies used in integration (no mocks)
- Cross-platform compatibility verification

### Article V: Observability & Debugging
All components must be observable:
- Text I/O ensures debuggability at every layer
- Structured logging required (no console.log)
- Multi-tier log streaming support
- Performance monitoring hooks
- Error tracking with correlation IDs

### Article VI: Versioning & Breaking Changes
Strict versioning protocol:
- Semantic versioning: MAJOR.MINOR.PATCH
- Breaking changes require major version bump
- Migration guides for all breaking changes
- Deprecation warnings before removal
- Changelog maintenance required

### Article VII: Simplicity & YAGNI
Maintain radical simplicity:
- Start simple, iterate based on real needs
- YAGNI (You Aren't Gonna Need It) strictly enforced
- No premature abstraction or optimization
- Maximum 3 levels of abstraction
- Prefer explicit over implicit behavior

## Development Constraints

### Technology Stack
- **Runtime**: Bun (v1.2.20+) for TypeScript execution
- **Build System**: Turborepo for monorepo management
- **Language**: TypeScript with ES modules
- **Testing**: Bun test runner with contract/unit/integration separation
- **Git Operations**: simple-git for programmatic access

### Code Quality Standards
- File size ≤ 300 LOC
- Function size ≤ 50 LOC
- Parameters ≤ 5 per function
- Cyclomatic complexity ≤ 10
- Test coverage ≥ 80%

### Security Requirements
- No secrets in code/logs/commits
- Input validation on all boundaries
- Parameterized operations only
- Principle of least privilege

## Development Workflow

### Spec-Driven Development Process
1. **Specification**: Natural language → formal spec via `/specify`
2. **Planning**: Spec → implementation plan via `/plan`
3. **Task Generation**: Plan → actionable tasks via `/tasks`
4. **Implementation**: TDD cycle for each task
5. **Integration**: Contract verification and cross-platform testing

### Quality Gates
- All tests must pass before merge
- Type checking must succeed (turbo check-types)
- Linting must pass (turbo lint)
- Contract tests verify library interfaces
- Integration tests confirm cross-platform compatibility

### Review Requirements
- Constitution compliance check
- Test coverage verification
- Breaking change assessment
- Documentation completeness
- Performance impact analysis

## Governance

- Constitution supersedes all project practices
- Amendments require:
  - Documentation of rationale
  - Impact assessment on existing code
  - Migration plan for breaking changes
  - Team consensus approval
- All PRs must verify constitutional compliance
- Complexity increases must be justified with clear rationale
- Use CLAUDE.md and STANDARDS.md for runtime development guidance
- Regular constitution audits to ensure relevance

**Version**: 3.0.0 | **Ratified**: 2025-09-13 | **Last Amended**: 2025-09-13