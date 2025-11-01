# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Development watch mode (rebuilds on changes)
npm run watch

# Production build  
npm run build

# Type checking only
npm run type-check
```

## Build System

- **Build Tool**: Vite 5 with TypeScript
- **Output**: `build/` directory (ready for browser loading)
- **Framework**: React 18 + TypeScript + Tailwind CSS
- **Path Aliases**: `@/*` maps to `./src/*`

## Extension Architecture

This is a **Chrome Extension (Manifest V3)** with these core components:

### 1. Background Service Worker (`src/background/index.ts`)
- Message routing between content scripts and popup/options
- Handles: SAVE_MEMORY, GET_MEMORIES, ASK_INTELLA, etc.
- Chrome APIs: context menus, keyboard shortcuts, storage

### 2. Content Scripts (`src/content/`)
- `index.tsx`: Main content script, DOM analysis, sidebar injection
- `sidebar.tsx`: React sidebar component with chat and memory search
- `styles.css`: Isolated styling for content scripts

### 3. Extension Pages
- `src/popup/`: Quick access popup (stats, recent memories, site toggle)
- `src/options/`: Full settings page with memory management

### 4. Core Utilities
- `src/utils/storage.ts`: IndexedDB manager with three stores (memories, settings, siteVisibility)
- `src/utils/api.ts`: Mielto API client for AI features
- `src/utils/domReader.ts`: DOM content extraction

## Data Flow

1. **Memory Capture**: Content script → DOMReader → Background → Storage + Mielto API
2. **Sidebar Chat**: User question → Search relevant memories → Background → Mielto API → Response
3. **Settings**: Popup/Options → Background → Storage/Chrome Storage Sync

## Storage Schema

### IndexedDB (`intella-db`)
- **memories**: `{id, url, title, summary, keywords, entities, timestamp, ...}`
- **settings**: User preferences and API configuration
- **siteVisibility**: Per-domain capture toggles

### Chrome Storage Sync
- Cross-device settings synchronization

## Message Passing

All inter-component communication uses typed messages:
```typescript
// src/types/messages.ts
interface Message<T = any> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}
```

Key message types: `SAVE_MEMORY`, `GET_MEMORIES`, `ASK_INTELLA`, `TOGGLE_SIDEBAR`, `UPDATE_SETTINGS`

## API Integration

Integrates with **Mielto Context API**:
- `POST /v1/chat/completions` - OpenAI-compatible chat
- `POST /api/v1/contents` - Memory storage/sync
- `GET /api/v1/contents?search=` - Memory search

API client handles authentication, workspace context, and graceful fallbacks.

## Development Setup

1. **Build the extension**: `npm run build`
2. **Load in Chrome**: 
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the `build/` directory

## Key Features

- **Memory Capture**: Automatic page analysis and storage
- **Ask Intella Sidebar**: `Cmd+Shift+I` floating AI assistant  
- **Per-site Visibility**: Domain-based capture control
- **Local-first**: IndexedDB primary storage, optional cloud sync
- **Privacy**: No capture in incognito mode

## Common Tasks

- **Add new message type**: Update `src/types/messages.ts` and background message router
- **Modify storage schema**: Update `src/utils/storage.ts` and increment DB version
- **Add API endpoint**: Extend `src/utils/api.ts` MieltoAPI class
- **Keyboard shortcuts**: Defined in `manifest.json` commands section

## Type Safety

Strict TypeScript with proper typing for:
- Chrome Extension APIs (`@types/chrome`)
- IndexedDB operations (`idb` library)
- API requests/responses
- Message passing protocol