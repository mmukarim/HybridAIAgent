# GitHub Copilot Instructions — HybridAgent

## 1. Project Overview

HybridAgent is a monorepo containing two independent applications:

1. Backend: A Python-based Hybrid AI Agent application.
2. Frontend: A client application that consumes the backend REST APIs.

The backend is built with FastAPI, LangChain, LangGraph, PostgreSQL, and Pandas.

The frontend is located in `FrontEnd/ClientApp/`.

The project supports:
- Custom AI agent execution.
- LangGraph-based agent orchestration.
- Gemini and Ollama providers.
- Multiple persistent conversations.
- Conversation history retrieval.
- File uploads and dataset management.
- Dataset association with conversations.
- Automatic dataset recovery.
- Mathematical and text-analysis tools.
- Data analysis and business reporting.
- REST API integration.

The backend is already implemented and functional. Preserve its existing architecture and behavior.

## 2. Repository Structure

The repository follows this structure:

```text
HybridAgent/
│
├── Backend/
│   ├── app/
│   │   ├── agent/
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   ├── routes/
│   │   │   └── schemas/
│   │   ├── database/
│   │   │   ├── models/
│   │   │   ├── base.py
│   │   │   ├── manager.py
│   │   │   └── checkpointer.py
│   │   ├── langchain_integration/
│   │   ├── llm/
│   │   ├── services/
│   │   ├── storage/
│   │   ├── tools/
│   │   ├── samplesales.csv
│   │   ├── cli.py
│   │   ├── main.py
│   │   └── config.py
│   │
│   ├── migrations/
│   │   └── versions/
│   ├── storage/
│   │   └── uploads/
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── docker-compose.yml
│   ├── .env
│   └── .gitignore
│
├── FrontEnd/
│   └── ClientApp/
│       ├── src/
│       ├── public/
│       ├── package.json
│       └── ...
│
├── .github/
│   ├── copilot-instructions.md
│   └── instructions/
│       └── frontend.instructions.md
│
├── README.md
└── .gitignore
```

This is a reference structure. Always inspect the actual repository before creating, moving, or modifying files.

Important:
- `Backend/app/` is the Python application package. Keep its name lowercase.
- `Backend/migrations/` contains Alembic migrations.
- `Backend/storage/` contains uploaded files and other persistent local storage, when created.
- `FrontEnd/ClientApp/` is the frontend application root.
- `.github/` belongs at the repository root, not inside Backend or FrontEnd.
- Keep backend and frontend dependencies separate.

## 3. Backend Technology Stack

### Core

- Python 3.13
- FastAPI
- Pydantic
- SQLAlchemy Async
- PostgreSQL
- Alembic
- Pandas
- Docker and Docker Compose

### AI

- LangChain
- LangGraph
- Google Gemini
- Ollama
- LangGraph ToolNode
- LangGraph PostgreSQL Checkpointer

### Dependency management

The authoritative backend dependency file is:

`Backend/requirements.txt`

Before adding dependencies:
1. Inspect the existing requirements file.
2. Check whether the library is already installed.
3. Avoid unnecessary upgrades.
4. Preserve compatibility with the existing Python environment.

Do not put frontend dependencies in this file.

## 4. Frontend Technology Stack

The frontend application root is:

`FrontEnd/ClientApp/`

The frontend framework and dependencies must follow the actual implementation selected by the project owner.

Do not assume React, Next.js, Vue, Angular, or another framework without checking the existing application.

Frontend dependencies must be maintained inside the ClientApp directory.

Do not introduce unnecessary dependencies or UI frameworks.

## 5. Backend Architecture

| Component | Responsibility |
|---|---|
| `app/agent/` | Custom agent implementation |
| `app/api/` | REST API routes, dependencies, and schemas |
| `app/database/` | Database models and connection management |
| `app/langchain_integration/` | LangChain and LangGraph integration |
| `app/llm/` | LLM provider abstraction |
| `app/services/` | Application business logic |
| `app/storage/` | Storage abstraction |
| `app/tools/` | Deterministic tools and data analysis |
| `migrations/` | Database migrations |
| `storage/` | Physical uploaded files |

Keep the separation of responsibilities intact.

## 6. Backend Execution

