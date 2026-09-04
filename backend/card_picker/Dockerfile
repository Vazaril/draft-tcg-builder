FROM ollama/ollama:latest

ENV OLLAMA_MODEL=qwen2.5:3b-instruct

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
