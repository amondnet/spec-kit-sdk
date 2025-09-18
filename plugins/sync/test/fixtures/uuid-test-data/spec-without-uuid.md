---
title: Feature Without UUID
sync_status: draft
issue_type: parent
auto_sync: true
github:
  issue_number: 123
  labels:
    - feature
    - enhancement
  assignees:
    - developer1
---

# Feature Without UUID

This is a test spec that was created before UUID support was added to the system.

## Overview

This feature demonstrates the migration path for existing specs that only have issue numbers but no UUID identifiers.

## Requirements

- **REQ-001**: System must generate UUID for specs without one
- **REQ-002**: System must preserve existing metadata
- **REQ-003**: System must persist UUID to disk immediately

## Implementation Notes

The scanner should automatically detect specs without UUIDs and generate them during the scanning process.

## Testing Scenarios

1. **Migration Test**: Verify UUID is generated and persisted
2. **Preservation Test**: Ensure existing frontmatter is maintained
3. **Consistency Test**: UUID should remain stable across scans
