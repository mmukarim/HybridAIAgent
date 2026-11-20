# Hybrid AI Data Analyst Frontend Architecture Plan

## 1. Executive Summary

Build a responsive, chat-first React application that lets a user manage analytical conversations, upload and inspect supported dataset metadata, associate a dataset with a conversation, and review assistant and tool output. Keep all agent execution, file persistence, dataset analysis, and recovery in the FastAPI backend. The frontend should be a separate TypeScript/Vite application under `FrontEnd/ClientApp/`.

The repository currently has no `FrontEnd/ClientApp/` files or package manifest. The backend is actually in lowercase `backend/` (not the `Backend/` path shown in some repository guidance); this plan follows the requested frontend location and the actual backend source.

One product policy is confirmed:

The backend exposes both lazy first-message creation and explicit empty-conversation creation. The owner has confirmed that the frontend should keep both backend operations available but use lazy creation (`POST /api/v1/messages`) for its normal new-conversation flow. The owner has also confirmed that the first message should not include a dataset; association can happen after the conversation exists.

The previously observed response mismatch on `DELETE /api/v1/conversations/{conversation_id}/dataset` has been fixed: the route now returns the updated `ConversationResponse`.

CORS is now configured for `http://localhost:5173` and `http://127.0.0.1:5173` by default, with the allowed-origin list configurable through `CORS_ALLOWED_ORIGINS`.

The user-provided endpoint count of 18 is not reflected in the current API. The implementation and generated OpenAPI schema contain 15 application operations: 6 conversation operations, 3 message operations, 5 file operations, and `/health`. The generated documentation surfaces (`/docs`, `/redoc`, `/openapi.json`) are not additional product API operations.

## 2. Backend API Contract Analysis

### Contract source and common behavior

The inspected route, schema, service, and generated OpenAPI definitions are the source of truth. The API base path is `/api/v1`; identifiers in path and request fields are UUIDs unless otherwise noted. Successful operations and response shapes are described below. FastAPI's generated schema includes `422` validation responses where parameters or request bodies are validated, but most explicitly raised runtime `400` and `404` errors are not declared in OpenAPI.

All message operations await the agent invocation and return a completed response. No streaming, WebSocket, job identifier, or progress endpoint is implemented. Request failures that are not translated by a route may result in a generic server error; the frontend should show a non-sensitive error state and retain the user's draft.

### Endpoint inventory

