---
applyTo: "Backend/**/*.py,Backend/**/*.toml,Backend/**/*.ini,Backend/**/*.txt,Backend/**/*.yml,Backend/**/*.yaml,Backend/**/*.sql"
---

# Backend Development Instructions

## 1. Project Overview

This directory contains the backend of HybridAgent, a hybrid AI agent application.

The backend supports:
- A custom agent implementation.
- A LangGraph-based agent implementation.
- Multiple LLM providers through a provider abstraction.
- Tool-based mathematical, text, and dataset analysis.
- Business insights and report generation.
- FastAPI-based REST APIs.
- PostgreSQL persistence.
- LangGraph conversation checkpointing.
- File uploads and reusable datasets.
- Conversation and message history management.

When modifying the backend, preserve the existing architecture and functionality unless a change is explicitly requested.

## 2. Backend Directory Structure

The expected structure is:

```text
Backend/
├── app/
│   ├── agent/
│   ├── api/
│   │   ├── routes/
│   │   └── schemas/
│   ├── database/
│   ├── langchain_integration/
│   ├── llm/
│   ├── services/
│   ├── storage/
│   ├── tools/
│   ├── samplesales.csv
│   ├── cli.py
│   ├── config.py
│   └── main.py
├── migrations/
├── storage/
│   └── uploads/
├── requirements.txt
├── alembic.ini
├── docker-compose.yml
└── .env
```

Important:
- Keep the Python package directory lowercase: `app`.
- Existing imports use the `app.*` namespace.
- The FastAPI application is exposed as `agent_app` in `app/main.py`.
- The default sample dataset is `app/samplesales.csv`.
- The actual project files are the source of truth. Do not assume every directory or module exists without checking.

## 3. General Development Rules

- Follow the existing coding style and architecture.
- Prefer focused, incremental changes over large refactoring.
- Do not rewrite working modules unnecessarily.
- Do not introduce duplicate services, utilities, or abstractions.
- Reuse existing classes, functions, dependencies, and schemas where appropriate.
- Maintain clear separation of responsibilities.
- Use descriptive names for variables, functions, classes, and modules.
- Add type hints to new functions and methods.
- Add docstrings where they improve clarity.
- Handle expected errors explicitly.
- Avoid broad exception handling that hides the original error.
- Do not hardcode API keys, credentials, file paths, or environment-specific configuration.
- Do not add a dependency unless it is necessary.
- Before changing an existing interface, identify all its callers and assess the impact.

## 4. Python Conventions

- Use the existing Python version and dependency constraints.
- Follow PEP 8 conventions.
- Use `pathlib.Path` for filesystem operations.
- Use `uuid.UUID` for UUID-based identifiers where appropriate.
- Prefer asynchronous operations for I/O-bound operations.
- Do not use blocking database or network operations inside asynchronous request handlers.
- Avoid unnecessary synchronous wrappers around asynchronous functions.
- Use clear exception types and meaningful error messages.
- Keep business logic out of CLI entrypoints and API route handlers.

## 5. Application Architecture

Maintain the separation between these layers:

### API Layer
Location: `app/api/`

Responsibilities:
- Define HTTP endpoints.
- Validate incoming requests.
- Call service-layer methods.
- Convert service results into response schemas.
- Translate expected application errors into appropriate HTTP responses.

Routes should remain lightweight. Do not implement complex business logic directly inside route handlers.

### Service Layer
Location: `app/services/`

Responsibilities:
- Implement application-level business logic.
- Coordinate database operations, storage, datasets, and agent execution.
- Handle interactions between different backend components.
- Keep API-specific concerns out of service classes.

Existing services include:
- `AgentService`
- `ConversationService`
- `FileService`
- `DatasetService`

Reuse these services rather than duplicating their responsibilities.

### Agent Layer
Location: `app/agent/`

Responsibilities:
- Maintain the custom agent implementation.
- Execute the custom agent workflow.
- Generate responses and reports.

Preserve compatibility with the existing custom agent CLI workflow.

### LangChain and LangGraph Integration
Location: `app/langchain_integration/`

Responsibilities:
- Configure LangChain model integrations.
- Define LangChain tools.
- Build and execute the LangGraph agent.
- Manage agent state and tool execution.

Keep LangGraph-specific implementation details within this integration layer wherever practical.

### LLM Layer
Location: `app/llm/`

Responsibilities:
- Provide an abstraction for LLM providers.
- Implement supported provider integrations.
- Centralize provider selection and configuration.

Do not couple application services directly to a specific provider when an existing abstraction can be used.

### Tools Layer
Location: `app/tools/`

Responsibilities:
- Implement reusable agent tools.
- Perform calculations, text analysis, dataset analysis, chart generation, and business reporting.
- Keep tool logic independent of API route implementation.

Tools should have clear input/output contracts and handle invalid inputs appropriately.

## 6. FastAPI Conventions