Run backend commands from the `Backend/` directory.

### Activate virtual environment

macOS/Linux:

```bash
source .venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run FastAPI

```bash
uvicorn app.main:agent_app --reload
```

### Run CLI

```bash
python -m app.cli
```

### Swagger

```text
http://127.0.0.1:8000/docs
```

### OpenAPI

```text
http://127.0.0.1:8000/openapi.json
```

### Database migrations

```bash
alembic upgrade head
```

Generate a migration:

```bash
alembic revision --autogenerate -m "describe change"
```

Review generated migrations before applying them.

## 7. REST API Reference

Base prefix:

```text
/api/v1
```

### Messages

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/messages` | Create a conversation and submit its first message |
| POST | `/api/v1/conversations/{conversation_id}/messages` | Continue an existing conversation |
| GET | `/api/v1/conversations/{conversation_id}/messages` | Retrieve message history |

### Conversations

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/conversations` | List conversations |
| GET | `/api/v1/conversations/{conversation_id}` | Retrieve conversation details |
| DELETE | `/api/v1/conversations/{conversation_id}` | Delete a conversation and its checkpoint |
| PUT | `/api/v1/conversations/{conversation_id}/dataset` | Associate a dataset |
| DELETE | `/api/v1/conversations/{conversation_id}/dataset` | Remove dataset association |

Conversation creation is lazy. The first message creates the conversation. There is no separate empty-conversation creation endpoint.

### Files

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/files` | Upload a file |
| GET | `/api/v1/files` | List uploaded files |
| GET | `/api/v1/files/{file_id}` | Retrieve file metadata |
| DELETE | `/api/v1/files/{file_id}` | Delete an uploaded file |
| POST | `/api/v1/files/{file_id}/load` | Load an uploaded file as a dataset |

Supported formats:
- CSV
- XLSX
- XLS

Maximum upload size is controlled by `MAX_UPLOAD_SIZE_MB`.

### API contract rules

The endpoint list above is a reference, not a replacement for actual API definitions.

Before implementing API integration:
1. Inspect the backend route.
2. Inspect the corresponding Pydantic schemas.
3. Check the actual request and response payloads.
4. Verify error handling and HTTP status codes.
5. Use Swagger/OpenAPI as the source of truth.

Never invent API fields or response properties.

## 8. Important API Data Structures

### Message submission response

```json
{
  "conversation_id": "uuid",
  "message": "User message",
  "response": "Assistant response"
}
```

### Conversation history

```json
{
  "conversation_id": "uuid",
  "messages": [
    {
      "role": "user",
      "content": "Analyze the dataset."
    },
    {
      "role": "tool",
      "content": "Tool execution result"
    },
    {
      "role": "assistant",
      "content": "Analysis result"
    }
  ],
  "total": 3
}
```

Supported roles:
- `user`
- `assistant`
- `tool`

Intermediate assistant tool-call instructions are excluded from the simplified history response.

### File metadata

The file response includes:
- `id`
- `original_filename`
- `content_type`
- `file_size`
- `created_at`

### Dataset loading response

The dataset load response includes:
- `dataset_id`
- `filename`
- `rows`
- `columns`
- `column_names`
- `file_size`

The dataset ID corresponds to the uploaded file UUID.

Always verify the actual schemas before using these structures.

## 9. Backend Dataset Management

The backend separates uploaded file storage from runtime DataFrame registration.

### Upload

1. File is received through FastAPI.
2. FileService validates extension and size.
3. LocalStorage saves the physical file.
4. File metadata is stored in PostgreSQL.

### Dataset loading

1. DatasetService retrieves file metadata.
2. The physical file is located in storage.
3. Pandas loads the file.
4. DatasetRegistry registers the DataFrame.
5. The file UUID is used as the dataset ID.

### Conversation association

A dataset can be associated with a conversation.

The conversation's `dataset_id` is the source of truth for its current dataset.

### Automatic recovery

DatasetRegistry is in-memory.

AgentService checks whether the associated dataset is registered before invoking LangGraph. If it is missing, DatasetService reloads it from physical storage.

The frontend must not implement this recovery logic.

## 10. Frontend Responsibilities

The frontend consumes the existing backend REST API.