| Method and endpoint | Request | Success response | Runtime errors and frontend responsibility |
|---|---|---|---|
| `GET /health` | None | `200`: `{status, application}`; current values are `"healthy"` and `"Hybrid AI Agent"` | Network/server failure: show an unavailable or unknown connection state. Polling is unnecessary initially; check on app load and offer retry. |
| `POST /api/v1/conversations` | JSON `ConversationCreate`: optional `title` (defaults to `"New conversation"`, length 1–255) and optional UUID `dataset_id` | `201`: `ConversationResponse` | `422` for validation. No route-level check confirms that an optional `dataset_id` exists; database failures are not normalized here. This endpoint remains available, but the frontend's normal new-conversation path uses lazy creation. |
| `GET /api/v1/conversations` | No query parameters | `200`: `{conversations: ConversationResponse[], total: number}`; ordered by `updated_at` descending | No pagination, filters, or search parameters. Render all returned items and provide client-side search only if needed. |
| `GET /api/v1/conversations/{conversation_id}` | UUID path parameter | `200`: `ConversationResponse` | `404` when missing; `422` for malformed UUID. Load metadata when selecting a conversation or refreshing its details. |
| `DELETE /api/v1/conversations/{conversation_id}` | UUID path parameter | `204`, no body | `404` when missing; `422` for malformed UUID. Confirm before deleting; on success remove the conversation from cache and clear the active thread. |
| `PUT /api/v1/conversations/{conversation_id}/dataset` | JSON `{file_id: UUID}` | `200`: `ConversationResponse` including its updated `dataset_id` | `404` for missing conversation or file; `422` for invalid input. This associates a file record; it does not explicitly load the dataset. |
| `DELETE /api/v1/conversations/{conversation_id}/dataset` | UUID path parameter | `200`: updated `ConversationResponse` with `dataset_id: null` | `404` when conversation is missing. The response body now matches the declared schema. |
| `POST /api/v1/messages` | JSON `MessageCreate`: `{content: string}`; minimum length 1 | `201`: `{conversation_id: UUID, message: string, response: string}` | `422` for validation. Creates a conversation titled from the first message (truncated to 255 characters), invokes the agent, and responds synchronously. It does not accept a dataset ID. |
| `POST /api/v1/conversations/{conversation_id}/messages` | UUID path parameter and JSON `{content: string}` (minimum length 1) | `200`: same `MessageResponse` shape as above | `404` if the conversation is missing; `422` for validation. The route has no separate streaming or execution-status behavior. |
| `GET /api/v1/conversations/{conversation_id}/messages` | UUID path parameter | `200`: `{conversation_id: UUID, messages: [{role: string, content: string}...], total: number}` | `404` for missing conversation; `422` for malformed UUID. Backend history returns user, final assistant, and tool messages in checkpoint order; intermediate assistant tool-call instructions are excluded. The schema types `role` as a general string, not an enum. |
| `POST /api/v1/files` | `multipart/form-data` with required field `file` | `201`: `FileResponse` | `400` for unsupported extension or file size above the configured limit; `422` for missing/invalid multipart input. Supported extensions are `.csv`, `.xlsx`, `.xls`; configured limit is `MAX_UPLOAD_SIZE_MB` (default 50 MB). Show server error detail safely. |
| `GET /api/v1/files` | No query parameters | `200`: `{files: FileResponse[], total: number}`; newest first | No pagination, filtering, or file status field. |
| `GET /api/v1/files/{file_id}` | UUID path parameter | `200`: `FileResponse` | `404` when missing; `422` for malformed UUID. |
| `DELETE /api/v1/files/{file_id}` | UUID path parameter | `204`, no body | `404` when missing; `422` for malformed UUID. Deleting a file referenced by a conversation sets that conversation's `dataset_id` to null through the database foreign key. Warn when the currently loaded conversation list shows references. |
| `POST /api/v1/files/{file_id}/load` | UUID path parameter | `200`: `{dataset_id: string, filename: string, rows: number, columns: number, column_names: string[], file_size: number}` | `404` if the file or physical file is missing; `422` for malformed UUID. Dataset parsing/registration runs synchronously. The response includes metadata, not dataset rows or a load-status field. |

`ConversationResponse` contains `id`, `title`, nullable `dataset_id`, `created_at`, and `updated_at`. `FileResponse` contains `id`, `original_filename`, nullable `content_type`, `file_size`, and `created_at`. Neither schema exposes physical storage paths.

### Contract details and UX implications

- Conversation and file listing responses include totals, but neither endpoint supports pagination or filtering.
- Conversation list order is most recently updated first; file list order is newest created first.
- The conversation's `dataset_id` is the available source of truth for association. File metadata has no loaded/assigned status.
- Upload, dataset load, and conversation association are distinct operations. Loading registers a DataFrame in the backend's in-memory registry; the frontend must not emulate or manage that registry.
- Assignment currently accepts an uploaded file record without requiring a prior explicit load. Agent invocation reloads a missing registered dataset automatically. The UI can still offer an explicit Load action to present returned dataset metadata, but should not claim load state persists across browser sessions.
- The first-message endpoint cannot accept a dataset ID. Per owner direction, the first message is dataset-free; users can associate a dataset with the conversation after that message creates it.
- OpenAPI advertises successful response schemas and validation errors but does not document several route-level `400`/`404` cases. The frontend error layer must handle HTTP statuses and response bodies at runtime rather than depending only on generated types.

## 3. Backend Gaps and Assumptions

### Verified gaps or inconsistencies

1. **CORS origins are environment-specific:** local Vite origins are configured by default, but deployed frontend origins must be set in `CORS_ALLOWED_ORIGINS`.
2. **No authentication or authorization is implemented:** conversations and files are not scoped to users. The interface must not imply privacy or multi-user isolation.
3. **No pagination, search, or sorting controls are supported server-side.**
4. **No loaded-state or processing-state API exists:** loading is synchronous and returns only after parsing/registration; the application cannot query registry state after a reload.
5. **No streaming or asynchronous job API exists:** message generation is synchronous from the client's perspective.
6. **Upload-size configuration is not exposed by an API endpoint:** the default is 50 MB, but deployments may override it.
7. **Runtime errors are incompletely represented in OpenAPI:** explicitly raised status codes need to be handled in the client despite their omission from the generated operation schema.
8. **OpenAPI and prompt endpoint count differ:** there are 15 application operations, not 18, in the inspected implementation/schema.

