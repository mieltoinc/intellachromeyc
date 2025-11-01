# 🧠 Intella - Smart Memory Browser Extension

Intella is an intelligent browser extension that enhances your browsing and chat experiences by remembering key details from your web activity. It integrates seamlessly with the Mielto Context API to provide contextual AI assistance, smart summaries, and personalized memory recall.

## ✨ Features

### 🧩 Browser Memory
- **Automatic page capture**: Saves key details, summaries, and entities from pages you visit
- **Smart summarization**: AI-powered content analysis and summarization
- **Entity extraction**: Identifies people, organizations, and topics
- **Per-site visibility control**: Toggle memory capture on/off for specific domains

### 💬 Ask Intella Sidebar
- **Floating AI assistant**: Access help on any page with `Cmd+Shift+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
- **Contextual responses**: Leverages your browsing memories for better answers
- **Page summaries**: Quickly understand what a page is about
- **Memory search**: Find and recall pages you've visited

### ✍️ Inline Writing Help *(Coming Soon)*
- **Text improvement**: Enhance your writing in any text field
- **Rewrite assistance**: Professional tone, clarity improvements
- **Translation**: Quick text translation

### 🔒 Privacy & Control
- **Local-first**: All memories stored locally in IndexedDB
- **Optional cloud sync**: Sync to your Mielto workspace if configured
- **Per-site visibility**: Fine-grained control over what's captured
- **Private mode respect**: No capture in incognito/private windows

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Chrome, Edge, or Firefox browser
- Mielto Context API (optional, for AI features)

### Installation

1. **Clone the repository**
   ```bash
   cd apps/intella
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in browser**

   **Chrome/Edge:**
   1. Open `chrome://extensions/` (or `edge://extensions/`)
   2. Enable "Developer mode"
   3. Click "Load unpacked"
   4. Select the `apps/intella/dist` directory

   **Firefox:**
   1. Open `about:debugging#/runtime/this-firefox`
   2. Click "Load Temporary Add-on"
   3. Select the `manifest.json` file in `apps/intella/dist`

### Development

```bash
# Watch mode (rebuilds on file changes)
npm run watch

# Type checking
npm run type-check

# Format code
npm run format
```

## ⚙️ Configuration

### Mielto API Setup

1. Click the Intella icon in your browser toolbar
2. Click the settings (gear) icon
3. Go to the "Settings" tab
4. Configure:
   - **API URL**: Your Mielto instance URL (e.g., `http://localhost:8000`)
   - **API Key**: Your Mielto API key (optional)
   - **Workspace ID**: Your workspace ID (optional)

### Enable/Disable Features

In Settings, you can toggle:
- **Auto Capture**: Automatically save page memories
- **Sidebar**: Enable the Ask Intella sidebar
- **Inline Assistant**: Enable inline writing help (coming soon)

### Per-Site Visibility

- Click the Intella icon while on any website
- Click the eye icon to toggle visibility for that domain
- When hidden (eye with slash), Intella won't capture anything from that site

## 📁 Project Structure

```
apps/intella/
├── src/
│   ├── background/          # Service worker
│   │   └── index.ts
│   ├── content/             # Content scripts
│   │   ├── index.tsx
│   │   ├── sidebar.tsx
│   │   └── styles.css
│   ├── popup/               # Extension popup
│   │   ├── index.html
│   │   └── popup.tsx
│   ├── options/             # Settings page
│   │   ├── index.html
│   │   └── options.tsx
│   ├── types/               # TypeScript types
│   │   ├── memory.ts
│   │   └── messages.ts
│   └── utils/               # Utilities
│       ├── storage.ts       # IndexedDB manager
│       ├── api.ts           # Mielto API client
│       └── domReader.ts     # DOM extraction
├── icons/                   # Extension icons
├── manifest.json            # Extension manifest
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🛠️ Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Storage**: IndexedDB (via idb)
- **Icons**: Lucide React
- **Browser APIs**: Chrome Extension Manifest V3

## 🔧 API Integration

Intella integrates with the Mielto Context API for AI features:

### Chat Completions
```typescript
POST /api/v1/chat/completions
{
  "messages": [
    { "role": "user", "content": "Summarize this page" }
  ]
}
```

### Memory Storage
```typescript
POST /api/v1/contents
{
  "collection_id": "intella-memories",
  "content": "...",
  "meta_data": {
    "url": "...",
    "title": "...",
    "summary": "..."
  }
}
```

## 🎯 Keyboard Shortcuts

- **Toggle Sidebar**: `Cmd+Shift+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)

## 📝 Development Roadmap

### Phase 1: Extension Skeleton ✅
- [x] Manifest V3 setup
- [x] Content script & background worker
- [x] Popup and options page UI
- [x] Domain visibility toggle

### Phase 2: Memory Capture ✅
- [x] DOM extraction & summarization
- [x] IndexedDB storage
- [x] Memory viewer in Settings (CRUD)

### Phase 3: Ask Intella Sidebar ✅
- [x] Floating sidebar component
- [x] Chat interface
- [x] Memory search integration

### Phase 4: Inline Writing Assistant 🚧
- [ ] Text field detection
- [ ] Inline action menu
- [ ] Text improvement API integration

### Phase 5: Privacy & Settings ✅
- [x] Per-site visibility controls
- [x] Settings management
- [x] Privacy information

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is part of the Mielto ecosystem. See the root LICENSE file for details.

## 🐛 Troubleshooting

### Extension not working
1. Check that the extension is enabled in `chrome://extensions/`
2. Look for errors in the extension's service worker console
3. Ensure the Mielto API URL is correct in settings

### Memory capture not working
1. Verify auto-capture is enabled in settings
2. Check that site visibility is enabled (eye icon in popup)
3. Ensure you're not in private/incognito mode

### AI features not working
1. Verify API URL, API Key, and Workspace ID are configured
2. Check that your Mielto backend is running
3. Look for errors in the browser console

## 📞 Support

For issues and questions:
- Open an issue in the main Mielto repository
- Check the documentation at `/backend/docs/`
- Review the Mielto API documentation

---

Built with ❤️ using React, TypeScript, and the Mielto Context API

