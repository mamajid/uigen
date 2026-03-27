# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, Claude generates them, and a live iframe preview renders the result in real-time.

## Commands

```bash
# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Development server (uses Turbopack + node-compat polyfill)
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Tests
npm run test

# Reset database
npm run db:reset
```

To run a single test file: `npx vitest src/lib/__tests__/file-system.test.ts`

## Architecture

### Core Data Flow

```
User message → ChatContext → POST /api/chat → Claude (streamText)
                                                    ↓
                                         AI Tools (str_replace_editor, file_manager)
                                                    ↓
                                         FileSystemContext (in-memory virtual FS)
                                         ├── FileTree (display)
                                         ├── CodeEditor (Monaco)
                                         └── PreviewFrame → JSX Transformer (Babel) → iframe
```

### Key Architectural Decisions

**Virtual File System** — `src/lib/file-system.ts` is a pure in-memory FS (no disk writes). Files only persist when saved to the database as serialized JSON on the `Project.data` field. The `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) is the React layer that wraps this and executes Claude's tool calls.

**AI Tool Integration** — Claude manipulates files via two tools defined in `src/lib/tools/`:
- `str_replace_editor`: create/view/edit/insert into files
- `file_manager`: rename/delete files and directories

These tools are registered in `/api/chat/route.ts` and their execution is handled by `FileSystemContext`.

**Live Preview** — `src/lib/transform/jsx-transformer.ts` uses Babel to compile React/JSX into browser-executable JS, builds an import map for React and Tailwind CDN, and generates a standalone HTML document injected into an iframe. Every file system change triggers a re-render.

**AI Provider** — `src/lib/provider.ts` wraps `@ai-sdk/anthropic` (claude-haiku-4-5 model). If `ANTHROPIC_API_KEY` is not set, it falls back to a `MockLanguageModel` that returns realistic sample code — useful for development without an API key.

**Authentication** — JWT sessions via `jose` library, stored as HttpOnly cookies (7-day expiry). `src/lib/auth.ts` handles signing/verification. `middleware.ts` protects routes. Server actions in `src/actions/` handle sign-up/sign-in with bcrypt password hashing.

**Project Persistence** — `Project` model stores messages as JSON string (`messages` field) and virtual FS state as JSON string (`data` field). Projects can be anonymous (no `userId`) or owned by a user.

### State Management

- **FileSystemContext** — virtual file state, selected file, tool execution
- **ChatContext** — conversation messages, streaming state, project persistence calls

Both contexts are provided in `src/app/main-content.tsx`, which is the three-panel layout (chat | preview | code editor).

### Every generated project must have `/App.jsx` as the root entry point

The system prompt (`src/lib/prompts/generation.tsx`) instructs Claude to:
- Always create `/App.jsx` as the root entry
- Style exclusively with Tailwind CSS (no hardcoded styles)
- Use `@/` import alias for non-library files
- Never create HTML files

### Database (Prisma + SQLite)

Schema has two models: `User` (email, bcrypt password) and `Project` (name, userId?, messages JSON, data JSON). After schema changes, run `npx prisma migrate dev`.

### Testing

Vitest + React Testing Library + jsdom. Tests are co-located under `__tests__/` folders next to the code they test.
