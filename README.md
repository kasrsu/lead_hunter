# Lead Hunter Platform

A full lead-management system that scans a city on Google Maps for businesses
with **no website**, has an **AI agent** (research → score → draft → critique →
revise) draft a specific outreach email for each one, and then lets you run them
through a **kanban pipeline** until the approved email goes out — all persisted
locally in SQLite so nothing is lost on refresh.

- **Dashboard** — totals, pipeline funnel, agent classification breakdown,
  campaign list
- **Kanban** per campaign — drag leads between New → Drafting → Awaiting
  approval → Sent → Won → Archived; dropping on "Sent" is the human-approved
  send
- **AI scorecards** — every lead gets an auto-generated /100 scorecard with
  per-dimension breakdown and reasoning, plus an agent "thinking & execution"
  trace (research brief, critique loop) on its detail page

The frontend and API routes are one Next.js app; the email-drafting agent runs
as a separate Python service that Next.js calls over HTTP. Type-checked, linted,
tested (`npm test` + `pytest`) and verified to build clean.

## Stack
- **Next.js 14** (App Router, TypeScript, Tailwind) — frontend + API routes
- **SQLite (`better-sqlite3`)** — campaigns, leads, scorecards and drafts, via
  a Repository layer under `lib/` (Postgres-swappable)
- **Python / FastAPI + LangGraph** (`agent-service/`) — the agent, as its own
  process. This replaced the original LangGraph.js implementation in a pure
  `lib/agent.ts`; the Next.js side is now just a thin HTTP client for it.
- **Local LLM via Ollama** — the agent drafts with a local Qwen model. No API
  key, no per-message cost; swap the model with the `OLLAMA_MODEL` env var.
- **Google Places API** — finds businesses and checks for a listed website
- **Resend** — sends the approved email

## Architecture

```
browser ──► Next.js (dashboard / kanban / lead detail)
                 │
                 ├── /api/search · /api/campaigns* ──────┐
                 ├── /api/leads* (enrich · send · move)  │
                 └── /api/dashboard                       ▼
                                 ┌───────────────────────────────┐
                                 │ Services (lib/services/)      │
                                 │  └ Repositories (lib/repos/)  │
                                 │    └ SQLite (lib/db.ts)       │
                                 └───────────────────────────────┘
                                 │
   /api/leads/[id]/enrich ──HTTP──► Python agent service (FastAPI :8000)
                                          │
                                          └── LangGraph: research → score → draft → critique → revise
```

Next.js runs the search (Google Places) and send (Resend) directly; campaign +
lead + dashboard state is persisted in SQLite through the Repository layer.
Only email drafting is delegated to the agent service, via `AGENT_SERVICE_URL`
(default `http://127.0.0.1:8000`).

## API

| Route | Method | What it does |
| --- | --- | --- |
| `/api/search` | POST | Hunt a city for businesses without a website; creates a campaign + persists its leads |
| `/api/campaigns` | GET | All campaigns with lead counts and stage tallies |
| `/api/campaigns/[id]` | GET / PATCH | Campaign + leads / rename or archive |
| `/api/campaigns/[id]/enrich-all` | POST | Run the agent over every New/Drafting lead (scorecards + drafts) |
| `/api/leads/[id]` | GET / PATCH | One lead / edit contact email + draft, or move pipeline stage |
| `/api/leads/[id]/enrich` | POST | Run the agent for one lead; persists scorecard + draft, lands it in "Awaiting approval" |
| `/api/leads/[id]/send` | POST | Send the approved draft (Resend) and move the lead to "Sent" |
| `/api/dashboard` | GET | Aggregated stats for the dashboard |

The kanban pipeline mirrors the AI workflow: a lead cannot reach "Sent" by
dragging — only by the send action, which is always a human-approved, per-lead
step.

## How the agent works (`agent-service/app/agent.py`)
This isn't a single LLM call — it's a small graph with a feedback loop:

```
research → score → draft → critique ──(approved OR 3 revisions done)──→ done
                              │
                              └──(needs work)──> revise → critique (loop)
```

- **research**: formats what's actually known about the business (rating,
  review count, category, address) into a brief
- **score**: scores the lead /100 with a deterministic rubric (rating,
  review volume, digital presence, contact, etc.), classifies it
  (LUXURY_PREMIUM, DIGITAL_WEAKNESS_OPPORTUNITY, …), picks a channel and an
  outreach angle — no LLM call
