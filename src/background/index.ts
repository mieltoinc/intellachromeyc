/**
 * Background Service Worker for Intella
 * Handles message routing, context menus, and keyboard shortcuts
 */

import { Message, MessageResponse, MessageType } from '@/types/messages';
import { storage } from '@/utils/storage';
import { mieltoAPI } from '@/utils/api';
import { Memory } from '@/types/memory';
import { mieltoAuth } from '@/lib/auth';
import { mossClient } from '@/utils/moss-client';
import { toolRegistry } from '@/utils/tool-registry';
import { MemoryToolsProvider } from '@/utils/providers/memory-tools-provider';
import { BrowserToolsProvider } from '@/utils/providers/browser-tools-provider';
import { ComposioToolsProvider } from '@/utils/providers/composio-tools-provider';

// Initialize tool providers and Moss client on browser startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Browser startup - initializing services...');
  try {
    // Initialize tool providers
    await toolRegistry.registerProvider(new MemoryToolsProvider());
    await toolRegistry.registerProvider(new BrowserToolsProvider());
    await toolRegistry.registerProvider(new ComposioToolsProvider());
    console.log('✅ Tool providers initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize tool providers:', error);
  }
  
  try {
    await mossClient.initialize();
  } catch (error) {
    console.warn('⚠️ Failed to initialize Moss on startup:', error);
  }
});

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Intella extension installed');

  // Initialize tool providers
  try {
    await toolRegistry.registerProvider(new MemoryToolsProvider());
    await toolRegistry.registerProvider(new BrowserToolsProvider());
    console.log('✅ Tool providers initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize tool providers:', error);
  }

  // Initialize Moss client
  try {
    await mossClient.initialize();
  } catch (error) {
    console.warn('⚠️ Failed to initialize Moss on install:', error);
  }

  // Configure side panel to open on action click
  if (chrome.sidePanel) {
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log('Side panel configured to open on icon click');
    } catch (error) {
      console.log('Could not configure side panel behavior:', error);
    }
  }

  // Create context menu items
  chrome.contextMenus.create({
    id: 'intella-ask',
    title: 'Ask Intella',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'intella-open-sidepanel',
    title: 'Open Intella',
    contexts: ['page', 'selection'],
  });

  chrome.contextMenus.create({
    id: 'intella-summarize',
    title: 'Summarize with Intella',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'intella-improve',
    title: 'Improve text',
    contexts: ['selection', 'editable'],
  });

  chrome.contextMenus.create({
    id: 'intella-translate',
    title: 'Translate',
    contexts: ['selection'],
  });
});

// Note: chrome.action.onClicked doesn't fire when default_popup is set in manifest
// Instead, the popup checks settings and redirects to side panel if needed

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case 'intella-ask':
      if (info.selectionText) {
        // Capture the selected text and save as memory
        await handleCaptureAndSave({
          content: info.selectionText,
          selectedText: info.selectionText,
          url: tab.url || '',
          title: tab.title || '',
          elementType: 'selection'
        });

        // Then open sidebar with the selected text
        chrome.tabs.sendMessage(tab.id, {
          type: MessageType.ASK_INTELLA,
          payload: { text: info.selectionText },
        });
      }
      break;

    case 'intella-summarize':
      chrome.tabs.sendMessage(tab.id, {
        type: MessageType.SUMMARIZE_PAGE,
      });
      break;

    case 'intella-improve':
      if (info.selectionText) {
        chrome.tabs.sendMessage(tab.id, {
          type: MessageType.IMPROVE_TEXT,
          payload: { text: info.selectionText },
        });
      }
      break;

    case 'intella-translate':
      if (info.selectionText) {
        chrome.tabs.sendMessage(tab.id, {
          type: MessageType.TRANSLATE_TEXT,
          payload: { text: info.selectionText },
        });
      }
      break;

    case 'intella-open-sidepanel':
      await handleToggleSidebar();
      break;

    case 'intella-toggle-sidebar':
      chrome.tabs.sendMessage(tab.id, {
        type: MessageType.TOGGLE_SIDEBAR,
      });
      break;
  }
});

// Note: Chrome Side Panel API handles its own toggle behavior

// Note: Chrome's native side panel is handled automatically by the browser
// Users can click the extension icon or use the native side panel toggle

