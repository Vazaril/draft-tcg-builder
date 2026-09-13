# Draft TCG - RAG Backend

A high-performance, local-first Retrieval-Augmented Generation (RAG) backend powering an AI Magic: The Gathering (MTG) Judge and deck generation assistant. 

The backend leverages a local PostgreSQL instance with `pgvector` for hybrid vector/full-text search, a local Text Embeddings Inference (TEI) container running `Qwen/Qwen3-Embedding-0.6B`, and Google's Gemini API for grounded rules adjudication.

---

## Architecture Overview
                      ┌───────────────────────────────┐
                      │     Frontend (TS / React)     │
                      └──────────────┬────────────────┘
                                     │ HTTP / REST
                                     ▼
                      ┌───────────────────────────────┐
                      │     Flask / Gunicorn API      │
                      │      (Draft TCG Backend)      │
                      └───────┬───────────────┬───────┘
                              │               │
           Embeddings (1024d) │               │ LLM Generation (Context + Prompt)
                              ▼               ▼
    ┌───────────────────────────────┐   ┌───────────────────────────────┐
    │   TEI (Docker Container)      │   │       Google Gemini API       │
    │   Qwen/Qwen3-Embedding-0.6B   │   │       gemini-3.6-flash        │
    └───────────────────────────────┘   └───────────────────────────────┘
        │
        │ Vector + FTS Query (RRF)
        ▼
    ┌───────────────────────────────┐
    │     PostgreSQL + pgvector     │
    │       (Docker Container)      │
    │  - vecs.mtg_nodes             │
    │  - hybrid_search_mtg_nodes    │
    └───────────────────────────────┘

### Key Highlights
* **Local-First Vector Store:** Persistent PostgreSQL (`pgvector/pgvector:pg16`) running locally in Docker with zero cloud storage limits or egress fees.
* **Hybrid Search with RRF:** Custom SQL RPC combining `pgvector` cosine similarity distance (`<=>`) and PostgreSQL full-text search (`ts_rank_cd`) via Reciprocal Rank Fusion (RRF).
* **Cost-Efficient Local Embeddings:** Containerized Hugging Face Text Embeddings Inference (TEI) service running `Qwen/Qwen3-Embedding-0.6B` at its native 1024 dimensions (no truncation).
* **Accurate Rules Citations:** Gemini adjudicates rulings strictly using retrieved cards, oracle text, and official Wizards of the Coast judge rulings.

---

## Tech Stack

* **Language:** Python 3.11+
* **Framework:** Flask, Gunicorn
* **RAG & Vectors:** LlamaIndex, `psycopg2`, `pgvector`
* **Embeddings:** Hugging Face Text Embeddings Inference (`Qwen/Qwen3-Embedding-0.6B`)
* **LLM Engine:** Google GenAI SDK (`gemini-3.6-flash`)
* **Containerization:** Docker & Docker Compose

---

## Prerequisites

1. **Docker & Docker Compose** installed.

The embedding model runs as its own `embedder` service (built from `embedder/Dockerfile`, based on `ghcr.io/huggingface/text-embeddings-inference`) and is started automatically by `docker compose up` — no separate host installation needed. The container downloads `Qwen/Qwen3-Embedding-0.6B` from Hugging Face on first start and caches it in the `embedder_data` volume.

---

## Environment Variables

Create a `.env` file in the root directory of the backend:

```env
# Database
DB_URL=postgresql://postgres:yoursecretpassword@vector_db:5432/mtg_vector_db

# Local TEI Embedder (Qwen3-Embedding-0.6B)
EMBEDDER_BASE_URL=http://embedder:80

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model
GEMINI_MODEL=gemini-3.6-flash

# Supabase Connection
SUPABASE_URL=NEXT_PUBLIC_SUPABASE_URL=https://your_supabse_code.supabase.co

# Supabase Internal Connection
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_secret

# Vector Sync
ADMIN_SECRET=your_admin_secret
```
## Getting Started
1. **Initial Database Seed** (First Run)

`db_setup/full_mtg_vector_db_schema.sql` (schema only, `vec vector(1024)`, no row data) is run automatically by Docker on first boot to create the schema, extension, tables, and the `hybrid_search_mtg_nodes` RPC. Populate the table afterwards via `POST /api/admin/sync-vectors` (re-embeds and ingests all Supabase cards/rulings through the new embedder) or `embed_cards_local.py` for local testing.
2. **Start the Containers**

````bash
docker compose up -d --build
````
3. **Check Logs**
````bash
# View backend logs
docker compose logs -f backend

# View database logs
docker compose logs -f vector_db
````
4. **Stop the Containers**
````bash
docker compose down
````
(To completely reset and wipe the database volume, use `docker compose down -v vector_db`)

## API Reference
**Health Check**
-  `GET /health` - Basic server status check.
- `GET /joke` - Utility test endpoint.

**MTG Judge Chat (RAG)**

Retrieves relevant card text and official rulings from the vector database, formats the context, and generates a grounded rules answer.
- Endpoint: `POST /api/chat`
- Headers: `Content-Type: application/json`

**Request Body**
````json
{
  "message": "Can I use Murder to destroy a Darksteel Colossus?",
  "history": [
    { "role": "user", "content": "Hello!" },
    { "role": "model", "content": "Hello! I am your MTG Judge assistant. What rules question do you have?" }
  ]
}
````

**Response Payload (200 OK)**
````json
{
  "role": "model",
  "content": "No, you cannot destroy Darksteel Colossus with Murder. Darksteel Colossus has the **Indestructible** keyword ability. Under MTG rules, permanents with indestructible cannot be destroyed by effects that use the word 'destroy' (such as Murder) or by lethal damage.",
  "context_used": [
    {
      "id": "card_darksteel_colossus",
      "name": "Darksteel Colossus",
      "type": "card"
    },
    {
      "id": "card_murder",
      "name": "Murder",
      "type": "card"
    }
  ]
}
````

**Deck Generator (WIP)**

- Endpoint: `POST /api/deck` **WIP**
- AI-driven archetype drafting and deck synergy generator **WIP**.