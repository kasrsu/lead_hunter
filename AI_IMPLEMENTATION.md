# AI_IMPLEMENTATION.md

## AI Coding Agent Rules

This repository is designed to be developed by AI coding agents.

### Primary LLM
- **Always use Ollama running locally.**
- **Default model: `qwen` (latest available, e.g. qwen3).**
- Never call cloud LLM APIs unless explicitly requested.
- Assume Ollama is available at `http://localhost:11434`.

Example:
```bash
ollama serve
ollama pull qwen3
```

Use the local Ollama endpoint for every AI task.

## Principles
- Build production-quality code.
- Think before coding.
- Reuse existing code.
- No duplicate business logic.
- Small, modular files.
- Strong typing.
- Tests for new features.
- Never hardcode secrets.
- Environment variables only.

## Architecture
API → Services → Repositories → Storage

Business logic belongs in services.
AI orchestration belongs in `agents/`.

## AI Workflow
Research → Draft → Critique → Revise (max 3) → Human Approval → Send

## Definition of Done
- Builds successfully
- Lint passes
- Tests pass
- No TODOs
- Documented
- Production ready
