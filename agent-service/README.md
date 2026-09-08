# Lead Hunter Agent Service

The email-drafting agent, as a standalone Python service.

Next.js no longer calls the LLM itself — `app/api/enrich` proxies a lead + the
sender profile here, and this service returns a scored, drafted (and
self-reviewed) outreach email. The LLM is a local Ollama model; the score is a
deterministic rubric (no LLM). The agent is a LangGraph state graph:

```
research -> score -> draft -> critique ──(approved OR 3 revisions done)──> done
                              │
                              └──(needs work)──> revise -> critique (loop)
```

## Run

The agent talks to a **local Ollama model** — no API key required. Start
Ollama first (`ollama serve`; `ollama pull qwen2.5-coder:7b-instruct-q4_K_M`
if the model isn't pulled). Use any Python 3.12 venv — this machine has the
shared `vz_rag` venv at `/home/kasr/Storage/Study_Dir/venvs/vz_rag`
(already ships fastapi, uvicorn, langgraph). `run.sh` finds it automatically:

```bash
cd agent-service
/home/kasr/Storage/Study_Dir/venvs/vz_rag/bin/pip install -r requirements.txt
cp .env.example .env        # optionally set OLLAMA_MODEL / OLLAMA_BASE_URL
./run.sh                    # or: /home/kasr/Storage/Study_Dir/venvs/vz_rag/bin/uvicorn app.main:app --reload
```

Or, with any other venv:

```bash
cd agent-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Service listens on http://127.0.0.1:8000 — that's what Next.js expects via
`AGENT_SERVICE_URL` (the default in `lib/agent.ts`). Smoke test:
`curl http://127.0.0.1:8000/health`.

## Tests

The scoring rubric is a pure function with no LLM dependency, so it's unit
tested without Ollama running:

```bash
<venv>/bin/python -m pytest   # agent-service/tests/test_scoring.py
```

## API

- `GET /health` — liveness probe
- `POST /enrich` — `{ "lead": {...}, "sender": {...} }` → `{ "lead": { ...enriched } }`

The request/response shape mirrors the old TypeScript `enrichLead` signature
exactly, so the Next.js side just swapped the LangGraph.js call for an HTTP
call without touching the UI.
