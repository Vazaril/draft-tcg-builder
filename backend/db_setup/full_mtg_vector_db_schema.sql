--
-- PostgreSQL database dump
--

\restrict FJMr2CnXowag3SoT7rwGaokELnMTpChQsIDKz9Mm3sPqedlyzlkAwZcF8jwuNVk

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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: data_mtg_nodes; Type: TABLE; Schema: vecs; Owner: postgres
--

CREATE TABLE vecs.data_mtg_nodes (
    id bigint NOT NULL,
    text character varying NOT NULL,
    metadata_ json,
    node_id character varying,
    embedding public.vector(1024)
);


ALTER TABLE vecs.data_mtg_nodes OWNER TO postgres;

--
-- Name: data_mtg_nodes_id_seq; Type: SEQUENCE; Schema: vecs; Owner: postgres
--

CREATE SEQUENCE vecs.data_mtg_nodes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE vecs.data_mtg_nodes_id_seq OWNER TO postgres;

--
-- Name: data_mtg_nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: vecs; Owner: postgres
--

ALTER SEQUENCE vecs.data_mtg_nodes_id_seq OWNED BY vecs.data_mtg_nodes.id;


--
-- Name: data_mtg_nodes id; Type: DEFAULT; Schema: vecs; Owner: postgres
--

ALTER TABLE ONLY vecs.data_mtg_nodes ALTER COLUMN id SET DEFAULT nextval('vecs.data_mtg_nodes_id_seq'::regclass);

--
-- Name: data_mtg_nodes_id_seq; Type: SEQUENCE SET; Schema: vecs; Owner: postgres
--

SELECT pg_catalog.setval('vecs.data_mtg_nodes_id_seq', 108942, true);


--
-- Name: data_mtg_nodes data_mtg_nodes_pkey; Type: CONSTRAINT; Schema: vecs; Owner: postgres
--

ALTER TABLE ONLY vecs.data_mtg_nodes
    ADD CONSTRAINT data_mtg_nodes_pkey PRIMARY KEY (id);


--
-- Name: mtg_nodes_idx_1; Type: INDEX; Schema: vecs; Owner: postgres
--

CREATE INDEX mtg_nodes_idx_1 ON vecs.data_mtg_nodes USING btree (((metadata_ ->> 'ref_doc_id'::text)));


--
-- Name: hybrid_search_mtg_nodes(text, public.vector, integer, double precision, double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
-- Adapted for the vecs.data_mtg_nodes shape (node_id/metadata_/embedding/
-- text) that services/ingestion/pipeline.py's run_ingestion() actually
-- produces, instead of an older hand-rolled vecs.mtg_nodes(id/metadata/vec)
-- shape this repo used to (mistakenly) target. Also now returns `text`
-- directly from its own column: this dump was made with llama_index's
-- remove_text=True, which leaves metadata->_node_content->text empty, so
-- the real oracle_text/ruling body only exists in this separate column -
-- see services/retrieval/engine.py, which reads it from here now instead.
--

CREATE FUNCTION public.hybrid_search_mtg_nodes(query_text text, query_embedding public.vector, match_count integer DEFAULT 5, full_text_weight double precision DEFAULT 1.0, semantic_weight double precision DEFAULT 1.0, rrf_k integer DEFAULT 50) RETURNS TABLE(id text, metadata jsonb, text character varying, rrf_score double precision)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT
            mtg.node_id AS id,
            mtg.metadata_ AS metadata,
            mtg.text AS text,
            -- Rank based on cosine distance (<=>)
            row_number() OVER (ORDER BY mtg.embedding <=> query_embedding) AS rank
        FROM vecs.data_mtg_nodes mtg
        ORDER BY mtg.embedding <=> query_embedding
        LIMIT match_count * 2 -- Over-fetch slightly for better fusion
    ),
    keyword_search AS (
        SELECT
            mtg.node_id AS id,
            -- Cast metadata so Postgres searches through our extracted text, phases, and mechanics
            row_number() OVER (ORDER BY ts_rank_cd(to_tsvector('english', mtg.metadata_::text), websearch_to_tsquery('english', query_text)) DESC) AS rank
        FROM vecs.data_mtg_nodes mtg
        WHERE to_tsvector('english', mtg.metadata_::text) @@ websearch_to_tsquery('english', query_text)
        ORDER BY ts_rank_cd(to_tsvector('english', mtg.metadata_::text), websearch_to_tsquery('english', query_text)) DESC
        LIMIT match_count * 2
    )
    SELECT
         COALESCE(ss.id, ks.id)::text AS id,
        -- Grab metadata/text from semantic search, or fetch it if it only appeared in keyword search
        COALESCE(ss.metadata, (SELECT mtg.metadata_ FROM vecs.data_mtg_nodes mtg WHERE mtg.node_id = ks.id))::jsonb AS metadata,
        COALESCE(ss.text, (SELECT mtg.text FROM vecs.data_mtg_nodes mtg WHERE mtg.node_id = ks.id)) AS text,
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

--
-- PostgreSQL database dump complete
--

\unrestrict FJMr2CnXowag3SoT7rwGaokELnMTpChQsIDKz9Mm3sPqedlyzlkAwZcF8jwuNVk