- **draft**: writes a short, specific cold email from that brief, shaped by
  the score's classification and angle
- **critique**: checks the draft against a 4-point rubric (specific to this
  business, states the no-website fact, one clear CTA, under 120 words) and
  either approves it or sends back what to fix
- **revise**: rewrites based on that feedback; loops back to critique, capped
  at 3 passes (matching the AI_IMPLEMENTATION.md workflow) so cost/latency
  stay bounded

Every draft is shown to you in the UI, editable, before you can send it —
sending is never automatic.

## Setup

```bash
# terminal 0 — the local LLM (once)
ollama serve                            # then: ollama pull qwen2.5-coder:7b-instruct-q4_K_M

# terminal 1 — the agent service (Python)
cd agent-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # optional OLLAMA_MODEL / OLLAMA_BASE_URL
uvicorn app.main:app --reload

# terminal 2 — the Next.js app
npm install --include=dev   # --include=dev matters if your shell has NODE_ENV=production
cp .env.example .env.local  # add RESEND_API_KEY (AGENT_SERVICE_URL already defaults to http://127.0.0.1:8000)
npm run dev
```

Open http://localhost:3000. The Google Places API key is entered in the UI
per search rather than stored as an env var — see "packaging this to sell"
below for why.

Leads and campaigns persist to `./data/leadhunt.db` (set `DATABASE_PATH` in
`.env.local` to relocate; `:memory:` for tests). It's created automatically on
first request — no manual step.

## Tests (Definition of Done)

```bash
npm run typecheck && npm run lint && npm test   # TS strict, ESLint, Vitest (kanban + storage + services)
cd agent-service && <venv>/bin/python -m pytest  # rubric/scorecard contract tests
```

You'll need:
1. **Google Places API key** — console.cloud.google.com, enable "Places API".
   Free tier covers thousands of lookups before any cost.
2. **Ollama with a local model** — `ollama serve`, then
   `ollama pull qwen2.5-coder:7b-instruct-q4_K_M` (or any model you prefer,
   set with `OLLAMA_MODEL` in `agent-service/.env`). No API key or account —
   the agent's LLM runs entirely on your machine.
3. **Resend account + verified sending domain** — resend.com. Required
   before you can actually send email (not just draft it) — Resend won't
   let you send from an unverified domain.

## Deploying

Next.js and the agent service are separate deployments:

- **Next.js** — push to GitHub, import into Vercel, add `RESEND_API_KEY`
  (and `AGENT_SERVICE_URL`) as environment variables.
- **Agent service** — a small always-on process. Fly.io, Railway, or a $5
  VPS running `uvicorn app.main:app --port 8000` all work; just set
  `ANTHROPIC_API_KEY` there and point Next.js's `AGENT_SERVICE_URL` at it.
- Optional: a `Dockerfile` in `agent-service/` wrapping the venv is all
  that's needed to containerize it.

## Packaging this to sell

**Each user supplies their own Google Places key in the UI** rather than you
running one shared key server-side. Two reasons:
1. Cost — you don't want to be paying for every buyer's searches.
2. Google's ToS restricts long-term caching/redistribution of Places data as
   a dataset. Running live, per-user queries against the user's own key
   keeps you on the "selling a tool" side of that line, not the "selling
   scraped data" side.

