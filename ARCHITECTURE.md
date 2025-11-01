# Intella Architecture Documentation

## Overview

Intella is a Chrome extension (Manifest V3) that captures, stores, and retrieves web browsing memories using local IndexedDB storage and optional cloud sync via the Mielto Context API.

## Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Tab                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Content Script                       │  │
│  │  - DOM Reader (extract page content)             │  │
│  │  - Sidebar Component (React)                     │  │
│  │  - Inline Assistant (future)                     │  │
│  └──────────────┬───────────────────────────────────┘  │
└─────────────────┼───────────────────────────────────────┘
                  │ chrome.runtime.sendMessage
                  ▼
┌─────────────────────────────────────────────────────────┐
│          Background Service Worker                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Message Router                                  │  │
│  │  - SAVE_MEMORY, GET_MEMORIES, etc.              │  │
│  │  - Context menu handlers                         │  │
│  │  - Keyboard shortcut handlers                    │  │
│  └──────────┬───────────────────┬───────────────────┘  │
└─────────────┼───────────────────┼───────────────────────┘
              │                   │
              ▼                   ▼
    ┌─────────────────┐  ┌──────────────────┐
    │  IndexedDB      │  │  Mielto API      │
    │  (Local)        │  │  (Optional)      │
    │  - memories     │  │  - Chat          │
    │  - settings     │  │  - Contents      │
    │  - visibility   │  │  - Search        │
    └─────────────────┘  └──────────────────┘
              ▲
              │
              │ chrome.runtime.sendMessage
              │
┌─────────────┴───────────────────────────────────────────┐
│                  Popup UI                               │
│  - Quick stats & recent memories                        │
│  - Site visibility toggle                               │
│  - Quick actions (Ask Intella)                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  Options Page                           │
│  - Memory management (CRUD)                             │
│  - Settings configuration                               │
│  - Privacy controls                                     │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Page Visit → Memory Capture

```
User visits page
      │
      ▼
Content script loads
      │
      ├─→ Check if page is capturable (DOMReader.isCapturable)
      ├─→ Check site visibility (getSiteVisibility)
      ├─→ Check auto-capture setting (getSettings)
      │
      ▼
Extract page content (DOMReader)
      │
      ├─→ Title, description, headings
      ├─→ Main content (cleaned text)
      ├─→ Keywords extraction
      │
      ▼
Send to background for AI analysis
      │
      ├─→ Mielto API: Summarize content
      ├─→ Mielto API: Extract entities
      │
      ▼
Create Memory object
      │
      ├─→ id: unique identifier
      ├─→ url, title, summary
      ├─→ keywords, entities
      ├─→ timestamp
      │
      ▼
Save to IndexedDB (local)
      │
      └─→ Optional: Sync to Mielto backend
```

### 2. Ask Intella Sidebar

```
User triggers sidebar (Cmd+Shift+I)
      │
      ▼
Sidebar component mounts
      │
      ├─→ Load recent memories
      ├─→ Initialize chat state
      │
      ▼
User sends message
      │
      ├─→ Search relevant memories (context)
      ├─→ Send question + context to background
      │
      ▼
Background calls Mielto API
      │
      ├─→ POST /v1/chat/completions
      ├─→ Include memories as context
      │
      ▼
Display AI response
      │
      └─→ Update chat history
```

### 3. Memory Search

```
User searches memories (popup or options page)
      │
      ▼
Send SEARCH_MEMORIES message
      │
      ▼
Background → Storage Manager
      │
      ├─→ Query IndexedDB
      ├─→ Filter by title, summary, keywords, URL
      │
      ▼
Return filtered memories
      │
      └─→ Display in UI
```

## Storage Schema

### IndexedDB: `intella-db`

#### Object Store: `memories`
```typescript
{
  id: string;                    // Primary key
  url: string;                   // Page URL (indexed)
  title: string;
  summary: string;
  content?: string;
  keywords: string[];            // Indexed (multiEntry)
  entities?: {
    people?: string[];
    organizations?: string[];
    topics?: string[];
  };
  timestamp: string;             // ISO date (indexed)
  lastAccessed?: string;
  accessCount?: number;
  archived?: boolean;
  collection_id?: string;
  meta_data?: Record<string, any>;
}
```

#### Object Store: `settings`
```typescript
{
  // Key: 'user-settings'
  apiUrl: string;
  apiKey?: string;
  workspace_id?: string;
  enableAutoCapture: boolean;
  enableSidebar: boolean;
  enableInlineAssistant: boolean;
  sidebarShortcut: string;
  privacyMode: 'all' | 'whitelist' | 'blacklist';
  siteVisibility: Record<string, boolean>;
}
```

#### Object Store: `siteVisibility`
```typescript
{
  domain: string;                // Primary key
  isVisible: boolean;
  timestamp: string;
}
```

## Message Passing Protocol

All messages follow this structure:

```typescript
interface Message<T = any> {
  type: MessageType;
  payload?: T;
  requestId?: string;
}

interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}
```

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `SAVE_MEMORY` | Content → Background | Save a new memory |
| `GET_MEMORIES` | Any → Background | Get all memories |
| `DELETE_MEMORY` | Any → Background | Delete a memory by ID |
| `UPDATE_MEMORY` | Any → Background | Update memory properties |
| `SEARCH_MEMORIES` | Any → Background | Search memories by query |
| `GET_SETTINGS` | Any → Background | Get user settings |
| `UPDATE_SETTINGS` | Any → Background | Update settings |
| `TOGGLE_SITE_VISIBILITY` | Any → Background | Toggle site visibility |
| `GET_SITE_VISIBILITY` | Any → Background | Get visibility for domain |
| `TOGGLE_SIDEBAR` | Background → Content | Show/hide sidebar |
| `ANALYZE_PAGE` | Content → Background | Analyze page with AI |
| `ASK_INTELLA` | Any → Background | Ask AI a question |

## Mielto API Integration

### Endpoints Used

#### 1. Chat Completions (OpenAI-compatible)
```
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer {apiKey}
X-Workspace-ID: {workspace_id}

{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Used for:**
- Page summarization
- Entity extraction
- Chat responses
- Text improvement

#### 2. Content Storage
```
POST /api/v1/contents
Content-Type: application/json
Authorization: Bearer {apiKey}
X-Workspace-ID: {workspace_id}

{
  "collection_id": "intella-memories",
  "content": "...",
  "meta_data": {
    "url": "...",
    "title": "...",
    "summary": "...",
    "keywords": [...],
    "entities": {...}
  }
}
```

**Used for:**
- Syncing memories to cloud
- Backup and cross-device sync

#### 3. Content Search
```
GET /api/v1/contents?search={query}
Authorization: Bearer {apiKey}
X-Workspace-ID: {workspace_id}
```

**Used for:**
- Searching cloud-stored memories
- Cross-device memory retrieval

## Security & Privacy

### Data Storage
- **Primary**: IndexedDB (local browser storage)
- **Backup**: Chrome Sync Storage (settings only)
- **Optional Cloud**: Mielto API (user-controlled)

### Privacy Features
1. **Per-site visibility**: Users control which sites are captured
2. **Private mode detection**: No capture in incognito/private windows
3. **Local-first**: All data stored locally by default
4. **Optional sync**: Cloud sync requires explicit API configuration

### Permissions
```json
{
  "permissions": [
    "storage",           // Local storage
    "activeTab",         // Current tab access
    "scripting",         // Content script injection
    "tabs",              // Tab management
    "contextMenus"       // Right-click menu
  ],
  "host_permissions": [
    "<all_urls>"         // Access all sites (with user control)
  ]
}
```

## Performance Considerations

### Memory Capture
- **Debounced**: 3-second delay after page load
- **Content limit**: Max 10,000 characters per page
- **Rate limiting**: Max 1 capture per page per session

### Storage
- **IndexedDB**: Efficient for large datasets
- **Indexed fields**: url, timestamp, keywords
- **Cleanup**: Optional auto-cleanup for old memories

### API Calls
- **Batching**: Group related API calls
- **Caching**: Cache AI responses for same queries
- **Fallback**: Graceful degradation if API unavailable

## Future Enhancements

### Phase 4: Inline Writing Assistant
- Detect active text fields
- Show floating action menu on text selection
- Integrate text improvement API
- Support for:
  - Grammar/spelling fixes
  - Tone adjustment
  - Length modification
  - Translation

### Additional Features
- **Memory tagging**: User-defined tags
- **Collections**: Group related memories
- **Sharing**: Share memories with team
- **Export**: Export memories as markdown/JSON
- **Import**: Import bookmarks/reading lists
- **Analytics**: Memory usage statistics
- **Smart suggestions**: Proactive memory recall

## Testing Strategy

### Unit Tests
- Storage manager CRUD operations
- DOM reader extraction logic
- API client request/response handling
- Message routing logic

### Integration Tests
- End-to-end memory capture flow
- Sidebar interaction with background
- Settings persistence
- API integration

### Manual Testing Checklist
- [ ] Install extension in Chrome
- [ ] Visit various websites (news, docs, blogs)
- [ ] Verify memories are captured
- [ ] Test sidebar chat functionality
- [ ] Toggle site visibility
- [ ] Update settings
- [ ] Search memories
- [ ] Delete memories
- [ ] Test keyboard shortcuts
- [ ] Test private mode behavior

## Debugging

### View Extension Logs
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Find Intella and click "Inspect views: background page"
4. Open the Console tab

### View Content Script Logs
1. Open DevTools on any webpage (F12)
2. Console tab will show content script logs
3. Look for "Intella content script initialized"

### View Storage
1. Open DevTools → Application tab
2. IndexedDB → intella-db
3. Inspect memories, settings, siteVisibility stores

### Common Issues
- **Memory not captured**: Check auto-capture setting, site visibility
- **AI not working**: Verify API URL, key, workspace ID in settings
- **Sidebar not showing**: Check keyboard shortcut, enableSidebar setting

---

Last updated: October 2025