- Use the existing `agent_app` FastAPI instance.
- Preserve the current application lifespan initialization and shutdown behavior.
- Access initialized application resources through `request.app.state` or the existing dependency functions.
- Do not create new database managers, agents, or storage instances for every request.
- Use FastAPI dependency injection for shared services and resources.
- Keep request and response models in the existing schema structure.
- Use Pydantic models for request validation and response serialization.
- Use appropriate HTTP status codes.
- Follow the existing API versioning convention: `/api/v1`.
- Do not change existing endpoint contracts without an explicit requirement.

The application lifespan currently initializes shared resources such as:
- Database manager.
- LangGraph checkpointer manager.
- Dataset registry.
- Agent.
- File storage.

Preserve this initialization pattern when extending the application.

## 7. Agent and LangGraph Conventions

The application supports two execution modes:

1. Custom agent.
2. LangGraph agent.

Both execution modes must remain functional.

### LangGraph

- Build the graph through the existing agent factory/build function.
- Reuse the existing state definition.
- Preserve existing tool names and descriptions unless a change is required.
- Use the existing tool-injection mechanism for conversation-specific dataset context.
- Preserve conversation thread IDs when invoking the graph.
- Use the configured checkpointer in API execution.
- Keep CLI execution compatible with the existing in-memory checkpointing approach.

### Dataset Context

- Dataset context is associated with a conversation.
- Use the conversation's `dataset_id` when invoking the LangGraph agent.
- Do not expose internal injected state parameters as unnecessary LLM tool arguments.
- Ensure datasets are available in the registry before executing dataset-dependent tools.
- Preserve automatic dataset recovery after application restarts.

### Tool Development

When adding a new tool:
1. Identify whether it belongs in the custom agent, LangChain integration, or reusable tools layer.
2. Implement its core functionality in the appropriate module.
3. Define a clear input/output contract.
4. Register it with the appropriate agent.
5. Add validation and error handling.
6. Test it independently and through agent execution.

Do not silently remove or rename existing tools.

## 8. Database and Persistence

The backend uses:
- PostgreSQL.
- SQLAlchemy asynchronous sessions.
- ORM models.
- Alembic migrations.
- LangGraph PostgreSQL checkpoint persistence.

### Database Rules

- Use the existing database manager and session dependencies.
- Use asynchronous SQLAlchemy operations in asynchronous application workflows.
- Follow the existing ORM model conventions.
- Keep database access out of API route handlers.
- Use transactions appropriately.
- Handle missing records explicitly.
- Preserve existing foreign-key relationships and deletion behavior.
- Avoid creating duplicate database models for existing entities.

### Database Migrations

When modifying database models:

1. Update the relevant ORM model.
2. Generate or create an Alembic migration.
3. Review the generated migration before applying it.
4. Ensure the migration supports the intended schema change.
5. Consider existing records and nullable/default constraints.
6. Test migration upgrade behavior.
7. Provide a downgrade path where practical.

Never assume that changing an ORM model automatically updates the database.

Do not modify existing migration history unnecessarily.

## 9. Conversation Management

The application uses lazy conversation creation.

Important behavior:
- Do not create an empty conversation when the user opens the application.
- The first message creates a conversation.
- Subsequent messages continue an existing conversation.
- Conversation history is persisted through LangGraph checkpointing.
- Conversations can be listed, retrieved, and deleted.
- A conversation can be associated with a dataset.
- A conversation can have its dataset association removed.

Preserve this behavior unless explicitly requested otherwise.

When changing conversation logic, consider:
- Conversation database records.
- LangGraph thread IDs.
- Checkpoint deletion.
- Message history retrieval.
- Dataset association.
- Conversation deletion behavior.

## 10. File and Dataset Management

### File Management

The backend supports CSV and Excel uploads.

Existing responsibilities:
- Validate allowed file extensions.
- Enforce the configured maximum upload size.
- Store physical files through the storage abstraction.
- Persist file metadata in PostgreSQL.
- Retrieve and delete uploaded files.

Use the existing storage abstraction:
- `BaseStorage`
- `LocalStorage`

Do not couple file services directly to local filesystem implementation when the storage abstraction is available.

Do not trust client-provided MIME types as the only file validation mechanism.

Avoid exposing internal storage paths in API responses.

### Dataset Management

The application uses an in-memory `DatasetRegistry`.

Responsibilities:
- Register DataFrames.
- Retrieve datasets by ID.
- Retrieve dataset metadata.
- List registered datasets.
- Remove datasets.

Dataset IDs should remain consistent with the file IDs when datasets are loaded from uploaded files.

When implementing dataset-related features:
- Reuse the existing `DatasetService`.
- Reuse the existing `DatasetRegistry`.
- Preserve dataset recovery after application restart.
- Validate that the physical file exists before loading it.
- Handle invalid files and unsupported formats appropriately.
- Do not create a separate dataset registry without a clear architectural reason.

## 11. API Design and Existing Contracts

The existing API is organized under `/api/v1`.

The established endpoint responsibilities include:

### Messages and Conversations

- `POST /api/v1/messages`
- `POST /api/v1/conversations/{conversation_id}/messages`
- `GET /api/v1/conversations`
- `GET /api/v1/conversations/{conversation_id}`
- `DELETE /api/v1/conversations/{conversation_id}`
- `GET /api/v1/conversations/{conversation_id}/messages`
- `PUT /api/v1/conversations/{conversation_id}/dataset`
- `DELETE /api/v1/conversations/{conversation_id}/dataset`

