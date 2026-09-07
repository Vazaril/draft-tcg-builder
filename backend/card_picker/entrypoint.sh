#!/bin/sh
set -e

ollama serve &
SERVER_PID=$!

until ollama list >/dev/null 2>&1; do
  sleep 1
done

if ! ollama list | grep -q "^${OLLAMA_MODEL}"; then
  ollama pull "${OLLAMA_MODEL}"
fi

wait "$SERVER_PID"