### Planning assumptions pending confirmation

- Use `POST /api/v1/messages` for normal new conversations; keep the draft local until the first message.
- The first message is dataset-free. Allow dataset association only after the conversation has been created.
- Keep the explicit empty-conversation endpoint available in the API, but do not use it in the frontend's normal new-conversation flow.
- Do not show a durable “loaded” badge. Show metadata returned by the latest explicit load action and treat it as transient client knowledge.
- Use a configurable backend URL. Local Vite origins are allowed by default; configure `CORS_ALLOWED_ORIGINS` for other origins.

## 4. User Journeys

### First-time application use

1. Load the app shell and check `GET /health`.
2. Load `GET /api/v1/conversations` and `GET /api/v1/files`.
3. If there are no conversations, show a concise empty state with a message composer and dataset-library entry point.
4. If there are no files, show a prompt to upload a CSV or Excel file, but keep the primary chat action available.
5. If any initial request fails, retain the shell, show a retryable inline error, and distinguish backend connectivity failure from an empty collection.

### Creating a conversation and asking a question

1. User selects New conversation; clear the current selection and show an unsaved draft view without inventing a UUID.
2. User submits non-empty text.
3. Call `POST /api/v1/messages` for the first message; the first message is dataset-free. On success store the returned `conversation_id`, render the submitted message and returned assistant response, then refresh the conversation list and fetch history if needed.
4. Keep `POST /api/v1/conversations` available in the backend API, but do not use it in the frontend's normal new-conversation flow.
5. While the request is pending, disable duplicate submission, show a pending assistant state, and preserve the submitted text if the call fails.

### Uploading and loading a dataset

1. Open Dataset Library and choose a `.csv`, `.xlsx`, or `.xls` file, or drop it in the upload target.
2. Validate extension in the browser for immediate feedback. Apply an exact client-side size limit only if deployment configuration is made available; otherwise rely on the backend's authoritative size check.
3. Upload as multipart field `file` to `POST /api/v1/files`.
4. Show optional transport upload progress only if implemented with a client that exposes it; this progress represents bytes transferred, not parsing or dataset processing.
5. On success, add the returned metadata and optionally call `POST /api/v1/files/{file_id}/load` when the user requests analysis metadata.
6. Show returned row count, column count, and column names. Do not imply that dataset rows or a preview were returned.

### Assigning, replacing, and removing a conversation dataset

1. Select an existing conversation and read its `dataset_id` from conversation metadata.
2. Choose a file from the library; call `PUT /api/v1/conversations/{id}/dataset` with `{file_id}`.
3. Use the returned `ConversationResponse` to update the visible association. Replacing a dataset is the same operation with another `file_id`.
4. To remove an association, use `DELETE /api/v1/conversations/{id}/dataset` only after the backend response contract is corrected or agreed. Until then, surface a clear error if response validation fails and do not show false success.
5. Explain that explicit loading and association are separate. Backend auto-recovery may load an associated dataset when a later message is handled.

### Revisiting a conversation

1. Select an item from the sidebar list.
2. Fetch conversation metadata and `GET /api/v1/conversations/{id}/messages`.
3. Render returned messages in order, distinguishing `user`, `assistant`, and `tool` roles.
4. Use the conversation's `dataset_id` to label its current association; fetch matching file metadata from the file list or file detail endpoint if needed.
5. Keep the composer available once history is loaded; show a retry action if history retrieval fails.

### Deleting a file or conversation

- Before file deletion, compare its UUID with visible conversation `dataset_id` values and warn if the file is associated. Then call `DELETE /api/v1/files/{id}` and refresh files/conversations. Backend behavior clears the association but leaves conversations intact.
- Before conversation deletion, show a confirmation naming the conversation. Call `DELETE /api/v1/conversations/{id}`; on `204`, remove it from client cache and clear the selected thread. The endpoint also deletes its LangGraph checkpoint.

## 5. Screen and Navigation Design

### Application shell

- **Header:** product name, backend connection state, and a compact accessible menu for settings/help. Do not add a user identity/profile control until authentication exists.
- **Left sidebar (desktop):** New conversation action, searchable client-side conversation list, and Dataset Library entry. Group conversations by recency only if the product wants this; the server does not provide grouping.
- **Main workspace:** selected conversation transcript and composer, or an empty/welcome state when no conversation is selected.
- **Dataset context strip:** current filename and a clear Replace/Remove action when an association exists; otherwise a contextual Attach dataset action.
- **Dataset Library screen or side panel:** uploaded file list, upload/drop target, file metadata, load action, and delete action.

