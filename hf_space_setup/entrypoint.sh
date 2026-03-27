#!/bin/bash

# Configure Ollama to listen on the HF Space port (7860)
export OLLAMA_HOST=0.0.0.0:7860

# Start Ollama in the background
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start on porta 7860..."
until curl -s localhost:7860/api/tags > /dev/null; do
  sleep 2
done

# Pull the Qwen-VL model (Standard Tag)
echo "Pulling Qwen2-VL model..."
ollama pull qwen2-vl

# Keep the container running
echo "Qwen-VL Cloud Brain is READY 📡🛡️🏁"
wait