### Files

- `POST /api/v1/files`
- `GET /api/v1/files`
- `GET /api/v1/files/{file_id}`
- `DELETE /api/v1/files/{file_id}`
- `POST /api/v1/files/{file_id}/load`

Before changing or extending these APIs:
- Inspect the actual route definitions.
- Inspect the corresponding Pydantic schemas.
- Check service-layer behavior.
- Preserve response structures unless explicitly asked to change them.
- Consider frontend compatibility.

The actual OpenAPI specification and implemented routes are the source of truth if they differ from this documentation.

## 12. Configuration and Environment Variables

- Use the existing configuration module.
- Read environment-specific values from configuration rather than hardcoding them.
- Keep secrets in `.env` or the appropriate secret-management mechanism.
- Do not commit `.env` files or credentials.
- Update `.env.example` or equivalent documentation when adding configuration variables.
- Validate required configuration during application startup where appropriate.

Examples of configurable settings include:
- Database connection.
- LLM provider and model.
- API credentials.
- File storage path.
- Maximum upload size.

Do not introduce multiple configuration mechanisms for the same setting.

## 13. Error Handling and Logging

- Return meaningful errors to API clients.
- Use appropriate HTTP exceptions at the API boundary.
- Keep internal exceptions and HTTP-specific exceptions separated.
- Do not expose stack traces, secrets, database credentials, or internal filesystem paths to clients.
- Use structured or consistent logging where practical.
- Log important failures with sufficient context for debugging.
- Avoid logging API keys, access tokens, uploaded file contents, or other sensitive data.

## 14. Testing Requirements

When adding or changing functionality, test the affected layer.

Recommended coverage:

- Unit tests for services and reusable tools.
- Tests for input validation and error conditions.
- Tests for API endpoints.
- Database integration tests for persistence-related changes.
- Agent execution tests for new or modified tools.
- File and dataset loading tests.
- Regression tests for existing behavior.

For agent-related changes, verify both custom and LangGraph execution modes when applicable.

For conversation-related changes, verify:
- First-message conversation creation.
- Continuing an existing conversation.
- Message history retrieval.
- Conversation deletion.
- Checkpoint cleanup.

For dataset-related changes, verify:
- Dataset registration.
- Dataset loading.
- Dataset association with conversations.
- Dataset recovery after application restart.
- Dataset removal.

Do not claim that tests passed unless they were actually executed.

## 15. CLI Compatibility

The backend must continue supporting both existing CLI modes:

- Custom agent CLI.
- LangGraph agent CLI.

Preserve the existing CLI entrypoint and invocation pattern:

```bash
python -m app.cli
```

When modifying agent construction, tool registration, provider configuration, or dataset initialization, consider the impact on both CLI and API execution.

Do not introduce API-only assumptions into shared agent components.

## 16. Dependency Management

- Reuse installed dependencies where possible.
- Do not add alternative libraries for functionality already supported by the project.
- Update `requirements.txt` when adding a new runtime dependency.
- Ensure version compatibility with the existing Python environment.
- Avoid unnecessary upgrades of major dependency versions.
- Explain why a new dependency is needed.

## 17. Docker and Deployment

- Preserve the existing Docker Compose setup.
- Keep database and application configuration environment-driven.
- Ensure storage paths work correctly inside containers.
- Consider persistent volumes for PostgreSQL and uploaded files.
- Do not assume container filesystem data is persistent without a volume.
- Avoid changing database image versions or volume layouts without assessing migration implications.

## 18. Rules for Future Backend Changes

Before implementing a requested change:

1. Inspect the existing implementation.
2. Identify the relevant modules and dependencies.
3. Explain the proposed change briefly.
4. Identify any affected APIs, database models, services, agents, or CLI workflows.
5. Implement the smallest appropriate change.
6. Preserve existing behavior unless the requirement explicitly changes it.
7. Update schemas, migrations, and documentation when necessary.
8. Run relevant tests or provide precise manual verification steps.

When the existing implementation differs from these instructions, inspect the code and determine whether the documentation is outdated before making changes.

Do not invent files, classes, functions, endpoints, or configuration settings.

If a requirement is ambiguous or could affect existing architecture, ask for clarification before making a major design decision.

## 19. Important Architectural Principles

Always prioritize:

1. Maintainability.
2. Separation of concerns.
3. Reusability.
4. Backward compatibility.
5. Reliability and error handling.
6. Extensibility for future frontend and authentication integration.
7. Minimal, well-tested changes.

The backend is currently designed as a single-user application without authentication. Do not introduce authentication or authorization assumptions unless explicitly requested.

The frontend is maintained separately under `FrontEnd/ClientApp`. Keep the backend independent of frontend implementation details and maintain stable API contracts for frontend integration.

Always consider the impact of backend changes on both the CLI and API consumers, and ensure that modifications do not break existing workflows unless explicitly intended.