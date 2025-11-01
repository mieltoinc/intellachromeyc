# 🚀 Getting Started with Intella

Welcome to Intella! This guide will help you set up and start using your smart memory browser extension.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Node.js** (version 18 or higher)
- **npm**, **pnpm**, or **yarn** package manager
- A modern browser: **Chrome**, **Edge**, or **Firefox**
- (Optional) A running instance of **Mielto Context API** for AI features

## 🔧 Installation Steps

### Step 1: Install Dependencies

Navigate to the Intella directory and install dependencies:

```bash
cd apps/intella

# Using npm
npm install

# Or using pnpm
pnpm install

# Or using yarn
yarn install
```

### Step 2: Build the Extension

Build the extension for production:

```bash
npm run build
```

This will create a `dist` directory with the compiled extension files.

### Step 3: Load Extension in Browser

#### For Chrome/Edge:

1. Open your browser and navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. **Enable Developer Mode** (toggle in the top right corner)

3. Click **"Load unpacked"**

4. Select the `apps/intella/dist` directory

5. The Intella icon should appear in your browser toolbar! 🎉

#### For Firefox:

1. Navigate to `about:debugging#/runtime/this-firefox`

2. Click **"Load Temporary Add-on..."**

3. Navigate to `apps/intella/dist` and select the `manifest.json` file

4. The extension will load (note: it's temporary and will be removed when you restart Firefox)

### Step 4: Configure Intella

1. **Click the Intella icon** in your browser toolbar

2. Click the **Settings icon** (gear icon)

3. Configure your settings:

   **Basic Setup (Works Without API):**
   - Leave API settings empty for local-only mode
   - Enable/disable Auto Capture
   - Toggle Sidebar and Inline Assistant

   **Full AI Features (Requires Mielto):**
   - Set **API URL** to your Mielto instance (e.g., `http://localhost:8000`)
   - Add your **API Key** (get this from your Mielto workspace)
   - Add your **Workspace ID**

4. Click **"Save Settings"**

## 🎯 First Steps

### Test Auto Capture

1. Visit any interesting webpage (e.g., a news article, blog post, or documentation page)

2. Wait a few seconds (Intella processes the page in the background)

3. Click the **Intella icon** to see your captured memory in "Recent Memories"

4. Click **"View all memories & settings"** to see the full memory viewer

### Try Ask Intella Sidebar

1. On any webpage, press:
   - **Mac**: `Cmd + Shift + I`
   - **Windows/Linux**: `Ctrl + Shift + I`

2. The Intella sidebar will slide in from the right

3. Try asking:
   - "Summarize this page"
   - "What are the key points?"
   - "Find that article about AI I read last week"

4. Click the **Memories tab** to search your captured pages

### Control Site Visibility

1. Visit a site you **don't** want Intella to remember (e.g., banking, email)

2. Click the **Intella icon**

3. Click the **eye icon** to toggle visibility

4. When the eye has a slash (👁️‍🗨️ → 🚫👁️), Intella won't capture anything from that site

## 💡 Tips & Tricks

### Keyboard Shortcuts

- **Toggle Sidebar**: `Cmd+Shift+I` / `Ctrl+Shift+I`
- More shortcuts coming soon!

### Context Menu (Right-Click)

Right-click on any webpage to access:
- **Ask Intella** (with selected text)
- **Summarize with Intella**
- **Improve text** (in editable fields)
- **Translate**

### Search Memories

In the popup or settings page:
1. Use the search bar to find memories by:
   - Title
   - Summary
   - Keywords
   - URL

2. Results update in real-time as you type

### Manage Storage

To clear all memories:
1. Open **Settings** (click Intella icon → gear icon)
2. Go to **Memories** tab
3. Click **"Clear All"** button
4. Confirm the action

### Privacy Mode

Intella automatically respects your privacy:
- ✅ No capture in **Incognito/Private** windows
- ✅ Per-site visibility control
- ✅ Local-first storage (your data stays on your device)
- ✅ Optional cloud sync (only if you configure API)

## 🔄 Development Mode

If you're developing Intella:

### Watch Mode

```bash
npm run watch
```

This rebuilds the extension automatically when you edit files.

### After Code Changes

1. Go to `chrome://extensions/`
2. Click the **refresh icon** on the Intella extension card
3. Reload any open tabs to see changes

### View Logs

**Background Worker Logs:**
1. Go to `chrome://extensions/`
2. Click **"Inspect views: background page"** under Intella
3. Check the Console tab

**Content Script Logs:**
1. Open DevTools on any webpage (F12)
2. Check Console for messages starting with "Intella..."

**Storage Inspector:**
1. Open DevTools → **Application** tab
2. Go to **IndexedDB** → `intella-db`
3. Inspect `memories`, `settings`, and `siteVisibility` stores

## 🐛 Troubleshooting

### Extension Not Loading

**Problem**: Extension doesn't appear after loading

**Solutions**:
- Ensure you selected the `dist` directory (not the root)
- Check for build errors: `npm run build`
- Look for errors in `chrome://extensions/`

### Memories Not Being Captured

**Problem**: Pages aren't being saved automatically

**Solutions**:
- Check that **Auto Capture** is enabled in Settings
- Verify **Site Visibility** is on (eye icon in popup)
- Make sure you're not in private/incognito mode
- Check the page has enough content (>200 characters)
- Look for console errors in DevTools

### AI Features Not Working

**Problem**: Summarization, chat, or other AI features fail

**Solutions**:
- Verify your **API URL** is correct and accessible
- Check your **API Key** is valid
- Ensure your **Workspace ID** is correct
- Confirm the Mielto backend is running
- Look for API errors in the background worker console

### Sidebar Not Appearing

**Problem**: Keyboard shortcut doesn't show sidebar

**Solutions**:
- Check that **Sidebar** is enabled in Settings
- Try closing and reopening the tab
- Check for JavaScript errors in the page console
- Ensure the shortcut isn't conflicting with another extension

## 📚 Next Steps

Now that you're set up, explore:

1. **[README.md](./README.md)** - Full feature overview
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical documentation
3. **Settings Page** - Customize your Intella experience
4. **Memory Viewer** - Browse and search your captured pages

## 🎉 You're All Set!

Intella is now capturing your browsing memories and ready to assist you. Happy browsing! 🧠✨

---

**Need Help?**
- Check the main Mielto documentation
- Open an issue on GitHub
- Review the troubleshooting section above

**Contributing?**
- See [README.md](./README.md) for contribution guidelines
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details

