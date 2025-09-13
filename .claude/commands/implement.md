Execute and manage implementation of tasks from tasks.md.

This is the fourth step in the Spec-Driven Development lifecycle.

Given the context provided as an argument, do this:

## 1. INITIALIZATION
1. Run `scripts/check-task-prerequisites.sh --json` to get FEATURE_DIR
2. Load FEATURE_DIR/tasks.md and parse:
   - Task IDs (T001, T002, etc.)
   - Task descriptions
   - Task status (if already marked)
   - Parallel execution markers [P]
3. Use TodoWrite to create/update internal task tracking with statuses:
   - pending: Not started
   - in_progress: Currently working
   - completed: Successfully finished
   - blocked: Has unresolved issues

## 2. TASK EXECUTION STRATEGY
1. **Identify current state**:
   - Check for existing progress markers in tasks.md
   - Skip completed tasks (marked ✅)
   - Resume from last in_progress task (marked 🔄)
   - Start with first pending task if fresh start

2. **Execution order**:
   - Always complete Setup tasks first (T001-T00X)
   - Execute test tasks before implementation (TDD approach)
   - Group parallel tasks [P] for batch execution
   - Respect dependency chains

3. **For each task**:
   - Update tasks.md with 🔄 (in progress)
   - Use TodoWrite to mark as in_progress
   - Execute the task using appropriate tools
   - Run verification (tests/build) after each task
   - Update tasks.md with ✅ (completed) or ❌ (blocked)
   - Update TodoWrite status accordingly

## 3. PARALLEL EXECUTION
When encountering tasks marked [P]:
1. Collect all consecutive [P] tasks
2. Use Task agent with multiple concurrent executions:
    ```
    Task(subagent_type="general-purpose", prompt="Implement [specific task]",model: "")
    ```
3. Wait for all parallel tasks to complete
4. Update all statuses together

## 4. PROGRESS TRACKING
After each task or batch:
1. Update FEATURE_DIR/tasks.md with status markers:
   - ✅ = Completed successfully
   - 🔄 = Currently in progress
   - ❌ = Blocked/failed (add error note)
   - ⏸️ = Paused (for resumption later)
   - (blank) = Pending

2. Add timestamp and brief result after each task:
    ```
    T001: ✅ Project setup - [2025-01-08 10:15] Dependencies installed
    T002: 🔄 Create test suite - [2025-01-08 10:20] Working...
    ```


## 5. VERIFICATION POINTS
After completing each logical group:
1. Run test suite: `swift test` or project-specific test command
2. Build project: Use XcodeBuildMCP for iOS or appropriate build tool
3. If failures occur:
   - Mark task as ❌ with error details
   - Create new task for fixing the issue
   - Continue with non-dependent tasks if possible

## 6. RESUMPTION HANDLING
When resuming work (context includes partial progress):
1. Re-read tasks.md to identify current state
2. Find tasks marked 🔄 (in progress) or ⏸️ (paused)
3. Assess what was partially completed
4. Continue from that point
5. Re-run verification for completed work if needed

## 7. COMPLETION CRITERIA
Work is complete when:
  - All tasks show ✅ (completed) or documented ❌ (blocked with explanation)
  - Full test suite passes
  - Build succeeds without errors
  - Optional: Run on device/simulator for iOS projects

## 8. ERROR RECOVERY
If a task fails:
1. Document the error in tasks.md next to the task
2. Attempt basic fixes (missing imports, typos)
3. If unresolvable:
   - Mark as ❌ with clear explanation
   - Create follow-up task if needed
   - Continue with non-dependent tasks
   - Report blocked tasks at end

## 9. FINAL REPORT
Upon completion or pause, provide:
- Summary of completed tasks (count)
- List of blocked tasks with reasons
- Next steps or remaining work
- Command to resume if paused

## EXAMPLE EXECUTION FLOW
1. Read tasks.md → Find T001-T003 pending
2. Execute T001 (setup) → Update to ✅
3. See T002-T003 marked [P] → Execute in parallel
4. Both complete → Update both to ✅
5. Execute T004 → Fails with error
6. Mark T004 as ❌ with error note
7. Skip dependent T005, execute independent T006 
8. Save progress and report status


Context for implementation: $ARGUMENTS

Remember: The goal is efficient, trackable, resumable task execution with clear progress visibility.