### Navigation

- `/` — empty state or recent conversation chooser.
- `/conversations/:conversationId` — active conversation and history.
- `/datasets` — dataset library; may be implemented as a route or an accessible side panel, but should have a stable deep link if users need to manage files while a conversation is selected.
- Do not add rename, share, account, or settings screens that imply unsupported backend operations.

### Responsive behavior

- At wide widths, keep the conversation sidebar visible beside the transcript.
- At tablet widths, allow the sidebar to collapse while retaining an explicit navigation control.
- On mobile, use a single-column conversation view; expose conversation and dataset navigation through a labeled drawer/sheet, not a permanently compressed sidebar.
- Keep the composer reachable above the on-screen keyboard, use touch-sized controls, and avoid horizontal scrolling for tables or code blocks.

### Empty, loading, and error states

- No conversations: explain that the first sent message creates a conversation under the lazy path.
- No files: explain supported formats and show upload.
- Loading history: stable skeleton or progress indicator that does not look like a real message.
- Agent request pending: show a pending assistant state; do not suggest streaming.
- Network/server failure: show retry and preserve user input.
- Invalid file or oversize: show the server's validation message in accessible text.
- Missing conversation/file: explain that the item may have been deleted and refresh the relevant list.

## 6. Component Architecture

```text
App
├── AppRouter
├── AppShell
│   ├── AppHeader
│   │   ├── BackendStatus
│   │   └── AppMenu
│   ├── ConversationSidebar
│   │   ├── NewConversationButton
│   │   ├── ConversationSearch
│   │   └── ConversationList
│   │       └── ConversationListItem
│   └── MainContent
│       ├── ConversationPage
│       │   ├── ConversationHeader
│       │   ├── DatasetContextBar
│       │   ├── MessageList
│       │   │   └── MessageItem
│       │   │       ├── AssistantMarkdown
│       │   │       └── ToolResult
│       │   └── MessageComposer
│       ├── WelcomePage
│       └── DatasetLibraryPage
│           ├── FileDropzone
│           ├── UploadStatus
│           └── FileList
│               └── FileListItem
├── ConfirmDialog
├── InlineError
└── Toast/LiveRegion
```

Responsibilities:

- **Pages/layouts:** coordinate route-level queries and mutations; do not define endpoint URLs or HTTP details.
- **Feature components:** render conversation, message, and file states; receive typed data and callbacks.
- **Shared feedback components:** accessible errors, confirmations, loading indicators, and notifications.
- **Markdown renderer:** render assistant text with a safe allowlist; keep tool output visually distinct and optionally collapsible.
- **Message composer:** handle local draft, form submission, keyboard interaction, and duplicate prevention.
- **Dataset controls:** use explicit labels for file upload, load, association, and deletion so those operations are never conflated.

## 7. Frontend Project Structure

Recommended initial structure:

```text
FrontEnd/ClientApp/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── public/
│   └── (static assets only)
└── src/
    ├── main.tsx
    ├── app/
    │   ├── App.tsx
    │   ├── router.tsx
    │   └── queryClient.ts
    ├── api/
    │   ├── client.ts
    │   ├── errors.ts
    │   ├── conversations.ts
    │   ├── messages.ts
    │   └── files.ts
    ├── features/
    │   ├── conversations/
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   └── types.ts
    │   ├── chat/
    │   │   ├── components/
    │   │   └── types.ts
    │   └── datasets/
    │       ├── components/
    │       ├── hooks/
    │       └── types.ts
    ├── components/
    │   ├── layout/
    │   └── feedback/
    ├── lib/
    │   └── validation.ts
    ├── styles/
    │   ├── tokens.css
    │   └── global.css
    └── test/
        ├── setup.ts
        └── (test files)
```

Keep modules small and add feature folders only when they have real responsibilities. Maintain the frontend package and dependencies in `FrontEnd/ClientApp/`; do not add frontend dependencies to the Python requirements file.

## 8. State Management Strategy

### Server-owned state

Use TanStack Query for conversations, message history, file lists, file metadata, and mutation lifecycle:

