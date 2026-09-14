<a>
  <h1 align="center">DRAFT</h1>
</a>

<p align="center">
  <strong>The ultimate AI-supported deck building and management tool.</strong><br>
  <em>A Hybrid Agentic RAG Architecture for Zero-Shot Deck Generation and Rules Adjudication in Trading Card Games.</em>
</p>

<p align="center">
  <a href="#about-the-project"><strong>About</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#architecture--tech-stack"><strong>Architecture</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#environment-variables"><strong>Environment Variables</strong></a>
</p>
<br/>

## About the Project

Generating valid, synergistic decks for Trading Card Games (TCGs) like *Magic: The Gathering* (MTG) is a highly constrained combinatorial challenge. Standard Large Language Models (LLMs) struggle with this zero-shot task due to card hallucinations, incorrect mathematical quotas, and a lack of format legality awareness.

**DRAFT** solves this by utilizing a custom **Agentic Retrieval-Augmented Generation (RAG)** architecture. By decoupling the generation process into a structural blueprint phase and a hybrid retrieval-scoring phase, DRAFT enforces strict game rules at the database level while leveraging the LLM for creative synergy and orchestration.

This project was developed as part of a university course on Web Applications and LLM Integration (University of Giessen, 2026).

## Features

### AI Deck Builder
- **Zero-Shot Generation:** Simply prompt the AI (e.g., *"Build a Graveyard deck featuring The Gitrog Monster"*), and the system will design a mathematically perfect 60-card or 100-card deck.
- **Strict Format & Color Constraints:** A custom PostgreSQL hybrid search filters out illegal cards at the database level *before* the LLM evaluates them, ensuring 100% format legality.
- **Explicit Card Requests:** Safely parses explicitly requested cards from the user prompt and matches them perfectly using a punctuation-agnostic regex search, bypassing vector approximations.
- **Real-Time Streaming:** Watch your deck being built in real-time via Server-Sent Events (SSE) as the Agentic RAG pipeline searches, scores, and allocates cards into synergistic categories (Ramp, Removal, Win Conditions, etc.).

### MTG Judge Chat
- **Expert Rules Adjudicator:** Ask complex rules questions and receive answers grounded entirely in official MTG rulings and Oracle text.
- **LLM-Aided Query Rewriting:** The chatbot analyzes multi-turn conversational history and rewrites ambiguities into highly optimized, standalone search queries.
- **Entity Extraction:** Automatically identifies and tags specific cards, keywords, and rule numbers (e.g., `[[card:Ramunap Excavator]]`, `[[rule:702.12b]]`) to guarantee precise relational database lookups alongside semantic vector searches.

### Theming
- Fully integrated Next-Themes support featuring Light, Dark, System, and a custom **Classic** MTG-inspired theme.
- Dynamic SVGs and favicons that automatically adapt to the user's active color palette.

## Architecture & Tech Stack

DRAFT is built on a modern, decoupled stack:

- **Frontend:** Next.js (App Router), React, Tailwind CSS, shadcn/ui.
- **AI & Orchestration:** Google Gemini (`gemini-3.5-flash-lite` or similar) via the `google-genai` SDK.
- **Embeddings:** Local Ollama running the `qwen3-embedding` model, utilizing a custom LlamaIndex pipeline to chunk and truncate vectors to 1536 dimensions.
- **Database:** Supabase (PostgreSQL).
- **Search Engine:** Custom PL/pgSQL functions utilizing `pgvector` (cosine distance) and `tsvector` (full-text search) merged via Reciprocal Rank Fusion (RRF).

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- [Ollama](https://ollama.ai/) installed locally with the `qwen3-embedding` model pulled.
- A [Supabase](https://supabase.com/) project.

### 1. Clone the repository
```bash
git clone [https://github.com/Vazaril/draft-tcg-builder.git](https://github.com/Vazaril/draft-tcg-builder.git)
cd draft-tcg-builder
```
### 2. Frontend Setup

Install the Next.js dependencies:
```bash
npm install
```

### 3. Backend & AI Setup

Set up your Python virtual environment and install the backend dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```
### 4. Database Migrations

Run the SQL scripts located in the /supabase/migrations folder in your Supabase SQL Editor. This will set up the vecs.mtg_nodes table, pgvector extensions, and the custom filtered_hybrid_search_mtg_nodes PL/pgSQL functions required for the RRF retrieval.

### 5. Run the Application

Start the Next.js development server and your Python backend service:

```bash
npm run dev
```
The application will be available at http://localhost:3000.

## Environment Variables

Rename .env.example to .env.local in the root directory and update the following values:

```bash
# Next Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
PYTHON_BACKEND_URL=http://127.0.0.1:5001

# Backend Configuration
GEMINI_API_KEY=api_key
GEMINI_MODEL=gemini-3.5-flash-lite
OLLAMA_BASE_URL=http://host.docker.internal:11434
SUPABASE_URL=https://your_project.supabase.co
DB_URL=DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
ADMIN_SECRET=your-secret-pass-key
```

## Authors

DRAFT Team

This software is provided as-is for academic and educational purposes.