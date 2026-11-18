---
applyTo: "FrontEnd/ClientApp/**/*"
---

# Frontend Development Instructions — HybridAgent

## 1. Application Context

This directory contains the frontend client application for HybridAgent.

The backend is a separate Python application located in `Backend/`.

The frontend must communicate with the backend through its REST API.

Do not implement AI-agent execution, database operations, dataset analysis, or file persistence in the frontend.

## 2. Framework and Dependencies

First inspect the existing ClientApp structure and package manifest.

Follow the framework and versions already selected by the project owner.

Do not:
- Change the framework without approval.
- Replace the existing build system.
- Add unnecessary dependencies.
- Mix Python dependencies into the frontend project.

## 3. Application Architecture

Keep frontend responsibilities separated into appropriate modules.

Recommended logical responsibilities:

- Pages and layouts.
- Reusable UI components.
- API client.
- API endpoint definitions.
- Type definitions.
- Client-side state management.
- Utilities.
- Styles.
- Tests.

Adapt these responsibilities to the selected framework rather than introducing an unnecessary architecture.

## 4. API Integration

Backend base URL must be configurable through environment variables.

Do not hardcode production or development API URLs throughout the application.

Use a centralized API client for:
- Conversation operations.
- Message submission.
- Message history.
- File uploads.
- Dataset association.
- Conversation deletion.

Inspect actual backend schemas and Swagger before defining TypeScript types or frontend data models.

Never invent request or response fields.

Handle:
- Network failures.
- HTTP errors.
- Invalid responses.
- Loading states.
- Empty states.

## 5. Conversation Management

Support:
- Starting a new conversation.
- Listing conversations.
- Selecting an existing conversation.
- Continuing a conversation.
- Retrieving conversation history.
- Deleting conversations.

New conversations use lazy creation.

Do not generate conversation UUIDs on the client.

The first submitted message must call:

`POST /api/v1/messages`

Subsequent messages must call:

`POST /api/v1/conversations/{conversation_id}/messages`

Retrieve history using:

`GET /api/v1/conversations/{conversation_id}/messages`

## 6. Chat Interface

Render the following message roles:

- `user`
- `assistant`
- `tool`

Preserve message ordering.

Assistant messages should support Markdown formatting, including:
- Headings.
- Paragraphs.
- Lists.
- Tables.
- Code blocks.
- Inline code.

Tool responses should be visually distinguishable from normal assistant responses. A collapsible tool-result section is preferred.

Do not treat tool responses as final assistant answers.

Provide appropriate loading indicators during message submission.

Avoid sending duplicate messages because of repeated clicks or accidental form submission.

## 7. File and Dataset Management

Support CSV, XLSX, and XLS uploads.

Use multipart/form-data for uploads.

Implement:
- File upload.
- Uploaded file listing.
- File metadata display.
- Dataset loading.
- Dataset association with conversations.
- Dataset replacement.
- Dataset removal.
- File deletion.

Do not assume uploading a file automatically associates it with a conversation.

The conversation's dataset association is the source of truth.

Do not attempt to manage the backend DatasetRegistry from the frontend.

## 8. UI and UX

Build a clean, professional AI-agent interface.

Prioritize:
- Clear conversation navigation.
- Readable message history.
- Good spacing and typography.
- Responsive layouts.
- Accessible controls.
- Clear loading and error feedback.
- Consistent component design.

Avoid unnecessary visual complexity.

Do not add decorative features that interfere with the main conversation workflow.

## 9. State Management

Keep client-side state predictable.

Separate:
- Current conversation ID.
- Conversation list.
- Message history.
- Current input.
- Upload state.
- Selected or associated dataset.
- Loading and error states.

Avoid duplicating server-owned state unnecessarily.

After conversation changes, ensure the UI reflects the latest server state.

## 10. Security

- Never expose backend API keys or LLM credentials.
- Never place secrets in frontend environment variables that are bundled into public client code.
- Do not hardcode private backend credentials.
- Do not assume backend authentication exists.
- Do not treat frontend validation as a replacement for backend validation.

## 11. Development Rules

1. Inspect existing code before changing it.
2. Reuse established components and patterns.
3. Avoid unnecessary refactoring.
4. Keep API calls out of presentation components where practical.
5. Use reusable components.
6. Keep types aligned with actual API schemas.
7. Handle all relevant loading and error states.
8. Maintain responsive behavior.
9. Avoid introducing unnecessary dependencies.
10. Test important user workflows.

Implement features incrementally and preserve working functionality.

Do not introduce breaking changes to existing workflows without proper handling and user feedback.