// Function to handle sidebar toggling with proper open/close logic
async function handleToggleSidebar() {
  try {
    const window = await chrome.windows.getCurrent();
    if (!window.id) {
      console.error('❌ No current window found');
      return;
    }

    const windowId = window.id;

    if (chrome.sidePanel) {
      // For Chrome Side Panel API, we'll always try to open
      // Chrome handles the toggling behavior automatically
      console.log('📱 Opening side panel...');
      await chrome.sidePanel.open({ windowId });
      console.log('✅ Side panel opened successfully');
    } else {
      // Fallback to injected sidebar for older browsers
      console.log('🔄 Using fallback injected sidebar toggle');
      const [tab] = await chrome.tabs.query({ active: true, windowId });

      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: MessageType.TOGGLE_SIDEBAR,
        }).then(() => {
          console.log('✅ Toggle message sent to content script');
        }).catch((error) => {
          console.error('❌ Failed to send message to content script:', error);
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to toggle sidebar:', error);
  }
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
});

async function handleMessage(message: Message, _sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  try {
    switch (message.type) {
      case MessageType.SAVE_MEMORY:
        return await handleSaveMemory(message.payload);

      case MessageType.GET_MEMORIES:
        return await handleGetMemories(message.payload);

      case MessageType.GET_BACKEND_MEMORIES:
        return await handleGetBackendMemories();

      case MessageType.GET_BACKEND_MEMORIES_PAGINATED:
        return await handleGetBackendMemoriesPaginated(message.payload);

      case MessageType.SYNC_MEMORIES:
        return await handleSyncMemories();

      case MessageType.DELETE_MEMORY:
        return await handleDeleteMemory(message.payload);

      case MessageType.UPDATE_MEMORY:
        return await handleUpdateMemory(message.payload);

      case MessageType.SEARCH_MEMORIES:
        return await handleSearchMemories(message.payload);

      case MessageType.GET_SETTINGS:
        return await handleGetSettings();

      case MessageType.UPDATE_SETTINGS:
        return await handleUpdateSettings(message.payload);

      case MessageType.TOGGLE_SITE_VISIBILITY:
        return await handleToggleSiteVisibility(message.payload);

      case MessageType.GET_SITE_VISIBILITY:
        return await handleGetSiteVisibility(message.payload);

      case MessageType.GET_PAGE_CONTENT:
        return await handleGetPageContent();

      case MessageType.ANALYZE_PAGE:
        return await handleAnalyzePage(message.payload);

      case MessageType.ASK_INTELLA:
        return await handleAskIntella(message.payload);

      case MessageType.IMPROVE_TEXT:
        return await handleImproveText(message.payload);

      case MessageType.REWRITE_TEXT:
        return await handleRewriteText(message.payload);

      case MessageType.TRANSLATE_TEXT:
        return await handleTranslateText(message.payload);

      case MessageType.CAPTURE_AND_SAVE:
        return await handleCaptureAndSave(message.payload);

      case MessageType.RESET_CONVERSATION:
        return await handleResetConversation();

      case MessageType.LOGOUT:
        return await handleLogout();

      case MessageType.CLEAR_ALL_USER_DATA:
        return await handleClearAllUserData();

      // Feature 4: Blocked Sites List
      case MessageType.ADD_BLOCKED_DOMAIN:
        return await handleAddBlockedDomain(message.payload);

      case MessageType.REMOVE_BLOCKED_DOMAIN:
        return await handleRemoveBlockedDomain(message.payload);

      case MessageType.CHECK_DOMAIN_BLOCKED:
        return await handleCheckDomainBlocked(message.payload);

      // Feature 1: Floating Search Bar  
      case MessageType.FLOAT_QUERY:
        return await handleFloatQuery(message.payload);

      case MessageType.QUERY_MEMORIES:
        return await handleQueryMemories(message.payload);

      case MessageType.OPEN_SIDEPANEL:
        return await handleOpenSidepanel();

      case MessageType.CLOSE_SIDEPANEL:
        return await handleCloseSidepanel();

      case MessageType.GET_SIDEPANEL_STATE:
        return await handleGetSidepanelState();

      // Feature 5: Attach Tab enhancements
      case MessageType.GET_OPEN_TABS:
        return await handleGetOpenTabs();

      case MessageType.GET_TAB_CONTENT:
        return await handleGetTabContent(message.payload);

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error: any) {
    console.error('Error handling message:', error);
    return { success: false, error: error.message };
  }
}

// Message handlers
async function handleSaveMemory(memory: Memory): Promise<MessageResponse> {
  // Save memory (will update if URL already exists, preventing duplicates)
  const savedMemory = await storage.saveMemory(memory);

  // Embed memory into Moss (if enabled) - do this after local save but before backend sync
  // Use savedMemory in case it was merged with an existing memory
  try {
    const mossDocId = await mossClient.embedMemory(savedMemory);
    if (mossDocId) {
      // Store Moss document ID in metadata for future reference
      if (!savedMemory.meta_data?.mossEmbedded) {
        savedMemory.meta_data = {
          ...savedMemory.meta_data,
          mossDocId,
          mossEmbedded: true,
        };
        // Update the memory in storage with Moss metadata
        await storage.saveMemory(savedMemory);
        console.log('✅ Memory embedded in Moss');
      }
    }
  } catch (mossError) {
    console.warn('⚠️ Moss embedding failed (non-critical):', mossError);
    // Continue with memory saving even if Moss embedding fails
  }

  // Sync to backend using the /memories endpoint
  try {
    const settings = await storage.getSettings();

    // Check if we have authentication (either API key or session)
    const session = await mieltoAuth.getCurrentSession();
    const hasAuth = (settings.apiKey && settings.workspace_id) || session?.user?.id;

    if (hasAuth) {
      // Use the preferred ingestion method from settings
      // const ingestionMethod = settings.ingestionMethod || 'both';

      // if (ingestionMethod === 'completions') {
      //   // Only use completions endpoint for ingestion
      //   await mieltoAPI.ingestMemoryViaCompletions(memory);
      //   console.log('✅ Memory ingested via completions');
      // } else if (ingestionMethod === 'upload') {
      //   // Use the /memories endpoint (which replaces the old upload approach)
      //   await mieltoAPI.createMemoryInBackend(memory);
      //   console.log('✅ Memory created in backend via /memories endpoint');
      // } else {
      //   // Both: Try completions first, fallback to memories endpoint
      //   try {
      //     await mieltoAPI.ingestMemoryViaCompletions(memory);
      //     console.log('✅ Memory ingested via completions');
      //   } catch (completionsError) {
      //     console.warn('⚠️ Completions ingestion failed, falling back to /memories endpoint:', completionsError);

      //     // Fallback to memories endpoint
      //     await mieltoAPI.createMemoryInBackend(memory);
      //     console.log('✅ Memory created in backend via /memories endpoint');
      //   }
      // }
    } else {
      console.log('⚠️ No authentication available, memory saved locally only');
    }
  } catch (error) {
    console.warn('Failed to sync memory to backend:', error);
  }

  return { success: true, data: memory };
}

async function handleGetMemories(_filters?: any): Promise<MessageResponse> {
  const memories = await storage.getAllMemories();
  return { success: true, data: memories };
}

async function handleGetBackendMemories(): Promise<MessageResponse> {
  try {
    const backendMemories = await mieltoAPI.getAllMemoriesFromBackend();
    return { success: true, data: backendMemories };
  } catch (error: any) {
    console.warn('Failed to fetch backend memories:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetBackendMemoriesPaginated(payload: {
  cursor?: string;
  limit?: number;
  user_id?: string;
}): Promise<MessageResponse> {
  try {
    const result = await mieltoAPI.getMemoriesFromBackend(payload || {});
    return { success: true, data: result };
  } catch (error: any) {
    console.warn('Failed to fetch paginated backend memories:', error);
    return { success: false, error: error.message };
  }
}

async function handleSyncMemories(): Promise<MessageResponse> {
  try {
    console.log('🔄 Syncing memories from backend...');

    // Get memories from backend
    const backendMemories = await mieltoAPI.getAllMemoriesFromBackend();
    console.log(`📥 Found ${backendMemories.length} memories in backend`);

    // Get local memories
    const localMemories = await storage.getAllMemories();
    console.log(`💾 Found ${localMemories.length} memories locally`);

    // Create a map of local memories by URL and timestamp for deduplication
    const localMemoryMap = new Map();
    localMemories.forEach(memory => {
      const key = `${memory.url}_${memory.timestamp}`;
      localMemoryMap.set(key, memory);
    });

    // Add backend memories that don't exist locally
    let newMemoriesCount = 0;
    for (const backendMemory of backendMemories) {
      const key = `${backendMemory.url}_${backendMemory.timestamp}`;
      if (!localMemoryMap.has(key)) {
        await storage.saveMemory(backendMemory);
        newMemoriesCount++;
      }
    }

    console.log(`✅ Synced ${newMemoriesCount} new memories from backend`);

    // Return all memories (local + backend)
    const allMemories = await storage.getAllMemories();
    return {
      success: true,
      data: {
        memories: allMemories,
        syncedCount: newMemoriesCount,
        totalLocal: localMemories.length,
        totalBackend: backendMemories.length,
        totalAfterSync: allMemories.length
      }
    };
  } catch (error: any) {
    console.error('Failed to sync memories:', error);
    return { success: false, error: error.message };
  }
}

async function handleDeleteMemory(id: string): Promise<MessageResponse> {
  // Try to delete from Moss first (non-critical if it fails)
  try {
    await mossClient.deleteMemory(id);
  } catch (mossError) {
    console.warn('⚠️ Failed to delete memory from Moss (non-critical):', mossError);
  }

  await storage.deleteMemory(id);
  return { success: true };
}

async function handleUpdateMemory(payload: { id: string; updates: Partial<Memory> }): Promise<MessageResponse> {

  try {
    await mossClient.embedMemory({ ...payload.updates, id: payload.id } as Memory);
  } catch (mossError) {
    console.warn('⚠️ Failed to update memory in Moss (non-critical):', mossError);
  }

  try {
    await storage.updateMemory(payload.id, payload.updates);
  } catch (error) {
    console.warn('Failed to update memory in storage:', error);
  }

  await storage.updateMemory(payload.id, payload.updates);

  return { success: true };
}

async function handleSearchMemories(query: string): Promise<MessageResponse> {
  try {
    // Step 1: Try Moss semantic search first
    let mossResults: Memory[] = [];
    let missingMemoryIds: string[] = [];
    
    try {
      console.log('🔍 Searching Moss for:', query);
      const mossSearchResults = await mossClient.searchMemories(query, 10);
      console.log('🔍 Moss search results:', mossSearchResults);
      
      if (mossSearchResults.length > 0) {
        console.log(`✅ Moss found ${mossSearchResults.length} semantically relevant memories`);
        
        // Fetch the actual memory objects for Moss results
        for (const mossResult of mossSearchResults) {
          try {
            const memory = await storage.getMemory(mossResult.memoryId);
            if (memory && memory.id && memory.summary) {
              // Validate memory has required fields
              mossResults.push(memory);
              console.log(`✅ Found memory locally: ${mossResult.memoryId} - "${memory.title?.substring(0, 50)}"`);
            } else {
              console.warn(`⚠️ Memory ${mossResult.memoryId} returned invalid from storage (missing fields)`);
              missingMemoryIds.push(mossResult.memoryId);
            }
          } catch (error: any) {
            // Memory might not exist locally, skip
            console.warn(`⚠️ Memory ${mossResult.memoryId} from Moss not found locally:`, error.message || error);
            missingMemoryIds.push(mossResult.memoryId);
          }
        }
        
        console.log(`📊 Moss search summary:`);
        console.log(`  - Moss found: ${mossSearchResults.length} results`);
        console.log(`  - Found locally: ${mossResults.length} memories`);
        console.log(`  - Missing locally: ${missingMemoryIds.length} memories`, missingMemoryIds);
        
        // If Moss found results, return them (prioritize semantic search)
        if (mossResults.length > 0) {
          console.log(`✅ Returning ${mossResults.length} valid results from Moss semantic search`);
          // Ensure we're returning a valid array
          return { success: true, data: Array.isArray(mossResults) ? mossResults : [] };
        } else {
          console.log(`⚠️ Moss found ${mossSearchResults.length} results but none exist locally, falling back to local search`);
        }
      } else {
        console.log('ℹ️ Moss search returned empty results, falling back to local search');
      }
    } catch (mossError: any) {
      console.warn('⚠️ Moss search failed, falling back to local search:', mossError.message || mossError);
    }
    
    // Step 2: Fallback to local text-based search if Moss returned empty or failed
    console.log('🔍 Falling back to local text search...');
    const localMemories = await storage.searchMemories(query);
    console.log(`✅ Local search found ${localMemories.length} results`);
    
    return { success: true, data: localMemories };
  } catch (error: any) {
    console.error('❌ Error in handleSearchMemories:', error);
    // Final fallback to local search only
    const localMemories = await storage.searchMemories(query);
    return { success: true, data: localMemories };
  }
}

async function handleGetSettings(): Promise<MessageResponse> {
  const settings = await storage.getSettings();
  return { success: true, data: settings };
}

async function handleUpdateSettings(settings: any): Promise<MessageResponse> {
  await storage.updateSettings(settings);
  await storage.syncToChromeStorage();
  return { success: true };
}

async function handleToggleSiteVisibility(domain: string): Promise<MessageResponse> {
  const currentVisibility = await storage.getSiteVisibility(domain);
  await storage.setSiteVisibility(domain, !currentVisibility);
  return { success: true, data: !currentVisibility };
}

async function handleGetSiteVisibility(domain: string): Promise<MessageResponse> {
  const isVisible = await storage.getSiteVisibility(domain);
  return { success: true, data: isVisible };
}

async function handleGetPageContent(): Promise<MessageResponse> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id || !tab.url) {
      return { success: false, error: 'No active tab found' };
    }

    // Check if the tab is a valid web page
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      return { success: false, error: 'Cannot get content from chrome:// or extension pages' };
    }

    // Request page content from the content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: MessageType.GET_PAGE_CONTENT,
    });

    if (response && response.success && response.data) {
      return { success: true, data: response.data };
    }

    return { success: false, error: 'Failed to get page content' };
  } catch (error: any) {
    console.error('Error getting page content:', error);
    return { success: false, error: error.message };
  }
}