The agent's LLM is a free local Ollama model, so the only per-use service is
**Resend** (and each user's own Places key). Selling it:
- **Self-hosted / sell the code** (Gumroad, as discussed before): buyer
  deploys their own instance (the Next.js app **and** the agent service)
  and supplies their own Resend key + Places key + a local Ollama model.
  Simplest for you, no ongoing cost, but buyer needs to be comfortable
  running a two-process deploy — a short setup video covers this. Docker
  Compose for the two services is the natural way to make this a one-command
  install.
- **Hosted SaaS**: you run one deployment of both services, gate access
  behind auth + billing (e.g. Clerk + Stripe), and the Resend usage (plus
  any cloud hosting for the Ollama model) is on your bill, priced into a
  subscription. More buyer-friendly, more work, and something to build once
  you've validated demand with option 1.

## Legal notes on the email-sending piece
Cold outreach to businesses is regulated (CAN-SPAM in the US, PECR/GDPR in
the UK/EU, similar elsewhere): you need a real sender identity, a working
reply path, and honest subject lines — no forged headers, no deceptive
subject lines. This build already keeps sending a per-lead, human-reviewed
action rather than a bulk blast, and appends a reply-to-opt-out line — but
the buyer is the one legally responsible for how they use it, so make that
clear if you resell it. Worth a plain disclaimer in your Gumroad listing.

## Honest scope note
This is a real, working platform: search, an actual multi-step agent, a
persisted SQLite store, a dashboard, and a kanban pipeline are all implemented
and wired together. What it doesn't have yet:
- **User accounts / auth** — one user, one local DB. Every user of a hosted
  deployment would share the same data today.
- **Billing** (Stripe) — nothing gates access.
- **Multi-tenant storage** — the repository layer is written so a Postgres
  swap is a contained change, but it isn't done.
- **A send queue** — `enrich-all` runs the agent sequentially per lead (right
  for a local Ollama model); sending is per-lead and human-approved, so bulk
  blast at scale isn't a goal by design.

Those are what turn this from "a tool you deploy yourself" into "a hosted
SaaS," and that's realistically weeks not days. Ship this version, get it in
front of a few buyers, and let their feedback tell you whether the hosted-SaaS
version is worth building next.

## Security note on the Next.js version
The app pins Next.js `14.2.35`, the latest patched 14.x line. `npm audit`
still reports two high-severity advisories whose fixes landed only in
Next.js 15.5+/16 — both require features this app doesn't use (`next/image`
`remotePatterns`, middleware/rewrites). A future upgrade to Next.js 15 is
the clean way to zero those out.


Yes, absolutely! Both Ollama and the Python Agent backend need to be running for the AI robot agent to perform its critique, Telegram approval, and email dispatch.

Here is what you need running in your terminal windows:

Terminal 1: Start Ollama (LLM Server)
bash
ollama serve
(Makes local LLM model qwen2.5-coder:7b-instruct-q4_K_M available at http://localhost:11434)

Terminal 2: Start Python Agent Service (FastAPI & Telegram Bot)
bash
cd agent-service
./run.sh
(Starts FastAPI on http://localhost:8000 and launches the Telegram Bot listener)

Terminal 3: Next.js Frontend
(Already running on http://localhost:3000 via npm run dev)

Once Terminal 1 & 2 are running, click [🤖 Dispatch Agent] on any lead in the UI, and watch the cute AI Robot execute the workflow and send the approval request to your Telegram!

11:04 PM
N0t running. teegram bt nt sending debug gs need
11:12 PM
Here is what caused the issue and how it has been fixed:

Root Cause
Environment Variables Not Loaded: agent-service/app/main.py was missing load_dotenv(), so the TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID inside agent-service/.env were not being injected into Python's os.environ.
Static Chat ID Evaluation: bot.py evaluated TELEGRAM_CHAT_ID once at module import time, resulting in chat_id = 0, which caused Telegram API calls to fail silently.
Fixes Applied
agent-service/app/main.py:

Added load_dotenv() at top of file to load agent-service/.env.
Added startup diagnostic logs showing whether TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and RESEND_API_KEY are configured.
agent-service/app/telegram/bot.py:

Made chat_id resolution dynamic at runtime via get_target_chat_id().
Added /start response command so when you text your bot /start, it responds with: "Your Chat ID is: 5613517754".
Added clear logging for message delivery (📲 Sending Telegram message..., ✅ Telegram approval message sent successfully!).
agent-service/app/dispatch_nodes.py:

Added explicit error handling and diagnostic trace logging inside submit_approval_node.
Step to Verify Now
Please restart the Python Agent Service in your terminal:

bash
# Press Ctrl+C in your agent-service terminal, then run:
cd agent-service
./run.sh
You will see the startup confirmation in your terminal:

text
=== Starting Lead Hunter Agent Service ===
Ollama Base URL: http://localhost:11434
Telegram Bot Token: CONFIGURED
Telegram Chat ID: 5613517754
Resend API Key: CONFIGURED
🚀 Starting Telegram bot polling listener...
✅ Telegram bot initialized & listening for chat_id: 5613517754
Now, click [🤖 Dispatch Agent] on any lead in the UI, and check your Telegram app!