- Query keys: `["conversations"]`, `["conversation", id]`, `["messages", id]`, `["files"]`, and `["file", id]`.
- Invalidate or update conversation/file queries after successful create, association, removal, or deletion mutations.
- Do not maintain a second mutable copy of server-owned titles, dataset IDs, file metadata, or message history.
- Cancel stale history requests when selection changes. Protect the active view from a delayed response for a previously selected conversation.
- Prefer server-confirmed updates over optimistic changes for destructive actions and dataset mutations.

### Local UI state

Keep transient state local or in a small app-level context only where multiple screens need it:

- Active route/conversation selection (URL is the canonical selection).
- Unsaved message draft.
- Sidebar/drawer open state.
- Upload progress and current upload error.
- Temporary metadata from an explicit dataset load.
- Confirmation dialog state.

Do not introduce Redux or a global store before a demonstrated cross-feature need.

## 9. API Integration Design

### Configuration and transport

- Configure the API root with `VITE_API_BASE_URL`; use a development default only for local development and document it in `.env.example`.
- Do not place backend, database, Gemini, or Ollama credentials in frontend environment variables. Any `VITE_` variable is visible to the browser.
- Recommend a single Axios client for JSON and multipart requests, consistent error normalization, cancellation, and browser upload progress. Use `FormData` with the exact field name `file`; allow the browser to set the multipart boundary.
- Use a configurable, generous timeout for agent calls because they are synchronous and can depend on LLM/tool latency. Set upload timeout separately if needed. Confirm deployment/proxy limits. Cancellation stops client waiting but is not proof the backend stopped processing.
- `GET /health` can supply a lightweight connectivity indicator. A failed health check is not a substitute for handling errors on every operation.

### Typed service mapping

Define request/response types to match inspected Pydantic schemas, including nullable fields and the `204` no-body responses. Keep functions in the API layer:

- `listConversations`, `createConversation`, `getConversation`, `deleteConversation`
- `setConversationDataset`, `removeConversationDataset`
- `sendFirstMessage`, `sendConversationMessage`, `getMessageHistory`
- `listFiles`, `getFile`, `uploadFile`, `deleteFile`, `loadDataset`

The message-history role should initially be represented as the backend's string type, then narrowed safely for the known `user | assistant | tool` display cases with an explicit unknown-role fallback. Do not claim server-side role validation.

### Error normalization

Normalize:

- Connection/timeouts/aborted requests.
- HTTP errors with string `detail`.
- FastAPI validation `detail` arrays.
- Empty bodies on `204`.
- Unexpected response shape, especially the currently inconsistent dataset-removal response.

Never turn a failed request into an empty successful list or a successful deletion state. Preserve enough context for retry while avoiding display of stack traces or sensitive server internals.

### Upload progress and cancellation

Axios can report browser-side upload transfer progress where supported. This does not report backend parsing or dataset-registration progress. Since file loading is synchronous with no job/status endpoint, show a busy state only for the duration of the request; do not poll or invent a server-side progress percentage.

## 10. Error Handling and Loading States

| Operation | Pending UI | Failure behavior | Success behavior |
|---|---|---|---|
| Health check | Header shows checking/unknown | Show disconnected/unknown state and retry affordance | Show connected state |
| Conversation list/history | Skeleton or inline loader | Keep current content where possible, show retry | Render server-returned order |
| First/subsequent message | Pending assistant indicator; lock duplicate submission | Keep draft and show retryable error; avoid silently resubmitting | Render the returned response and synchronize history/list |
| Upload | Transfer indicator if available, otherwise indeterminate busy state | Keep selected file for retry; display validation/error message | Add returned file metadata to the list |
| Dataset load | Indeterminate busy state | Show parse/not-found/network error; do not mark as loaded | Show returned dimensions/columns in current client view |
| Dataset association/removal | Disable conflicting dataset actions | Preserve prior confirmed association and explain failure | Update from confirmed response |
| Delete | Confirmation then pending state | Keep item visible and allow retry | Remove after `204`, then refresh related state |

For accessibility, provide text in addition to color/icon state, announce important asynchronous results through a polite live region, and ensure dialogs restore focus on close.

## 11. Security Considerations