It must not duplicate backend business logic.

Expected frontend functionality:

1. Conversation sidebar.
2. New conversation interaction.
3. Conversation listing.
4. Conversation selection and resumption.
5. Message submission.
6. Message history retrieval.
7. User, assistant, and tool message rendering.
8. Markdown rendering for assistant responses.
9. File upload.
10. Uploaded file listing.
11. Dataset association.
12. Dataset replacement.
13. Dataset removal.
14. Dataset metadata display.
15. Conversation deletion.
16. Error and loading states.

Implement these features incrementally.

## 11. Frontend API Integration Rules

Create a centralized API client.

Do not scatter direct HTTP requests throughout UI components.

The API client should:
- Use a configurable backend base URL.
- Handle JSON requests and responses.
- Support multipart uploads.
- Handle HTTP errors consistently.
- Use UUIDs for conversation and file identifiers.
- Keep endpoint definitions centralized.

### Conversation lifecycle

1. User selects New Conversation.
2. Do not call an empty conversation creation endpoint.
3. User submits the first message.
4. Call `POST /api/v1/messages`.
5. Store the returned conversation ID.
6. Use the existing conversation endpoint for subsequent messages.
7. Retrieve history using the history endpoint.

### Dataset lifecycle

1. Upload the file.
2. Load it through the dataset load endpoint when required.
3. Associate its UUID with a conversation.
4. Display the associated dataset.
5. Allow replacement or removal.

An uploaded file is not automatically associated with a conversation.

### Message rendering

| Role | Rendering |
|---|---|
| user | User chat bubble |
| assistant | Assistant chat bubble with Markdown |
| tool | Tool result, preferably in a collapsible section |

Preserve chronological ordering.

Do not render intermediate tool-call instructions as ordinary assistant messages.

Do not assume tool responses are final answers.

## 12. Backend and Frontend Separation

The following responsibilities must remain in the backend:

- Agent execution.
- LLM provider selection.
- Tool execution.
- Dataset analysis.
- File validation and persistence.
- Conversation persistence.
- Dataset recovery.
- PostgreSQL operations.
- LangGraph checkpoint management.

The frontend is responsible for:

- UI presentation.
- User interaction.
- Client-side state.
- API communication.
- Rendering conversation messages.
- Upload interactions.
- Displaying analytical outputs.

Do not move backend responsibilities into the frontend.

## 13. Development and Coding Rules

1. Preserve existing working backend code.
2. Do not perform unnecessary refactoring.
3. Do not rename established modules or public methods without approval.
4. Keep API routes thin.
5. Put business logic in services.
6. Keep deterministic analysis separate from LLM reasoning.
7. Maintain compatibility with custom CLI and LangGraph CLI.
8. Keep database operations asynchronous in FastAPI.
9. Use Pydantic schemas for API validation.
10. Use UUIDs for existing resource identifiers.
11. Use Alembic for database schema changes.
12. Keep frontend and backend dependencies separate.
13. Do not hardcode secrets or environment-specific URLs.
14. Do not commit `.env` or uploaded files.
15. Do not silently change existing API contracts.
16. Do not assume authentication exists.
17. Do not create duplicate implementations of existing services.
18. Inspect actual repository files before modifying code.

## 14. Testing and Validation

For backend changes:
- Verify application startup.
- Verify relevant API endpoints.
- Verify database operations.
- Verify LangGraph persistence.
- Check custom CLI compatibility when applicable.
- Test error cases.

For frontend changes:
- Verify API integration.
- Verify loading and error states.
- Verify conversation creation and resumption.
- Verify message ordering.
- Verify file uploads.
- Verify dataset association.
- Verify Markdown rendering.
- Verify responsive layouts.

Do not claim tests passed unless they were actually executed.

## 15. Working Style

Work incrementally and avoid large, unrelated changes.

Before substantial architectural modifications:
1. Explain the proposed approach.
2. Identify affected files.
3. Describe compatibility implications.

Reuse existing implementations wherever possible.

If an important requirement is unclear, ask for clarification instead of making significant assumptions.

The project owner makes architectural decisions. Treat existing implementation decisions as intentional unless instructed otherwise.

Always document any deviations from established patterns or conventions, and provide justification for the changes.