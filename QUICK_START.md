# 🚀 Intella Quick Start Guide

## What is Intella?

**Intella** is your personal AI browsing assistant that:
- 🧠 **Remembers** pages you visit (smart summarization)
- 💬 **Chats** with you about your browsing history
- ✍️ **Improves** your writing in any text field
- 🔒 **Respects** your privacy (local-first, optional cloud sync)

## ⚡ 30-Second Setup

### 1. Install Dependencies & Build

```bash
cd apps/intella
npm install
npm run build
```

### 2. Load in Browser

**Chrome/Edge:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `apps/intella/dist` folder

**Done!** Intella icon should appear in your toolbar 🎉

## 🎯 Try These First

### 1. Capture a Memory
- Visit any interesting webpage
- Wait 3 seconds
- Click Intella icon → See it in "Recent Memories"

### 2. Ask Intella Anything
- Press `Cmd+Shift+I` (Mac) or `Ctrl+Shift+I` (Windows)
- Type: "Summarize this page"
- Get instant AI response

### 3. Improve Your Writing
- Select text in any input field
- See Intella popup appear
- Click "Improve", "Professional", "Fix Grammar", etc.
- Click "Accept" to replace text

### 4. Control Privacy
- Click Intella icon
- Toggle eye icon to hide/show for current site
- Intella won't capture when hidden

## ⚙️ Optional: Connect Mielto API

For full AI features (summarization, chat, etc.):

1. Click Intella icon → Settings (gear icon)
2. Enter:
   - **API URL**: `http://localhost:8000` (or your Mielto URL)
   - **API Key**: Your API key
   - **Workspace ID**: Your workspace ID
3. Click "Save Settings"

## 📖 Full Documentation

- **[README.md](./README.md)** - Complete feature overview
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Detailed setup
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical deep dive
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Implementation status

## 🐛 Not Working?

**Memory not captured?**
- ✅ Check "Auto Capture" is ON in settings
- ✅ Ensure site visibility is enabled (eye icon)
- ✅ Make sure page has enough content

**Sidebar not showing?**
- ✅ Check "Sidebar" is enabled in settings
- ✅ Try the keyboard shortcut again
- ✅ Refresh the page

**AI features not working?**
- ✅ Configure API settings (see Optional section above)
- ✅ Ensure Mielto backend is running
- ✅ Check browser console for errors

## 🎉 You're Ready!

Start browsing and Intella will:
- ✅ Remember important pages
- ✅ Answer questions about your history
- ✅ Help you write better
- ✅ Keep everything private

**Enjoy your AI-powered browsing experience!** 🧠✨

---

**Quick Commands:**
- `Cmd/Ctrl + Shift + I` - Toggle sidebar
- Right-click text → Ask Intella
- Select text in input → Get writing help

