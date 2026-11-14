# Hybrid AI Agent

A lightweight Python project for building a hybrid AI agent that can talk to multiple LLM providers, route tasks between them, and execute tool calls in a loop. The codebase combines:

- Google Gemini as the primary cloud model
- Ollama as a local model option
- A tool registry for numeric and text-processing actions
- A LangChain/LangGraph integration layer for graph-based agent workflows

This repo is structured as a compact starter project for experimenting with agent orchestration and tool calling.

## Project overview

The application is centered around an agent loop that sends a user prompt to an LLM, checks whether the model wants to call any registered tools, executes those functions, and sends the tool results back to the model for another round until the answer is complete.

The main flow is:

1. Load environment settings.
2. Create a model provider via a factory.
3. Build a tool registry.
4. Run the agent loop with user input.
5. Handle function calls, execute tools, and continue until the model responds without tool calls.

## Repository structure

```text
hybrid-ai-agent/
├── .env.example                # Sample environment variables
├── requirements.txt            # Python dependencies
├── app/
│   ├── __init__.py
│   ├── config.py               # Environment-based settings
│   ├── main.py                 # App entry point
│   ├── test.py                 # Small routing smoke test
│   ├── agent/
│   │   ├── __init__.py
│   │   └── executor.py         # Tool-calling agent loop
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── base.py             # Abstract LLM provider API
│   │   ├── factory.py          # Selects provider implementation
│   │   ├── gemini.py           # Google Gemini provider
│   │   ├── ollama.py           # Ollama provider
│   │   └── router.py            # Task-to-provider routing logic
│   ├── langchain_integration/
│   │   ├── __init__.py
│   │   ├── agent.py            # LangGraph-based example workflow
│   │   ├── gemini.py           # LangChain Gemini wrapper
│   │   └── tools.py            # LangChain StructuredTool definitions
│   └── tools/
│       ├── __init__.py
│       ├── calculator.py       # Arithmetic functions
│       ├── registration.py     # Builds the tool registry
│       ├── registry.py         # Generic tool execution registry
│       ├── schemas.py          # Function-call JSON schemas
│       └── text_analyzer.py    # Text statistics helper
```

## Key components

### 1. LLM providers

The `app/llm` package defines a common interface and concrete implementations:

- `LLMProvider`: abstract base class for model backends
- `GeminiLLM`: wraps the Google GenAI client
- `OllamaLLM`: wraps the Ollama client
- `LLMFactory`: maps provider names like `gemini` and `ollama` to implementations

This lets the app swap providers without changing core orchestration code.

### 2. Routing layer

`app/llm/router.py` introduces `HybridModelRouter`, which routes task types to a model provider based on a policy table:

- `simple`, `classification`, `local_only` -> Ollama
- `complex`, `analysis` -> Gemini

This is a useful pattern when you want to balance local speed with model capability.

### 3. Tool system

The `app/tools` package provides executable tools and schema metadata used by the model for function calling.

Available tools:

- `add_numbers(a, b)`
- `subtract_numbers(a, b)`
- `multiply_numbers(a, b)`
- `divide_numbers(a, b)`
- `get_text_statistics(text)`

`ToolRegistry` validates tool names and arguments, then executes the function matching the tool name.

`app/tools/schemas.py` defines the JSON schema for the function-calling API so the LLM can request these tools safely and consistently.

### 4. Agent executor

`app/agent/executor.py` contains the core loop:

- Send request to the model with available tool schemas.
- Detect function calls in responses.
- Execute each requested tool through the registry.
- Send tool results back to the model.
- Repeat until the model produces a normal final answer.

This is the underlying orchestration pattern for the app.

### 5. LangChain/LangGraph example

`app/langchain_integration` contains a second code path that uses LangChain and LangGraph abstractions instead of the custom direct integration.

Important files:

- `app/langchain_integration/gemini.py`: wraps a Google Generative AI chat model
- `app/langchain_integration/tools.py`: converts Python functions into LangChain StructuredTools
- `app/langchain_integration/agent.py`: builds a state graph with an LLM node and a ToolNode

This is useful for comparing direct function-calling against graph-based agent orchestration.

## Configuration

The app reads environment variables from a `.env` file using `python-dotenv`.

Create a `.env` file in the project root based on `.env.example`:

```env
GEMINI_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_HOST=http://localhost:11434
```

Notes:

- `app/config.py` reads `GEMINI_API_KEY` and `GEMINI_MODEL`.
- `OLLAMA_MODEL` and `OLLAMA_HOST` are used for local Ollama inference.
- The project expects a running Ollama server for local model calls.

## Installation

Use a virtual environment and install the dependencies from `requirements.txt`:

```bash
cd /Users/minhazulkarim/Minhaz/Projects/hybrid-ai-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Running the app

The project entry point is `app/main.py`:

```bash
source .venv/bin/activate
python -m app.main
```

This will prompt for a user message and run the built-in agent loop using Gemini and the registered tools.

## Example usage

Try a prompt like:

```text
User: Add 25 and 17, then multiply the result by 2
```

Or:

```text
User: Tell me how many words are in this sentence: "The future of AI is collaborative and practical."
```

The agent will decide whether to call arithmetic or text-analysis tools to answer correctly.

## Running the router smoke test

`app/test.py` demonstrates the provider routing logic:

```bash
source .venv/bin/activate
python -m app.test
```

This creates a `HybridModelRouter` and checks that simple tasks route to Ollama while complex tasks route to Gemini.

## Dependencies

The project depends on:

- `google-genai` for Gemini access
- `ollama` for local model usage
- `python-dotenv` for environment loading
- `langchain`, `langgraph`, and related packages for the LangChain integration examples
- `pydantic` for schema validation and data models

See `requirements.txt` for the exact package versions currently pinned in the repo.

## Notes and considerations

- This repository is a starter implementation rather than a production-ready framework.
- The direct Gemini integration uses `google.genai` and tool schemas directly.
- The LangGraph example is a separate experimental or tutorial-style implementation.
- The environment variable names and provider configuration should be kept consistent with `app/config.py` as you extend the project.
- If you want to use Ollama, make sure the server is running on the configured host and the model is available locally.

## Typical workflow

1. Add your API key to `.env`.
2. Activate the virtual environment.
3. Start Ollama if you want local model support.
4. Run the app or the router smoke test.
5. Extend the registry with additional tools if you want new capabilities.

## License

This project does not include a license file in the repository snapshot. If you plan to distribute or reuse it, add an appropriate license before publication.
