# Architecture Specification: Lead Hunter Platform

## 1. System Overview

**Lead Hunter Platform** is a full-stack, local-first lead discovery, intelligence, and email outreach platform designed to identify local businesses operating without a listed website on Google Maps, generate AI-tailored outreach emails using a multi-pass critique agent, and manage leads through a Kanban sales pipeline until human-approved email delivery.

### Tech Stack Matrix

| Layer | Technology | Key Details |
| --- | --- | --- |
| **Frontend & API Host** | Next.js 14 (App Router) | TypeScript, Tailwind CSS, Lucide Icons, Client-side Kanban state |
| **Database** | SQLite (`better-sqlite3`) | Single WAL-mode file database (`./data/leadhunt.db`) with Repository Pattern |
| **AI Agent Microservice** | Python 3.10+ / FastAPI | LangGraph state machine (`agent-service/app/agent.py`) |
| **Local LLM Engine** | Ollama | Runs locally (`http://localhost:11434`), default model `qwen2.5-coder:7b-instruct-q4_K_M` |
| **External APIs** | Google Places API, Resend | Places API for lead discovery; Resend for transactional email sending |

---

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    User([User / Browser])
    
    subgraph Web App [Next.js 14 Application :3000]
        UI[UI Layer / Kanban / Dashboard]
        API[Next.js API Routes /api/*]
        Services[Services Layer lib/services/]
        Repos[Repositories Layer lib/repos/]
        DB_Driver[better-sqlite3 Driver]
    end

    subgraph Data Store [Local File Storage]
        SQLite[(SQLite DB: ./data/leadhunt.db)]
    end

    subgraph AI Service [Python Agent Microservice :8000]
        FastAPI[FastAPI Server app/main.py]
        LangGraph[LangGraph Workflow app/agent.py]
        Scorer[Deterministic Scorer app/scoring.py]
    end

    subgraph Local LLM [Ollama Engine :11434]
        Ollama[Local Model: Qwen 2.5]
    end

    subgraph External Services [Cloud APIs]
        GooglePlaces[Google Places API]
        Resend[Resend Email API]
    end

    User <-->|HTTP / React| UI
    UI <-->|Fetch / API| API
    API --> Services
    Services --> Repos
    Repos --> DB_Driver
    DB_Driver <--> SQLite

    API -->|Google Places Search| GooglePlaces
    API -->|Send Approved Email| Resend
    API <-->|Enrich Lead HTTP POST :8000| FastAPI

    FastAPI --> LangGraph
    LangGraph --> Scorer
    LangGraph <-->|HTTP POST :11434| Ollama
```

---

## 3. Layered Architecture (Next.js Application)

The Next.js backend strictly follows a layered Clean Architecture pattern (`API → Services → Repositories → Storage`):

```
┌─────────────────────────────────────────────────────────────┐
│                 API Layer (app/api/*)                       │
│ Handles HTTP requests, parses payloads, maps errors         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│             Service Layer (lib/services/*)                  │
│ Business logic, domain rules, API orchestrations             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│          Repository Layer (lib/repositories/*)              │
│ Abstract data access, interfaces (LeadRepo, CampaignRepo)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│             Storage Layer (lib/db.ts)                       │
│ Singleton SQLite better-sqlite3 instance with WAL mode      │
└─────────────────────────────────────────────────────────────┘
```

### Modular Components & Responsibilities

- **`lib/db.ts`**: Handles lazy initialization of the SQLite database connection (`./data/leadhunt.db`), enables `WAL` mode and `foreign_keys = ON`, and performs automated schema migrations.
- **`lib/repositories/campaigns.ts` & `leads.ts`**: Provide typed SQL access functions. Hides database-specific SQL queries behind domain repository interfaces, allowing seamless swapping to PostgreSQL.
- **`lib/services/`**:
  - `campaignService.ts`: Business logic for retrieving and modifying campaign state.
  - `leadService.ts`: Operations on leads, pipeline stage transitions, and trigger handlers.
  - `dashboardService.ts`: Aggregates lead counts, score distributions, priority tiers, and conversion rates.
  - `scoringEngine.ts`: Client-side fallback scoring helpers.
- **`lib/agent.ts`**: HTTP client bridge calling the Python FastAPI agent service (`http://127.0.0.1:8000/enrich`).
- **`lib/places.ts`**: Calls Google Places API text/nearby search, extracts business metadata, and filters out businesses that already have a listed website.
- **`lib/email.ts`**: Resend API integration for sending approved cold outreach emails.

---

## 4. AI Agent Microservice Architecture (`agent-service/`)

The email drafting process is delegated to an isolated Python microservice built with **FastAPI** and **LangGraph**.

### LangGraph State Machine

```mermaid
stateDiagram-v2
    [*] --> ResearchNode: Input Lead & Sender Profile
    ResearchNode --> ScoreNode: Research Brief Created
    ScoreNode --> DraftNode: 100-pt Score & Angle Selected
    DraftNode --> CritiqueNode: Initial Email Drafted
    
    state CritiqueNode <<choice>>
    CritiqueNode --> ReviseNode: Rejected (Critique Failed & Iterations < 3)
    CritiqueNode --> Approved: Approved OR Max Iterations Reached (3)
    
    ReviseNode --> CritiqueNode: Revised Email Drafted
    Approved --> [*]: Return Enriched Lead Data
```

### Graph Nodes Explained

1. **`research_node`**: Compiles business name, category, rating, review count, and missing website status into a standardized research brief.
2. **`score_node`**: Executes a deterministic, 100-point rubric in `app/scoring.py` (0-LLM token usage):
   - **Metrics evaluated**: Rating quality (20 pts), Review volume (15 pts), Premium positioning (15 pts), Digital presence (15 pts), Contact availability (10 pts), Brand strength (10 pts), Market opportunity (10 pts), Weakness exposure (5 pts), Ease of closing (5 pts).
   - **Buyer Persona Classifications**: `LUXURY_PREMIUM`, `DIGITAL_WEAKNESS_OPPORTUNITY`, `HIGH_POTENTIAL_GROWTH`, `REPUTATION_RISK`, `COMPETITOR_PRESSURE_TARGET`, `GENERAL_OUTREACH`.
   - **Outreach Angle Selection**: Selects a tailored narrative template (`luxury_pitch`, `social_media_weakness_pitch`, etc.).
3. **`draft_node`**: Calls the local Ollama LLM (`/api/chat`) to write a short (<120 words), hyper-specific cold email.
4. **`critique_node`**: Evaluates the drafted email against a 4-point rubric (references true business data, states missing website, clear CTA, <120 words).
5. **`revise_node`**: If critique fails, rewrites the email addressing specific feedback. Loops back to `critique_node` with an **iteration cap of 3**, ensuring bounded execution time and zero runaway token loops.

---

## 5. System Workflows & Data Flows

### A. Lead Search & Discovery Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant NextJS as Next.js API (/api/search)
    participant Places as Google Places API
    participant Repos as Campaign & Lead Repos
    participant DB as SQLite DB

    User->>NextJS: POST /api/search { keyword, location, apiKey }
    NextJS->>Places: Query Places API (Find businesses)
    Places-->>NextJS: Business Results
    NextJS->>NextJS: Filter out businesses WITH websites
    NextJS->>Repos: Create Campaign & Batch Insert Leads
    Repos->>DB: INSERT INTO campaigns & leads
    NextJS-->>User: Return Campaign with Un-enriched Leads
```

### B. AI Enrichment & Drafting Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant NextJS as Next.js API (/api/leads/[id]/enrich)
    participant AgentPy as FastAPI Service (:8000)
    participant Ollama as Ollama Engine (:11434)
    participant Repos as Lead Repository
    participant DB as SQLite DB

    User->>NextJS: POST /api/leads/[id]/enrich
    NextJS->>AgentPy: HTTP POST /enrich { lead, sender }
    AgentPy->>AgentPy: Research + Deterministic Score
    loop Up to 3 iterations
        AgentPy->>Ollama: POST /api/chat (Draft / Revise)
        Ollama-->>AgentPy: Draft Completion
        AgentPy->>AgentPy: Critique Rubric Evaluation
    end
    AgentPy-->>NextJS: Return Enriched Data (Brief, Score, Draft, Trace)
    NextJS->>Repos: Update Lead (pipeline_stage = 'ready')
    Repos->>DB: UPDATE leads SET stage='ready', score=...
    NextJS-->>User: Return Updated Lead (Ready for Human Approval)
```

### C. Human-in-the-Loop Send Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant NextJS as Next.js API (/api/leads/[id]/send)
    participant Resend as Resend Email API
    participant Repos as Lead Repository
    participant DB as SQLite DB

    User->>NextJS: POST /api/leads/[id]/send { subject, body, toEmail }
    NextJS->>Resend: Send Email via Verified Domain
    Resend-->>NextJS: Email Sent Confirmation
    NextJS->>Repos: Update Stage to 'sent' & Record sent_at
    Repos->>DB: UPDATE leads SET pipeline_stage='sent', sent_at=NOW()
    NextJS-->>User: Pipeline Updated
```

---

## 6. Database Schema & Data Model

The database relies on two primary entities: **`campaigns`** and **`leads`**.

```mermaid
erDiagram
    CAMPAIGNS ||--o{ LEADS : owns
    
    CAMPAIGNS {
        string id PK
        string name
        string keyword
        string location
        real min_rating
        integer min_reviews
        string status
        datetime created_at
    }

    LEADS {
        string id PK
        string campaign_id FK
        string place_id
        string name
        string address
        string phone
        real rating
        integer reviews
        string maps_url
        string category
        string website
        integer has_website
        string contact_email
        string pipeline_stage
        integer lead_score
        integer opportunity_score
        integer reachability_score
        integer completeness_score
        integer engagement_score
        string priority_tier
        string classification
        string channel
        string template_type
        string rubric_scores
        string rubric_justification
        string reasoning_summary
        string research_brief
        string email_subject
        string email_body
        string review_notes
        integer iterations
        datetime sent_at
        datetime created_at
        datetime updated_at
    }
```

### Pipeline Lifecycle Stages (`pipeline_stage`)
- **`new`**: Newly discovered business without a website.
- **`drafting`**: AI enrichment in progress.
- **`ready`**: AI scorecard and email draft generated; awaiting human approval.
- **`sent`**: Email sent via Resend API.
- **`won`**: Client converted / deal closed.
- **`archived`**: Lead hidden or marked irrelevant.

---

## 7. Key Architecture Guarantees & Security

1. **Human-in-the-Loop Safeguard**: AI agents draft emails but **never send emails automatically**. Dragging a lead to "Sent" or clicking Send requires explicit human confirmation.
2. **Zero Cloud LLM API Cost**: LLM generation runs completely locally via Ollama (`http://localhost:11434`), eliminating API token expenses.
3. **Database Portability**: Repositories operate on domain interfaces. Swapping SQLite for PostgreSQL only requires creating a `PostgresLeadRepository` without changing services or API controllers.
4. **Resilience & Local Persistence**: State persists instantly in SQLite WAL mode. Web page refreshes or process restarts do not lose discovered leads or generated drafts.
