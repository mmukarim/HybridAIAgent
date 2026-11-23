# HybridAgent frontend

The frontend is a React, TypeScript, and Vite application.

```sh
cd FrontEnd/ClientApp
npm ci
npm run dev
```

Open the URL printed by Vite. Run `npm run build` to type-check and create a production build, or `npm run preview` to serve an existing build locally.

The development server uses `http://127.0.0.1:8000` as its default backend URL. To use another backend, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to its HTTP or HTTPS URL. Restart Vite after changing it. For production builds, set this variable at build time; it is required outside development. Vite variables are public: never put credentials or secrets in them.

The backend must be running for the connection indicator. Its `CORS_ALLOWED_ORIGINS` must include the frontend origin; the default backend configuration allows `http://localhost:5173` and `http://127.0.0.1:5173`. If Vite selects another port, add that origin to the backend configuration.

Run `npm test` for frontend tests. The indicator checks `/health` when the app loads and can be retried if the backend is unavailable. It does not guarantee that every backend operation will succeed.

The sidebar lists saved conversations and lets you open one or start a local, unsaved conversation. The first message creates a conversation; subsequent messages use that conversation. History shows user and assistant messages; preceding tool results can be opened from their assistant response. Unmatched tool results and unsupported roles remain available separately without being attributed to an assistant response. A selected conversation can be deleted after confirmation; this permanently removes its saved history.

On small screens, use the menu button to open navigation; Escape closes it and returns focus to the button. Tool-result dialogs also close with Escape. Code blocks can receive keyboard focus for horizontal scrolling.

The dataset library supports CSV, XLSX, and XLS upload, file listing and deletion, and an explicit load action that displays returned row and column metadata for the current page session. Uploading or loading a file does not associate it with a conversation. After the first message creates a conversation, use its dataset controls to attach, replace, or remove an uploaded file. Explicit loading is optional and remains separate; the backend handles dataset recovery. Deleting a file clears its associations with conversations. The backend enforces the configured upload-size limit. For production, serve `index.html` for `/conversations/*` and `/datasets` routes so links work on refresh.

API requests time out after 120 seconds (5 seconds for the health check). A timeout or client-side cancellation does not guarantee the backend stopped processing a request. Failed message drafts are retained; check the conversation list or history before resending to avoid duplicates. Drafts are kept in memory only and are lost on page reload.
