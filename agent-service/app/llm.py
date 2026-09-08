"""LLM client interface using local Ollama service."""
import os
# pyrefly: ignore [missing-import]
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b-instruct-q4_K_M")


async def call_ollama(
    prompt: str,
    temperature: float = 0.6,
    format_json: bool = False,
    timeout: float = 300.0,
) -> str:
    """Send a single-turn completion prompt to local Ollama API and return raw response string."""
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": temperature},
    }
    if format_json:
        payload["format"] = "json"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
            resp.raise_for_status()
            return resp.json()["message"]["content"]
    except httpx.HTTPError as err:
        raise RuntimeError(
            f"Can't reach the local LLM at {OLLAMA_BASE_URL} (model {OLLAMA_MODEL}). "
            f"Is Ollama running? Try `ollama serve`. ({err})"
        ) from err