- Treat the backend base URL as configuration, never a secret.
- Do not expose LLM credentials or backend credentials in the browser.
- No authentication is implemented; do not represent the deployment as multi-user private or expose it to untrusted users without an independently designed backend authentication/authorization layer.
- Browser extension and size checks are convenience only. The backend remains authoritative; file MIME type may be null or client-supplied and is not proof of content.
- Render assistant Markdown with raw HTML disabled and a sanitization plugin such as `rehype-sanitize`. Do not use `dangerouslySetInnerHTML`; use safe link behavior and constrain URLs. Keep code blocks as text.
- Avoid logging conversation contents, file contents, or sensitive analytical output to browser telemetry.
- CORS allows the configured origins only; local defaults are `http://localhost:5173` and `http://127.0.0.1:5173`. Configure deployed origins through `CORS_ALLOWED_ORIGINS`; do not use permissive wildcard CORS as a shortcut for credentialed access.
- Use HTTPS for deployed API traffic and configure production CSP/security headers at the hosting/reverse-proxy layer.

## 12. Testing Strategy

### Unit tests

- API error normalization for string and validation-array details, empty `204`, network failure, cancellation, and unexpected response.
- File extension/size presentation validation.
- Message role rendering fallback and Markdown sanitization behavior.
- Dataset association display based on nullable `dataset_id`.

### Component tests

Use Vitest and React Testing Library for:

- Conversation list empty/loading/error/loaded states.
- Composer prevents duplicate submissions and retains draft on failure.
- User, assistant, and tool message rendering in chronological order.
- File upload success, validation failure, and delete confirmation.
- Dataset attach/replace/remove UI including server-confirmed updates.
- Responsive navigation controls and accessible dialog behavior.

Mock API calls at the network boundary (for example with MSW) so tests cover request/response contracts without depending on a running model or database.

### Integration and end-to-end tests

- Verify API client paths, payloads, multipart field name, and `204` handling against a test backend or OpenAPI contract.
- Add Playwright flows for first message, conversation revisit, file upload/load/associate, replacement/removal, and deletion.
- Keep external LLM calls out of deterministic UI tests; use a controlled backend stub/test fixture for predictable responses.
- Include a smoke build and TypeScript check in CI. Do not treat a successful frontend build as proof of backend compatibility.

## 13. Implementation Roadmap

### Phase 1: Frontend foundation and application layout

- **Objectives:** establish the React/TypeScript/Vite app, environment configuration, routing, accessible shell, and responsive baseline.
- **Features/components:** header, backend status placeholder, sidebar, empty state, mobile navigation.
- **API dependencies:** `GET /health`, `GET /api/v1/conversations`.
- **Order:** scaffold app; configure router/styles; add shell and empty/loading/error states; verify responsive behavior.
- **Acceptance criteria:** app starts/builds; no secrets or production URLs are bundled; navigation works at mobile and desktop widths; empty state is distinct from failure.

### Phase 2: API integration foundation

- **Objectives:** add typed API client, environment URL, normalized errors, request cancellation, query client, and test harness.
- **Features/components:** API transport/services, query keys, shared error presentation.
- **API dependencies:** all operation contracts listed above, with initial tests focused on health and conversation/file list.
- **Order:** define types from schemas; implement client and error handling; add query provider; write network-boundary tests.
- **Acceptance criteria:** API root is configurable; all non-2xx responses are surfaced; `204` is handled without JSON parsing; no API call is embedded in presentation components.

### Phase 3: Conversation management

- **Objectives:** load/select conversations, start a draft, and delete conversations.
- **Features/components:** sidebar list, selection route, confirmation dialog, loading/empty/error states.
- **API dependencies:** list/get/delete conversation; use the first-message endpoint to create conversations lazily.
- **Order:** implement list/select/history route state; add deletion; create a local draft and persist it only when the first message is sent.
- **Acceptance criteria:** selected ID is reflected in the URL; list order follows server; delete handles `204`; no rename control is shown.

### Phase 4: Chat and message integration

- **Objectives:** send first and subsequent messages and render history safely.
- **Features/components:** transcript, message item, tool result, Markdown renderer, composer, pending/error state.
- **API dependencies:** first-message, conversation-message, and history endpoints.
- **Order:** history rendering; first/subsequent routing; duplicate prevention and retry; Markdown/code rendering and role fallback.
- **Acceptance criteria:** first message stores returned conversation ID; subsequent requests target that ID; response/history order is preserved; no streaming UI is shown; draft survives failure.

### Phase 5: Dataset management

- **Objectives:** manage uploaded file metadata and explicit load results.
- **Features/components:** Dataset Library, dropzone, file list/detail, upload status, delete confirmation.
- **API dependencies:** list/get/upload/delete file and load dataset.
- **Order:** list/empty state; multipart upload; display metadata; explicit load action; delete and related-state refresh.
- **Acceptance criteria:** only supported extensions are offered; server size validation is surfaced; exact `file` multipart field is used; load metadata is displayed without claiming durable loaded status.

