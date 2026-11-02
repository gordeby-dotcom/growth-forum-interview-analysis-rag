# Growth Forum · Interview Analysis

Frontend captured from the original Replit application, with Replit analytics removed.

## Preview

Run `python3 -m http.server 8000 --directory public` and open http://localhost:8000. The original password screen is preserved; authentication requires the backend described below.

## Backend integration

The frontend expects these same-origin endpoints:

| Route | Purpose |
| --- | --- |
| POST /api/auth | Exchange a password for an authentication token |
| GET /api/check-auth | Validate the X-Auth-Token header |
| POST /api/chat | Analyze conversation messages against source documents |
| POST /api/upload | Accept a multipart .md or .txt document |
| POST /api/export | Generate a Word document from an analysis |

Interview/research content, server prompts, AI integration, and backend implementation will be added separately. No credentials or interview document contents are included. The loaded-document names in the captured HTML are labels from the original app, not bundled documents.

Conversation history is stored in browser localStorage. Markdown rendering loads marked 9 from jsDelivr, and typography loads Inter from Google Fonts.
