--
-- PostgreSQL database dump
--

\restrict R0BrzcmSpGCQfc4b3ZUxhZU7xruWc4cOKGj0Nz4x6f6q1p6hyD2tFRJvpdYuXpo

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg12+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vecs; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA vecs;


ALTER SCHEMA vecs OWNER TO postgres;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: hybrid_search_mtg_nodes(text, public.vector, integer, double precision, double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.hybrid_search_mtg_nodes(query_text text, query_embedding public.vector, match_count integer DEFAULT 5, full_text_weight double precision DEFAULT 1.0, semantic_weight double precision DEFAULT 1.0, rrf_k integer DEFAULT 50) RETURNS TABLE(id text, metadata jsonb, rrf_score double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT
            mtg.id,
            mtg.metadata,
            -- Rank based on cosine distance (<=>)
            row_number() OVER (ORDER BY mtg.vec <=> query_embedding) AS rank
        FROM vecs.mtg_nodes mtg
        ORDER BY mtg.vec <=> query_embedding
        LIMIT match_count * 2 -- Over-fetch slightly for better fusion
    ),
    keyword_search AS (
        SELECT
            mtg.id,
            -- Cast metadata::text so Postgres searches through our extracted text, phases, and mechanics
            row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', mtg.metadata::text), websearch_to_tsquery('english', query_text)) DESC) AS rank
        FROM vecs.mtg_nodes mtg
        WHERE to_tsvector('english', mtg.metadata::text) @@ websearch_to_tsquery('english', query_text)
        ORDER BY ts_rank_cd(to_tsvector('english', mtg.metadata::text), websearch_to_tsquery('english', query_text)) DESC
        LIMIT match_count * 2
    )
    SELECT
         COALESCE(ss.id, ks.id)::text AS id,
        -- Grab metadata from semantic search, or fetch it if it only appeared in keyword search
        COALESCE(ss.metadata, (SELECT mtg.metadata FROM vecs.mtg_nodes mtg WHERE mtg.id = ks.id)) AS metadata,
        -- Calculate Reciprocal Rank Fusion (RRF) score
        (
            COALESCE(semantic_weight / (rrf_k + ss.rank), 0.0) +
            COALESCE(full_text_weight / (rrf_k + ks.rank), 0.0)
        )::float AS rrf_score
    FROM semantic_search ss
    FULL OUTER JOIN keyword_search ks ON ss.id = ks.id
    ORDER BY rrf_score DESC
    LIMIT match_count;
END;
$$;


ALTER FUNCTION public.hybrid_search_mtg_nodes(query_text text, query_embedding public.vector, match_count integer, full_text_weight double precision, semantic_weight double precision, rrf_k integer) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: mtg_nodes; Type: TABLE; Schema: vecs; Owner: postgres
--

CREATE TABLE vecs.mtg_nodes (
    id character varying NOT NULL,
    vec public.vector(1024) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE vecs.mtg_nodes OWNER TO postgres;

--
-- Name: mtg_nodes mtg_nodes_pkey; Type: CONSTRAINT; Schema: vecs; Owner: postgres
--

ALTER TABLE ONLY vecs.mtg_nodes
    ADD CONSTRAINT mtg_nodes_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict R0BrzcmSpGCQfc4b3ZUxhZU7xruWc4cOKGj0Nz4x6f6q1p6hyD2tFRJvpdYuXpo