### Phase 6: Conversation and dataset integration

- **Objectives:** show, attach, replace, and remove the current conversation's dataset.
- **Features/components:** dataset context strip, selection dialog/panel, association warning and errors.
- **API dependencies:** conversation detail/list, set/remove association, file metadata, optional explicit load.
- **Order:** show current ID/file label; attach and replace; support removal using the corrected conversation response.
- **Acceptance criteria:** conversation `dataset_id` is authoritative; the first message is dataset-free; upload/load/association remain distinct; failures never produce a success-shaped UI.

### Phase 7: UI refinement, responsive behavior, and accessibility

- **Objectives:** polish analytical workflow readability and accessible interaction.
- **Features/components:** responsive sidebar/drawer, keyboard navigation, focus management, live announcements, typography and spacing refinement.
- **API dependencies:** none beyond existing operations.
- **Order:** test breakpoints; audit keyboard/focus; tune long Markdown/table/code output; refine error and confirmation copy.
- **Acceptance criteria:** core flows work on mobile/desktop; important state is not conveyed by color alone; dialogs and navigation are keyboard accessible.

### Phase 8: Testing and production preparation

- **Objectives:** verify operation contracts and prepare a deployable frontend.
- **Features/components:** unit/component/E2E suites, environment documentation, build checks, deployment proxy/CORS plan.
- **API dependencies:** all used endpoints and agreed backend fixes.
- **Order:** run checks; exercise end-to-end flows against controlled backend; verify production API routing, CORS, HTTPS, and CSP.
- **Acceptance criteria:** CI build/type checks and selected tests pass; no API secrets are bundled; deployment configuration documents API origin and file-size expectation; unresolved backend gaps are either fixed or explicitly excluded from UX.

## 14. Technical Decisions

| Area | Recommendation | Alternatives considered / rationale |
|---|---|---|
| Framework/build | React + TypeScript + Vite | Matches the requested React frontend and is suitable for a separate client-rendered app. Next.js SSR is not needed for this internal analytical workspace and would add a second server/runtime. |
| Routing | React Router | Clear URL-addressable conversation selection and a dataset-library route. A single conditional view would make refresh/deep links and navigation state less reliable. |
| Server state | TanStack Query | Handles request lifecycle, cache invalidation, and cancellation without duplicating server state in Redux or custom contexts. |
| HTTP client | Axios | Central intercept/error handling, cancellation, and optional browser upload progress. Native `fetch` is viable for JSON, but upload progress typically requires additional browser plumbing. |
| UI state | Component state and URL; minimal context if needed | Keeps drafts, drawers, and dialogs local; avoids premature global-state frameworks. |
| Styling | CSS modules or organized plain CSS with design tokens | Responsive design without a mandatory UI framework or utility-system dependency. Reassess after an initial screen implementation. |
| Icons | Lucide React | Consistent, tree-shakeable icon set; pair every icon-only button with an accessible label. |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize` | Supports tables and common Markdown while avoiding unsafe raw HTML. Defer a heavyweight syntax-highlighting dependency unless needed. |
| Tests | Vitest + React Testing Library + MSW; Playwright for E2E | Fits Vite and allows isolated component/API tests plus a small set of real user-flow tests. |

Confirm package versions at implementation time and maintain all frontend dependencies in the ClientApp package manifest.

## 15. Open Questions

1. Which non-local frontend origins should be added to `CORS_ALLOWED_ORIGINS` for staging and production?
2. Is the API intended only for a trusted single-user environment? If not, what authentication, authorization, and per-user data isolation are planned before deployment?
3. Should the backend expose configured maximum upload size and dataset load status, or should the frontend rely on deployment configuration and transient load results?
4. What request/proxy timeout is appropriate for synchronous agent generation, and should cancellation terminate backend work or only client waiting?
5. The endpoint inventory has 15 operations despite the supplied count of 18. Are there additional intended APIs not currently present?
6. Should file deletion warn based on the client-loaded conversation list only, or should the backend expose association details/guardrails for a race-safe confirmation?
7. Should explicit empty conversation creation validate an initial `dataset_id` consistently with the association endpoint?

---

This is a planning document only. No frontend application code, package files, or dependencies have been created or changed.
