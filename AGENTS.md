# AGENTS.md

## Cursor Cloud specific instructions

### Overview

CollabBoard is a real-time collaborative whiteboard web application. It uses a single Express server that serves both the API and the Vite-powered React frontend in development mode. There is no separate frontend dev server process — `npm run dev` starts everything.

### Running the dev server

```
npm run dev
```

This starts Express + Vite HMR on port 3000 (configurable via `PORT` env var). The app is available at `http://localhost:3000`.

### Available npm scripts

See `package.json` for the full list. Key scripts:
- `npm run dev` — Start dev server (Express + Vite HMR)
- `npm run check` — TypeScript type checking (`tsc`)
- `npm run build` — Production build (Vite client + esbuild server)

### Important notes

- **No database required for development**: The app uses in-memory storage (`MemStorage` in `server/storage.ts`). PostgreSQL is only needed for `npm run db:push` (Drizzle schema migrations) but is not required for the app to run.
- **No lint command**: The project does not have a dedicated ESLint config or lint script. Type checking via `npm run check` (`tsc`) is the primary static analysis tool.
- **No test suite**: The project does not include automated tests.
- **P2P collaboration is browser-only**: Real-time collaboration uses WebRTC (BroadcastChannel + RTCPeerConnection). No server-side signaling or WebSocket server is needed.
- **Lockfile**: The project uses `package-lock.json` (npm). Use `npm install` for dependency management.