async function handleAnalyzePage(payload: any): Promise<MessageResponse> {
  try {
    const { content, url, title } = payload;

    // Summarize content
    const summary = await mieltoAPI.summarizePage({ content, url, title });

    // Extract entities
    const entities = await mieltoAPI.extractEntities({ content });

    return {
      success: true,
      data: {
        summary,
        entities,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleAskIntella(payload: { 
  question: string; 
  context?: string; 
  screenshot?: string; 
  model?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<MessageResponse> {
  try {
    // Ensure tool providers are initialized (service worker may have woken up)
    try {
      const providers = toolRegistry.getAllProviders();
      if (providers.length === 0) {
        console.log('🔧 Tool providers not initialized, registering...');
        await toolRegistry.registerProvider(new MemoryToolsProvider());
        await toolRegistry.registerProvider(new BrowserToolsProvider());
        console.log('✅ Tool providers initialized');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize tool providers:', error);
    }

    // Step 1: Query Moss index for relevant memories
    let mossContext = '';
    try {
      const mossResults = await mossClient.searchMemories(payload.question, 5);

      console.log('🔍 Moss results:', mossResults);

      if (mossResults.length > 0) {
        console.log(`🔍 Found ${mossResults.length} relevant memories from Moss`);

        // Format Moss results as context
        const mossContextParts = mossResults.map((result, index) => {
          const metadata = result.metadata || {};
          return `[Memory ${index + 1}] Title: ${metadata.title || 'Untitled'}
              URL: ${metadata.url || 'N/A'}
              Summary: ${result.text}
              Score: ${result.score.toFixed(3)}
              Timestamp: ${metadata.timestamp || 'N/A'}
              ${metadata.keywords ? `Keywords: ${metadata.keywords}` : ''}
            `;
        });

        mossContext = `Relevant memories from your browsing history:\n\n${mossContextParts.join('\n\n')}`;
        console.log('✅ Moss context prepared');
      } else {
        console.log('ℹ️ No relevant memories found in Moss index');
      }
    } catch (mossError) {
      console.warn('⚠️ Moss search failed (non-critical):', mossError);
      // Continue without Moss context if search fails
    }

    // Step 2: Combine existing context with Moss context
    let combinedContext = payload.context || '';
    if (mossContext) {
      combinedContext = combinedContext
        ? `${combinedContext}\n\n${mossContext}`
        : mossContext;
    }
    console.log('🔍 Combined context:', combinedContext);
    
    // Step 3: Send to Mielto with combined context and conversation history
    const model = payload.model || 'gpt-4o';
    const response = payload.screenshot 
      ? await mieltoAPI.askIntellaWithScreenshot(
          payload.question, 
          combinedContext, 
          payload.screenshot, 
          model,
          payload.conversationHistory
        )
      : await mieltoAPI.askIntella(
          payload.question, 
          combinedContext, 
          model,
          payload.conversationHistory
        );
    return { 
      success: true, 
      data: response.content,
      toolExecutions: response.toolExecutions,
    };
  } catch (error: any) {
    console.error('Background: ASK_INTELLA error:', error);
    return { success: false, error: error.message };
  }
}

async function handleImproveText(payload: { text: string; instruction: string }): Promise<MessageResponse> {
  try {
    const response = await mieltoAPI.improveText(payload.text, payload.instruction);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleRewriteText(payload: { text: string; style: string }): Promise<MessageResponse> {
  try {
    const instruction = `Rewrite this text in a ${payload.style} style`;
    const response = await mieltoAPI.improveText(payload.text, instruction);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleTranslateText(payload: { text: string; targetLanguage: string }): Promise<MessageResponse> {
  try {
    const instruction = `Translate this text to ${payload.targetLanguage || 'Spanish'}`;
    const response = await mieltoAPI.improveText(payload.text, instruction);
    return { success: true, data: response };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleResetConversation(): Promise<MessageResponse> {
  try {
    await mieltoAPI.resetConversation();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleLogout(): Promise<MessageResponse> {
  try {
    console.log('🔄 Starting logout process...');

    // Sign out from authentication
    await mieltoAuth.signOut();

    // Clear all user data from storage
    await storage.clearAllUserData();

    // Clear session storage
    await chrome.storage.session.clear();

    // Reset conversation
    try {
      await mieltoAPI.resetConversation();
    } catch (resetError) {
      console.warn('⚠️ Failed to reset conversation during logout:', resetError);
    }

    console.log('✅ Logout completed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Logout failed:', error);
    return { success: false, error: error.message };
  }
}

async function handleClearAllUserData(): Promise<MessageResponse> {
  try {
    console.log('🧹 Clearing all user data...');
    await storage.clearAllUserData();
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to clear user data:', error);
    return { success: false, error: error.message };
  }
}

async function handleCaptureAndSave(payload: {
  content: string;
  selectedText: string;
  url: string;
  title: string;
  elementType: string;
}): Promise<MessageResponse> {
  try {
    console.log('💾 Creating memory from captured content...');

    // Step 1: Use completions endpoint to create comprehensive summary first
    const memoryData = await mieltoAPI.createMemorySummary({
      content: payload.content,
      url: payload.url,
      title: payload.selectedText || payload.title,
    });

    console.log('🤖 Memory summary created:', {
      title: memoryData.title,
      summaryLength: memoryData.summary.length,
      keywordCount: memoryData.keywords.length,
      entityCount: Object.values(memoryData.entities).flat().length
    });

    // Step 2: Create memory object from the AI-generated summary
    const memory: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: payload.url,
      title: memoryData.title,
      summary: memoryData.summary,
      content: payload.content,
      keywords: memoryData.keywords,
      entities: memoryData.entities,
      timestamp: new Date().toISOString(),
      accessCount: 1,
      archived: false,
      meta_data: {
        captureType: 'selection',
        elementType: payload.elementType,
        originalTitle: payload.title,
        selectedText: payload.selectedText,
        aiGenerated: true, // Flag to indicate this was created via completions
      },
    };

    console.log('✅ Memory created from AI summary');

    // Step 3: Save memory using existing handler (Moss embedding happens in handleSaveMemory)
    return await handleSaveMemory(memory);
  } catch (error: any) {
    console.error('❌ Error creating memory from captured content:', error);

    // Fallback: create basic memory without AI analysis
    console.log('🔄 Falling back to basic memory creation...');
    const fallbackMemory: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: payload.url,
      title: payload.selectedText || payload.title,
      summary: payload.content.length > 200 ? payload.content.substring(0, 200) + '...' : payload.content,
      content: payload.content,
      keywords: [],
      entities: { people: [], organizations: [], topics: [] },
      timestamp: new Date().toISOString(),
      accessCount: 1,
      archived: false,
      meta_data: {
        captureType: 'selection',
        elementType: payload.elementType,
        originalTitle: payload.title,
        selectedText: payload.selectedText,
        aiGenerated: false,
      },
    };

    return await handleSaveMemory(fallbackMemory);
  }
}

// Feature 4: Blocked Sites List handlers
async function handleAddBlockedDomain(payload: { domain: string }): Promise<MessageResponse> {
  try {
    console.log('🔧 Adding domain to blocked list:', payload.domain);
    await storage.addBlockedDomain(payload.domain);
    const updatedDomains = await storage.getBlockedDomains();
    console.log('✅ Domain added to blocked list. Updated list:', updatedDomains);

    // Notify all content scripts about the domain update
    await broadcastBlockedDomainsUpdate(updatedDomains);

    return { success: true, data: { blockedDomains: updatedDomains } };
  } catch (error: any) {
    console.error('❌ Failed to add blocked domain:', error);
    return { success: false, error: error.message };
  }
}

async function handleRemoveBlockedDomain(payload: { domain: string }): Promise<MessageResponse> {
  try {
    await storage.removeBlockedDomain(payload.domain);
    const updatedDomains = await storage.getBlockedDomains();
    console.log('✅ Domain removed from blocked list:', payload.domain);

    // Notify all content scripts about the domain update
    await broadcastBlockedDomainsUpdate(updatedDomains);

    return { success: true, data: { blockedDomains: updatedDomains } };
  } catch (error: any) {
    console.error('❌ Failed to remove blocked domain:', error);
    return { success: false, error: error.message };
  }
}

async function handleCheckDomainBlocked(payload: { hostname?: string }): Promise<MessageResponse> {
  try {
    const settings = await storage.getSettings();
    const blockedDomains = settings.privacy?.blockedDomains || [];

    // If no hostname provided, check current page via content script
    let hostname = payload.hostname;
    if (!hostname) {
      // This should typically be called from content script with hostname
      return { success: false, error: 'Hostname not provided' };
    }

    // Import domain blocking utilities
    const { isHostnameBlocked } = await import('@/utils/domainBlocking');
    const result = isHostnameBlocked(hostname, blockedDomains);

    console.log(`🔍 Domain blocking check for ${hostname}:`, result);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('❌ Failed to check domain blocking:', error);
    return { success: false, error: error.message };
  }
}

// Helper function to broadcast blocked domains updates to all content scripts
async function broadcastBlockedDomainsUpdate(blockedDomains: string[]): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const messages = tabs
      .filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://'))
      .map(tab => {
        return chrome.tabs.sendMessage(tab.id!, {
          type: MessageType.BLOCKED_DOMAINS_UPDATED,
          payload: { blockedDomains }
        }).catch(error => {
          // Ignore errors for tabs that don't have content scripts
          console.log(`Could not notify tab ${tab.id} about blocked domains update:`, error.message);
        });
      });

    await Promise.allSettled(messages);
    console.log('📢 Broadcasted blocked domains update to all content scripts');
  } catch (error) {
    console.error('Failed to broadcast blocked domains update:', error);
  }
}

// Feature 1: Floating Search Bar handlers
async function handleFloatQuery(payload: { query: string; source?: string; appendToExisting?: boolean }): Promise<MessageResponse> {
  try {
    console.log('🔍 Background: Handling floating search query:', payload.query, 'from:', payload.source);

    const queryData = {
      query: payload.query,
      timestamp: Date.now(),
      source: payload.source || 'floating',
      appendToExisting: payload.appendToExisting || false
    };

    console.log('💾 Background: Storing query data:', queryData);

    // Store the query in a temporary storage for the sidepanel to pick up
    await chrome.storage.session.set({
      'floating-query': queryData
    });

    // Also update sidepanel state tracking
    await chrome.storage.session.set({
      'sidepanel-state': {
        isOpen: sidepanelState.isOpen,
        lastActivity: Date.now()
      }
    });

    // Verify it was stored
    const verification = await chrome.storage.session.get('floating-query');
    console.log('✅ Background: Stored query verified:', verification);

    console.log('✅ Background: Floating query stored for sidepanel');
    return { success: true, data: { query: payload.query } };
  } catch (error: any) {
    console.error('❌ Background: Failed to handle floating query:', error);
    return { success: false, error: error.message };
  }
}

async function handleQueryMemories(payload: { query: string; source?: string }): Promise<MessageResponse> {
  try {
    console.log('🔍 Handling memory query:', payload.query);

    // Search memories using existing search functionality
    const memories = await storage.searchMemories(payload.query);

    console.log('✅ Found', memories.length, 'memories for query:', payload.query);
    return { success: true, data: { memories, query: payload.query } };
  } catch (error: any) {
    console.error('❌ Failed to query memories:', error);
    return { success: false, error: error.message };
  }
}

// Track sidepanel state
let sidepanelState = {
  isOpen: false,
  windowId: null as number | null
};

// Listen for sidepanel connections to track open/close state
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    console.log('📱 Sidepanel connected');
    sidepanelState.isOpen = true;

    port.onDisconnect.addListener(() => {
      console.log('📱 Sidepanel disconnected');
      sidepanelState.isOpen = false;
      sidepanelState.windowId = null;
    });
  }
});

async function handleOpenSidepanel(): Promise<MessageResponse> {
  return new Promise((resolve) => {
    console.log('🔄 Toggling sidepanel...');

    // Use callback style to preserve user gesture
    chrome.windows.getCurrent((window) => {
      if (window.id && chrome.sidePanel) {
        sidepanelState.windowId = window.id;

        if (sidepanelState.isOpen) {
          // Sidepanel is open, send message to close it
          console.log('🔄 Sidepanel is open, sending close message...');
          chrome.runtime.sendMessage({
            type: 'CLOSE_SIDEPANEL'
          }).then(() => {
            console.log('✅ Close message sent to sidepanel');
            resolve({ success: true });
          }).catch((error) => {
            console.error('❌ Failed to send close message:', error);
            // Fallback: try to open anyway (might toggle behavior)
            if (window.id) {
              chrome.sidePanel.open({ windowId: window.id })
                .then(() => resolve({ success: true }))
                .catch((openError) => resolve({ success: false, error: openError.message }));
            } else {
              resolve({ success: false, error: 'No window ID available' });
            }
          });
        } else {
          // Sidepanel is closed, open it
          console.log('🔄 Sidepanel is closed, opening...');
          if (window.id) {
            chrome.sidePanel.open({ windowId: window.id })
              .then(() => {
                console.log('✅ Sidepanel opened successfully');
                resolve({ success: true });
              })
              .catch((error) => {
                console.error('❌ Failed to open sidepanel:', error);
                resolve({ success: false, error: error.message });
              });
          } else {
            resolve({ success: false, error: 'No window ID available' });
          }
        }
      } else {
        console.error('❌ Could not toggle sidepanel: no window or sidePanel API unavailable');
        resolve({ success: false, error: 'Sidepanel API unavailable' });
      }
    });
  });
}

async function handleCloseSidepanel(): Promise<MessageResponse> {
  console.log('🔄 Force closing sidepanel...');

  // Send close message to sidepanel
  try {
    await chrome.runtime.sendMessage({
      type: 'CLOSE_SIDEPANEL'
    });
    console.log('✅ Close message sent to sidepanel');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to send close message:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetSidepanelState(): Promise<MessageResponse> {
  console.log('📊 Getting sidepanel state...');
  
  try {
    return { 
      success: true, 
      data: {
        isOpen: sidepanelState.isOpen,
        windowId: sidepanelState.windowId
      }
    };
  } catch (error: any) {
    console.error('❌ Failed to get sidepanel state:', error);
    return { success: false, error: error.message };
  }
}

// Update badge based on memories count
async function updateBadge() {
  const memories = await storage.getAllMemories();
  const count = memories.length;

  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
}

// Listen for commands (keyboard shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  console.log('⌨️ Command received:', command);

  if (command === 'open-sidepanel') {
    await handleOpenSidepanel();
  }
});

// Listen for tab updates to check site visibility  
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // For now, just log visibility status
    // TODO: Add proper icon handling when icons are ready
    const url = new URL(tab.url);
    const domain = url.hostname;
    const isVisible = await storage.getSiteVisibility(domain);
    console.log(`🌐 Site visibility for ${domain}:`, isVisible);
  }
});

// Update badge periodically
setInterval(updateBadge, 60000); // Every minute
updateBadge(); // Initial update

// Feature 5: Attach Tab enhancements handlers
async function handleGetOpenTabs(): Promise<MessageResponse> {
  try {
    console.log('📑 Getting open tabs...');
    
    // Query all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Map to our TabInfo interface and filter out extension/chrome pages
    const tabInfos = tabs
      .filter(tab => 
        tab.url && 
        tab.id !== undefined &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('moz-extension://') &&
        !tab.url.startsWith('about:')
      )
      .map(tab => ({
        id: tab.id!,
        title: tab.title || 'Untitled',
        url: tab.url!,
        favIconUrl: tab.favIconUrl,
        active: tab.active,
      }));
    
    console.log(`✅ Found ${tabInfos.length} open tabs`);
    return { success: true, data: tabInfos };
  } catch (error: any) {
    console.error('❌ Failed to get open tabs:', error);
    return { success: false, error: error.message };
  }
}

async function handleGetTabContent(payload: { tabId: number }): Promise<MessageResponse> {
  try {
    console.log('📄 Getting content from tab:', payload.tabId);
    
    // Get tab info first
    const tab = await chrome.tabs.get(payload.tabId);
    if (!tab || !tab.url) {
      return { success: false, error: 'Tab not found or invalid' };
    }
    
    // Check if tab is a valid web page
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('about:')) {
      return { success: false, error: 'Cannot get content from system pages' };
    }
    
    try {
      // Try to get content via content script
      const response = await chrome.tabs.sendMessage(payload.tabId, {
        type: MessageType.GET_PAGE_CONTENT,
      });
      
      if (response && response.success) {
        console.log('✅ Successfully retrieved tab content');
        return {
          success: true,
          data: {
            tabInfo: {
              id: tab.id!,
              title: tab.title || 'Untitled',
              url: tab.url,
              favIconUrl: tab.favIconUrl,
            },
            content: response.data,
          },
        };
      } else {
        throw new Error('Content script did not respond successfully');
      }
    } catch (contentError) {
      console.warn('⚠️ Content script unavailable, providing basic tab info only:', contentError);
      
      // Fallback: provide basic tab information without content
      return {
        success: true,
        data: {
          tabInfo: {
            id: tab.id!,
            title: tab.title || 'Untitled',
            url: tab.url,
            favIconUrl: tab.favIconUrl,
          },
          content: {
            title: tab.title || 'Untitled',
            content: `Page from ${tab.url}`,
            description: 'Content not available - tab may not have loaded yet or may be a restricted page.',
          },
        },
      };
    }
  } catch (error: any) {
    console.error('❌ Failed to get tab content:', error);
    return { success: false, error: error.message };
  }
}
