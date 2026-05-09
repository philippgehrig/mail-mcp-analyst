#!/bin/sh
set -e

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do
  sleep 1
done
echo "Ollama is ready"

# Pull model if not already present
if ! ollama list | grep -q "$OLLAMA_MODEL"; then
  echo "Pulling model: $OLLAMA_MODEL"
  ollama pull "$OLLAMA_MODEL"
  echo "Model pulled successfully"
fi

# Start the analyst
exec node /app/dist/index.js
