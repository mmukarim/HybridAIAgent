# Hybrid AI Agent

A hybrid AI agent built with Python, LangChain, LangGraph, FastAPI, and PostgreSQL. The project combines a custom agent implementation with a LangGraph-based agent, supporting conversational interactions, mathematical operations, text analysis, and data-driven business analysis.

The application supports both an interactive CLI and a REST API. The API provides persistent conversations, file uploads, dataset management, and conversation history retrieval.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Configuration](#environment-configuration)
- [Database and Migrations](#database-and-migrations)
- [Running the Application](#running-the-application)
- [CLI Usage](#cli-usage)
- [REST API](#rest-api)
- [File and Dataset Management](#file-and-dataset-management)
- [Conversation Management](#conversation-management)
- [LangGraph and Persistence](#langgraph-and-persistence)
- [Available Tools](#available-tools)
- [Storage Architecture](#storage-architecture)
- [Current Limitations](#current-limitations)

## Features

### AI Agent

- Custom agent implementation using a tool registry and LLM abstraction.
- LangGraph-based agent with a stateful execution workflow.
- Gemini and Ollama provider integrations.
- Tool calling through LangChain.
- Support for multiple conversation threads.
- Persistent conversation state through PostgreSQL checkpoints in the API application.

### Data Analysis

- Load datasets from CSV, XLSX, and XLS files.
- Dataset profiling and column analysis.
- Statistical and correlation analysis.
- Group-based aggregation.
- Chart generation.
- Business insights generation.
- Automated business report generation.

### REST API

- Create conversations lazily when the first message is submitted.
- Continue existing conversations.
- Retrieve conversation metadata.
- Retrieve complete user-facing message history, including tool responses.
- Delete conversations.
- Upload, list, retrieve, and delete files.
- Load uploaded files as datasets.
- Associate datasets with conversations.
- Change or remove a conversation's associated dataset.

### Persistence

- PostgreSQL for application metadata.
- SQLAlchemy asynchronous database operations.
- Alembic database migrations.
- LangGraph PostgreSQL checkpointer for conversation state.
- Local file storage with a storage abstraction.
- Automatic dataset reloading when an associated dataset is missing from the in-memory registry.

## Architecture

The project follows a layered architecture with separate responsibilities for the API, services, agent execution, tools, database, and storage.

```text
                    Client / User
                          |
              +-----------+-----------+
              |                       |
             CLI                  FastAPI
              |                       |
       +------+-------+        +------+-------+
       |              |        |              |
  Custom Agent   LangGraph  API Routes    Dependencies
       |              |        |              |
       |              |        +------+-------+
       |              |               |
       |              |          Services
       |              |               |
       +--------------+---------------+
                      |
                 LangGraph Agent
                      |
                LLM + ToolNode
                      |
             +--------+---------+
             |                  |
          LLM Providers      Agent Tools
             |                  |
        Gemini / Ollama    Analysis / Data
                                |
                         Dataset Registry
                                |
                  +-------------+-------------+
                  |                           |
              PostgreSQL                 File Storage
           Metadata + Checkpoints       Uploaded Files
```

### Architectural components

| Component | Responsibility |
|---|---|
| CLI | Interactive command-line interface |
| FastAPI | REST API application |
| Agent | Agent construction and execution |
| LLM | Provider abstraction and model integration |
| LangChain integration | LangChain tools and LangGraph workflow |
| Tools | Deterministic calculations and data analysis |
| Services | Application business logic |
| Database | Persistent application metadata |
| Checkpointer | Persistent LangGraph execution state |
| Storage | Uploaded file storage |
| Dataset Registry | Runtime DataFrame registration and retrieval |

## Technology Stack

| Category | Technology |
|---|---|
| Language | Python |
| API Framework | FastAPI |
| Agent Framework | LangChain |
| Agent Orchestration | LangGraph |
| LLM Providers | Google Gemini, Ollama |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database Driver | asyncpg |
| Migrations | Alembic |
| Data Processing | Pandas |
| Dataset Support | CSV, Excel |
| Containerization | Docker |
| API Documentation | Swagger UI / OpenAPI |

## Project Structure

```text
HybridAIAgent/
│
├── app/
│   ├── __init__.py
│   │
│   ├── agent/
│   │   ├── executor.py
│   │   └── ...
│   │
│   ├── api/
│   │   ├── dependencies.py
│   │   ├── routes/
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   └── files.py
│   │   └── schemas/
│   │       ├── conversations.py
│   │       ├── messages.py
│   │       └── files.py
│   │
│   ├── database/
│   │   ├── base.py
│   │   ├── manager.py
│   │   ├── checkpointer.py
│   │   └── models/
│   │
│   ├── langchain_integration/
│   │   ├── agent.py
│   │   ├── gemini.py
│   │   └── tools.py
│   │
│   ├── llm/
│   │   ├── factory.py
│   │   └── ...
│   │
│   ├── services/
│   │   ├── agent_service.py
│   │   ├── conversation_service.py
│   │   ├── dataset_service.py
│   │   └── file_service.py
│   │
│   ├── storage/
│   │   ├── base.py
│   │   └── local.py
│   │
│   ├── tools/
│   │   ├── dataset_registry.py
│   │   ├── data_loader.py
│   │   ├── pandas_analysis.py
│   │   ├── chart_generator.py
│   │   ├── business_insights.py
│   │   └── ...
│   │
│   ├── samplesales.csv
│   ├── cli.py
│   ├── main.py
│   └── config.py
│
├── migrations/
│   ├── versions/
│   └── env.py
│
├── storage/
│   └── uploads/
│
├── .env
├── .gitignore
├── alembic.ini
├── docker-compose.yml
├── requirements.txt
└── README.md
```

*The structure above represents the main architectural components. Some directories may contain additional implementation files.*

## Prerequisites

Make sure the following tools are installed:

- Python 3.13 or compatible version.
- PostgreSQL.
- Docker and Docker Compose (if running PostgreSQL through Docker).
- Git.
- Gemini API credentials or a configured Ollama environment.

## Installation and Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd HybridAIAgent
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it.

macOS / Linux:

```bash
source .venv/bin/activate
```

Windows:

```powershell
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root.

Refer to `app/config.py` for the complete list of application settings and their exact environment variable names.

At minimum, configure:

- PostgreSQL connection URL.
- LLM provider credentials and settings.
- File storage directory.
- Maximum upload size.

Example file-storage configuration:

```env
FILE_STORAGE_PATH=storage/uploads
MAX_UPLOAD_SIZE_MB=50
```

Do not commit API keys, passwords, or other secrets to version control.

### 5. Prepare PostgreSQL

You can use an existing PostgreSQL instance or start the configured database service through Docker Compose:

```bash
docker compose up -d
```

Create the application database if it does not already exist:

```sql
CREATE DATABASE hybrid_ai_agent;
```

Make sure the database connection configuration matches your PostgreSQL credentials and database name.

## Database and Migrations

The project uses SQLAlchemy's asynchronous engine and Alembic for database schema management.

### Apply migrations

```bash
alembic upgrade head
```

### Check the current migration revision

```bash
alembic current
```

### Generate a migration

After modifying ORM models:

```bash
alembic revision --autogenerate -m "describe schema change"
```

Review the generated migration before applying it.

```bash
alembic upgrade head
```

### Database responsibilities

The application database stores metadata such as:

- Conversations.
- Uploaded file metadata.
- Conversation-to-dataset associations.

LangGraph checkpoint data is managed separately by `AsyncPostgresSaver`. Its checkpoint tables are initialized through the checkpointer setup.

## Running the Application

The project supports two execution modes.

### 1. Run the CLI

```bash
python -m app.cli
```

The CLI allows users to select the agent implementation and optionally load a dataset.

Available modes:

- Custom agent.
- LangGraph agent.

### 2. Run the REST API

```bash
uvicorn app.main:agent_app --reload
```

Open Swagger UI:

```text
http://127.0.0.1:8000/docs
```

Open the OpenAPI specification:

```text
http://127.0.0.1:8000/openapi.json
```

## CLI Usage

The CLI provides an interactive interface for experimenting with both agent implementations.

### Custom Agent

The custom agent uses:

- `LLMFactory` for model creation.
- `ToolRegistry` for tool registration.
- `AgentExecutor` for execution.

It uses the existing registry-based tool implementation.

### LangGraph Agent

The LangGraph agent uses:

- `StateGraph`.
- `MessagesState` extended with dataset context.
- `ToolNode`.
- `tools_condition`.
- A configurable checkpointer.

The CLI uses an in-memory checkpointer, while the FastAPI application uses PostgreSQL persistence.

### Dataset loading

At startup, the CLI prompts for a dataset file path.

Example:

```text
Enter dataset file path (press Enter to skip):
```

To use the included sample dataset, enter:

```text
app/samplesales.csv
```

Press Enter to skip dataset loading.

## REST API

The REST API is organized around conversations, messages, and files.

The default API prefix is:

```text
/api/v1
```

### Conversation endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/messages` | Create a conversation and process its first message |
| POST | `/api/v1/conversations/{conversation_id}/messages` | Send a message to an existing conversation |
| GET | `/api/v1/conversations` | List saved conversations |
| GET | `/api/v1/conversations/{conversation_id}` | Retrieve conversation details |
| DELETE | `/api/v1/conversations/{conversation_id}` | Delete a conversation and its LangGraph checkpoint |
| PUT | `/api/v1/conversations/{conversation_id}/dataset` | Associate a dataset with a conversation |
| DELETE | `/api/v1/conversations/{conversation_id}/dataset` | Remove the dataset association |

### Message history endpoint

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/conversations/{conversation_id}/messages` | Retrieve conversation message history |

The history endpoint returns user messages, final assistant responses, and tool execution results.

Example response:

```json
{
  "conversation_id": "your-conversation-uuid",
  "messages": [
    {
      "role": "user",
      "content": "Calculate 150 * 20"
    },
    {
      "role": "tool",
      "content": "3000"
    },
    {
      "role": "assistant",
      "content": "The result is 3,000."
    }
  ],
  "total": 3
}
```

Intermediate assistant tool-call instructions are excluded from this simplified history representation.

### File endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/files` | Upload a file |
| GET | `/api/v1/files` | List uploaded files |
| GET | `/api/v1/files/{file_id}` | Retrieve file metadata |
| DELETE | `/api/v1/files/{file_id}` | Delete an uploaded file |
| POST | `/api/v1/files/{file_id}/load` | Load a file as a dataset |

Supported formats:

- CSV (`.csv`)
- Excel (`.xlsx`)
- Excel 97–2003 (`.xls`)

The configured maximum upload size is controlled by `MAX_UPLOAD_SIZE_MB`.

## File and Dataset Management

The application separates physical file storage from runtime dataset management.

### File upload flow

1. The client uploads a file through the REST API.
2. `FileService` validates the file extension and size.
3. `LocalStorage` saves the file using a generated storage key.
4. File metadata is stored in PostgreSQL.
5. The API returns the file metadata and its UUID.

The original filename is retained in the database, while the physical file uses a generated storage key.

### Dataset loading flow

1. The client requests the dataset load endpoint.
2. `DatasetService` retrieves the file metadata.
3. The physical file is located through the storage abstraction.
4. Pandas loads the CSV or Excel file.
5. The DataFrame is registered in `DatasetRegistry`.
6. The file UUID is used as the dataset ID.

### Dataset association

A dataset can be associated with a conversation using:

```text
PUT /api/v1/conversations/{conversation_id}/dataset
```

The association is stored in the conversation record.

The conversation can subsequently use the associated dataset without requiring the LLM to supply a dataset ID.

### Automatic dataset recovery

`DatasetRegistry` is an in-memory registry. Its contents are lost when the application restarts.

To address this, `AgentService` checks whether the conversation's associated dataset is registered before invoking LangGraph.

If it is missing, `DatasetService` reloads it from persistent file storage.

This allows existing conversations to continue using their associated datasets after an application restart.

### Dataset removal and deletion

- Removing a dataset association sets the conversation's `dataset_id` to `NULL`.
- Deleting an associated file sets the referencing conversation's `dataset_id` to `NULL` through the foreign key's `ON DELETE SET NULL` behavior.

## Conversation Management

The application uses lazy conversation creation.

An empty conversation is not persisted when a user simply starts a new conversation.

Instead, the conversation is created when the first message is submitted.

### First message

```text
POST /api/v1/messages
```

This operation:

1. Creates a conversation record.
2. Uses the conversation UUID as the LangGraph thread ID.
3. Invokes the agent with the first user message.
4. Persists the execution state through the PostgreSQL checkpointer.

### Subsequent messages

```text
POST /api/v1/conversations/{conversation_id}/messages
```

The application retrieves the existing conversation and resumes the corresponding LangGraph thread.

### Conversation history

```text
GET /api/v1/conversations/{conversation_id}/messages
```

The API retrieves the latest LangGraph checkpoint state and transforms its messages into API-friendly history entries.

Supported roles:

| Role | Description |
|---|---|
| `user` | User-submitted message |
| `assistant` | Final assistant response |
| `tool` | Tool execution result |

## LangGraph and Persistence

The LangGraph implementation follows a simple tool-calling workflow.

```text
             START
                |
                v
              LLM
                |
                v
       Tool Calls Required?
           /         \
         Yes          No
          |            |
          v            v
        TOOLS         END
          |
          v
         LLM
```

### Graph components

| Component | Responsibility |
|---|---|
| `StateGraph` | Defines the agent workflow |
| `MessagesState` | Maintains conversational messages |
| `AgentState` | Extends the graph state with dataset context |
| `ToolNode` | Executes selected tools |
| `tools_condition` | Determines whether tool execution is required |
| `InMemorySaver` | Provides CLI checkpointing |
| `AsyncPostgresSaver` | Provides persistent API checkpointing |

### Conversation identification

Each conversation uses its UUID as the LangGraph `thread_id`.

Example:

```python
config = {
    "configurable": {
        "thread_id": str(conversation_id)
    }
}
```

This allows the application to resume the correct conversation state when a new message arrives.

### Dataset context injection

Dataset IDs are supplied through graph state and injected into dataset-analysis tools using LangGraph's `InjectedState`.

This prevents the LLM from having to generate or select internal dataset IDs as tool arguments.

The current dataset association is obtained from the conversation record and supplied on each agent invocation.

## Available Tools

The application includes deterministic tools for mathematical, text, and dataset analysis.

### Mathematical tools

- Addition.
- Subtraction.
- Multiplication.
- Division.

### Text analysis

- Text statistics.

### Dataset analysis

The LangGraph dataset tool collection includes:

| Tool | Description |
|---|---|
| `profile_dataset` | Dataset overview and profiling |
| `analyze_column` | Analyze an individual column |
| `analyze_correlations` | Calculate correlations |
| `aggregate_data` | Perform grouped aggregations |
| `generate_chart` | Generate data visualizations |
| `generate_business_insights` | Generate business-oriented insights |
| `create_business_report` | Create a structured business report |

The tools use the existing deterministic analysis functions rather than relying on the LLM to calculate analytical results directly.

## Storage Architecture

The project uses a storage abstraction to separate file-management logic from the underlying storage implementation.

### BaseStorage

Defines the common storage interface:

- `save()`
- `get_path()`
- `delete()`
- `exists()`

### LocalStorage

The current implementation stores uploaded files locally.

Default configuration:

```env
FILE_STORAGE_PATH=storage/uploads
```

Files are saved using UUID-based storage keys to avoid filename collisions.

The upload directory should not be committed to version control.

## Current Limitations

The current implementation is designed primarily for local development and a single-user environment.

Important limitations include:

1. **No authentication:** API endpoints do not currently implement user authentication or authorization.
2. **Single-user design:** Conversations and uploaded files are not currently scoped to individual users.
3. **Local file storage:** The current storage implementation uses the local filesystem.
4. **In-memory dataset registry:** DataFrames are held in application memory and reloaded from storage when needed.
5. **CLI persistence:** The CLI uses an in-memory LangGraph checkpointer, unlike the API's PostgreSQL checkpointer.
6. **No frontend:** The REST API is the primary interface for application integration.
7. **File validation:** Extension and upload-size checks are implemented; client-provided MIME types should not be treated as proof of file contents.

## Development Notes

- Keep deterministic analysis logic separate from LLM reasoning.
- Keep agent orchestration separate from API route handlers.
- Use services for application business logic.
- Keep database operations asynchronous in the API application.
- Use the conversation UUID consistently as the LangGraph thread ID.
- Preserve compatibility between the custom agent CLI and LangGraph CLI.
- Use Alembic migrations for database schema changes.
- Do not commit `.env`, uploaded files, or other sensitive data.

## License

Add the project's applicable license information here.