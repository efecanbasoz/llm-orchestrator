# Security & Code Quality Review Findings

**Date**: 2026-03-21
**Reviewers**: Codex CLI (GPT-5.4, read-only sandbox) + Claude Opus 4.6
**Scope**: Full codebase (src/, 3 files, ~253 LOC)

## Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| HIGH | 4 | 4 |
| MEDIUM | 7 | 6 |
| LOW | 4 | 2 |
| **Total** | **15** | **12** |

## Fixed

### Security
- **SEC-001/002 (HIGH)**: Subprocess isolation — both CLIs now run in temp cwd with safe env
- **SEC-003 (HIGH)**: Env leakage — allowlist-based env filtering for child processes
- **SEC-005 (MEDIUM)**: Input size limits — Zod max() on all string inputs
- **SEC-006 (MEDIUM)**: Timeout amplification — skip retry on timeout/abort
- **SEC-007 (LOW)**: Generic error messages to avoid internal info disclosure
- **SEC-008 (LOW)**: Fixed codex_review openWorldHint to true

### Quality
- **QA-001 (HIGH)**: Input size limits (prompt: 20k, code: 200k, context: 5k, language: ISO 639-1)
- **QA-002 (HIGH)**: Output size cap (2MB) with abort on exceed
- **QA-003 (HIGH)**: Startup failure now sets process.exitCode = 1
- **QA-005 (MEDIUM)**: Gemini JSON parse with Zod validation instead of any
- **QA-009 (MEDIUM)**: Codex prompt uses XML tags instead of backtick fences
- **QA-004 (MEDIUM)**: Named constants for timeout and retry delay

## Deferred
- SEC-004: Gemini prompt via argv (requires SDK migration, not CLI)
- QA-006, QA-007: Silent catch blocks, module-level side effects (refactoring scope)
- QA-008: Handler deduplication (low priority, only 2 tools)
- QA-010, QA-011: Missing tests (separate effort)
- QA-012: NVM path sorting (acceptable as-is)
