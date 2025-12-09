/**
 * Intella Side Panel Component (Chrome Side Panel API)
 * Native browser side panel for AI assistance and memory search
 */

import React, { useState, useEffect, useRef, useReducer } from 'react';
import ReactDOM from 'react-dom/client';
import { Search, BookOpen, Sparkles, Settings as SettingsIcon, RefreshCw, Plus, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, Zap, Mic, MicOff, X, AtSign, PhoneOff, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { MessageType, TabInfo } from '@/types/messages';
import { Memory, UserSettings } from '@/types/memory';
import { mieltoAPI } from '@/utils/api';
import { QuickActionsPopover } from '@/components/QuickActionsPopover';
import { ChatMenuPopover } from '@/components/ChatMenuPopover';
import { ConversationSwitcher } from '@/components/ConversationSwitcher';
import { LoginScreen } from '@/components/LoginScreen';
import { ModelSelector } from '@/components/ModelSelector';
import { TabSelector } from '@/components/TabSelector';
import { MentionInput } from '@/components/MentionInput';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { conversationReducer, initialConversationState } from '@/reducers/conversationReducer';
import { listConversations, createConversation, deleteConversation, getConversationWithMessages } from '@/handlers/conversation.handler';
import type { ConversationWithStats } from '@/handlers/conversation.handler';
import { getFirstActiveApiKey } from '@/handlers/apikey.handler';
import { mieltoAuth } from '@/lib/auth';
import { ThemeProvider } from '@/components/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getBasicSuggestions, getIntelligentSuggestions, type AgentSuggestion, type SuggestionMode } from '@/utils/agent-suggestions';
import '../styles/app.css';

interface ToolExecution {
  toolName: string;
  args: Record<string, any>;
  success: boolean;
  executionTime?: number;
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  usedMemories?: Memory[];
  toolExecutions?: ToolExecution[];
}

interface StagedImage {
  id: string;
  dataUrl: string;
  type: 'screenshot' | 'region';
  timestamp: Date;
}

const SidePanelInner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'memories' | 'state' | 'settings' | 'history' | 'analytics'>('chat');
  const [query, setQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadPopover, setShowUploadPopover] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showConversationSwitcher, setShowConversationSwitcher] = useState(false);
  const [conversationState, dispatch] = useReducer(conversationReducer, initialConversationState);
  
  // Tab attachment state
  const [showTabSelector, setShowTabSelector] = useState(false);
  const [attachedTabs, setAttachedTabs] = useState<TabInfo[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    fileName?: string;
    status?: 'uploading' | 'processing' | 'success' | 'error';
    message?: string;
  }>({ isUploading: false });
  // const [isStreaming, setIsStreaming] = useState(false);

  // Staged images for screenshots
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  
  // Voice chat state (browser speech-to-text)
  const [speechRecognition, setSpeechRecognition] = useState<any | null>(null);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');

  // State tab variables (from popup)
  // Start with null (loading) - will be set quickly by fast auth check
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [memoriesCount, setMemoriesCount] = useState(0);
  const [isAnalysisActive, setIsAnalysisActive] = useState(true);
  
  // Current page context
  const [currentPageInfo, setCurrentPageInfo] = useState<{
    title: string;
    favicon?: string;
    hasInfo: boolean;
    content?: string;
    tabId?: number;
    url?: string;
  }>({ title: 'Current Page Context', hasInfo: false });
  const [faviconError, setFaviconError] = useState(false);

  // Agent mode suggestions
  const [agentSuggestions, setAgentSuggestions] = useState<AgentSuggestion[]>([]);
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>('intelligent'); // Default to intelligent
  const [suggestionsMinimized, setSuggestionsMinimized] = useState(false);
  const [intelligentSuggestionsLoaded, setIntelligentSuggestionsLoaded] = useState(false);
  const [expandedToolExecutions, setExpandedToolExecutions] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tabSelectorButtonRef = useRef<HTMLButtonElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    console.log('📚 SidePanel: useEffect mounting - loading memories...');
    loadMemories();
    checkForFloatingQuery();
    loadConversations();
    
    // Initialize settings first, then load page info
    const initializeData = async () => {
      await checkAuthAndLoadData();
      await loadCurrentPageInfo();
    };
    
    initializeData();
    loadSelectedModel();

    // Establish connection with background script for close detection
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    console.log('📱 SidePanel: Connected to background script');

    // Listen for close messages and region capture
    const messageListener = async (message: any) => {
      if (message.type === 'CLOSE_SIDEPANEL') {
        console.log('📱 SidePanel: Received close message, closing...');
        window.close();
      }

      if (message.type === MessageType.CAPTURE_SCREEN_REGION) {
        console.log('📸 SidePanel: Received region capture', message.payload);
        await processRegionCapture(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Listen for tab updates to refresh page info
    const tabUpdateListener = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
        loadCurrentPageInfo();
      }
    };

    // Listen for active tab changes
    const tabActivatedListener = (activeInfo: chrome.tabs.TabActiveInfo) => {
      console.log('🔄 Active tab changed to:', activeInfo.tabId);
      loadCurrentPageInfo();
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    chrome.tabs.onActivated.addListener(tabActivatedListener);

    // Cleanup on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      chrome.tabs.onActivated.removeListener(tabActivatedListener);
      port.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus chat input when sidepanel opens
  useEffect(() => {
    // Small delay to ensure the input is fully rendered
    const timer = setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Focus chat input when switching back to chat tab
  useEffect(() => {
    if (activeTab === 'chat') {
      chatInputRef.current?.focus();
    }
  }, [activeTab]);

  // Streaming functionality for future use
  // const handleSendMessageStreaming = async () => {
  //   if (!query.trim() || isLoading) return;
    
  //   // Streaming functionality for future use
  //   const streamingEnabled = true;
  //   if (!streamingEnabled) return;

  //   const userMessage: ChatMessage = {
  //     role: 'user',
  //     content: query,
  //     timestamp: new Date(),
  //   };

  //   setChatMessages(prev => [...prev, userMessage]);
  //   const currentQuery = query;
  //   setQuery('');
  //   setIsLoading(true);
  //   setIsStreaming(true);

  //   // Add an empty assistant message that we'll update as we stream
  //   const assistantMessage: ChatMessage = {
  //     role: 'assistant',
  //     content: '',
  //     timestamp: new Date(),
  //   };
  //   setChatMessages(prev => [...prev, assistantMessage]);

  //   try {
  //     console.log('🔥 Starting streaming chat...');
      
  //     const stream = await mieltoHandler.streamChat([
  //       {
  //         role: 'system',
  //         content: 'You are Intella, a helpful AI assistant with access to the user\'s browsing memories.',
  //       },
  //       {
  //         role: 'user',
  //         content: currentQuery,
  //       }
  //     ]);

  //     let fullContent = '';
  //     for await (const chunk of stream) {
  //       fullContent += chunk;
        
  //       // Update the assistant message in real-time
  //       setChatMessages(prev => 
  //         prev.map((msg, index) => 
  //           index === prev.length - 1 && msg.role === 'assistant'
  //             ? { ...msg, content: fullContent }
  //             : msg
  //         )
  //       );
  //     }

  //     console.log('✅ Streaming completed');
  //   } catch (error) {
  //     console.error('💥 Streaming error:', error);
      
  //     // Update the assistant message with error
  //     setChatMessages(prev => 
  //       prev.map((msg, index) => 
  //         index === prev.length - 1 && msg.role === 'assistant'
  //           ? { ...msg, content: 'Sorry, I encountered an error during streaming. Please try again.' }
  //           : msg
  //       )
  //     );
  //   } finally {
  //     setIsLoading(false);
  //     setIsStreaming(false);
  //   }
  // };

  const loadMemories = async () => {
    try {
      console.log('📚 SidePanel: Syncing memories from backend...');
      // Try to sync memories first, then use the result
      const syncResponse = await chrome.runtime.sendMessage({
        type: MessageType.SYNC_MEMORIES,
      });

      if (syncResponse.success) {
        setMemories(syncResponse.data.memories);
        console.log('📚 SidePanel: Synced and loaded', syncResponse.data.memories.length, 'memories');
        console.log('📊 Sync stats:', {
          local: syncResponse.data.totalLocal,
          backend: syncResponse.data.totalBackend,
          synced: syncResponse.data.syncedCount
        });
      } else {
        console.warn('📚 SidePanel: Sync failed, loading local memories:', syncResponse.error);
        // Fallback to local memories
        const response = await chrome.runtime.sendMessage({
          type: MessageType.GET_MEMORIES,
        });

        if (response.success) {
          setMemories(response.data);
          console.log('📚 SidePanel: Loaded', response.data.length, 'local memories');
        } else {
          console.error('📚 SidePanel: Failed to load memories:', response.error);
        }
      }
    } catch (error) {
      console.error('📚 SidePanel: Error loading memories:', error);
    }
  };

  const handleSearchMemories = async (search: string) => {
    setSearchQuery(search);

    if (!search.trim()) {
      loadMemories();
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.SEARCH_MEMORIES,
        payload: search,
      });

      if (response.success) {
        setMemories(response.data);
      }
    } catch (error) {
      console.error('Failed to search memories:', error);
    }
  };

  const checkForFloatingQuery = async () => {
    try {
      console.log('🔍 SidePanel: Checking for floating query...');
      const result = await chrome.storage.session.get('floating-query');
      console.log('📦 SidePanel: Session storage result:', result);

      if (result['floating-query']) {
        const { query, timestamp, source, appendToExisting } = result['floating-query'];
        console.log('✅ SidePanel: Found floating query:', query, 'from:', source, 'timestamp:', timestamp, 'appendToExisting:', appendToExisting);

        // Check if query is recent (within last 10 seconds)
        const age = Date.now() - timestamp;
        console.log('⏰ SidePanel: Query age:', age, 'ms');

        if (age < 10000) {
          console.log('🔍 SidePanel: Processing floating query...');

          // Switch to chat tab first
          console.log('📑 SidePanel: Switching to chat tab');
          setActiveTab('chat');

          // If appendToExisting is true and we have existing messages, just add to the conversation
          if (appendToExisting && chatMessages.length > 0) {
            console.log('🔄 SidePanel: Appending to existing conversation with', chatMessages.length, 'messages');
          } else {
            console.log('🆕 SidePanel: Starting new conversation or no existing messages');
          }

          // Directly submit the query without setting state first
          console.log('🚀 SidePanel: Directly submitting floating query:', query);
          const userMessage: ChatMessage = {
            role: 'user',
            content: query,
            timestamp: new Date(),
          };

          setChatMessages(prev => [...prev, userMessage]);
          setIsLoading(true);

          try {
            // Use AI SDK for floating queries
            console.log('🤖 Using AI SDK for floating query...');
            
            // Include current page context only if we have actual content and current tab is not manually attached
            const context = currentPageInfo.hasInfo && currentPageInfo.content && currentPageInfo.title && !isCurrentTabAttached()
              ? currentPageInfo.content 
              : undefined;
            
            const response = await chrome.runtime.sendMessage({
              type: MessageType.ASK_INTELLA,
              payload: { question: query, context, model: selectedModel },
            });

            if (response.success) {
              const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.data,
                timestamp: new Date(),
                // Note: usedMemories will be populated by the backend automatically
              };
              setChatMessages(prev => [...prev, assistantMessage]);
            } else {
              throw new Error(response.error);
            }
          } catch (error) {
            console.error('Error in floating query submission:', error);
            const errorMessage: ChatMessage = {
              role: 'assistant',
              content: 'Sorry, I encountered an error. Please try again.',
              timestamp: new Date(),
            };
            setChatMessages(prev => [...prev, errorMessage]);
          } finally {
            setIsLoading(false);
          }

          // Clear the stored query
          console.log('🧹 SidePanel: Clearing stored query');
          await chrome.storage.session.remove('floating-query');
        } else {
          console.log('⏰ SidePanel: Floating query too old (', age, 'ms), ignoring');
          await chrome.storage.session.remove('floating-query');
        }
      } else {
        console.log('❌ SidePanel: No floating query found in session storage');
      }
    } catch (error) {
      console.error('💥 SidePanel: Error checking for floating query:', error);
    }
  };

  const loadCurrentPageInfo = async () => {
    try {
      console.log('🌐 Loading current page information...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Reset favicon error when loading new page
      setFaviconError(false);
      
      if (tab && tab.title && tab.url) {
        console.log('✅ Found tab info:', { title: tab.title, url: tab.url });
        
        // Get favicon URL
        let faviconUrl = tab.favIconUrl;
        
        // If no favicon, try to construct one from the URL
        if (!faviconUrl && tab.url) {
          try {
            const url = new URL(tab.url);
            faviconUrl = `${url.protocol}//${url.hostname}/favicon.ico`;
          } catch (e) {
            console.log('⚠️ Could not parse URL for favicon');
          }
        }
        
        // Try to get page content
        let pageContent = '';
        try {
          console.log('🔍 Requesting page content from content script...');
          const contentResponse = await chrome.runtime.sendMessage({
            type: MessageType.GET_PAGE_CONTENT,
          });
          
          console.log('📡 Content response:', {
            success: contentResponse?.success,
            hasData: !!contentResponse?.data,
            dataKeys: contentResponse?.data ? Object.keys(contentResponse.data) : [],
            error: contentResponse?.error
          });
          
          if (contentResponse.success && contentResponse.data) {
            // Format the page content for context
            const { content, title: pageTitle, description, headings, links } = contentResponse.data;
            
            console.log('📄 Extracted content details:', {
              pageTitle,
              description,
              contentLength: content?.length || 0,
              contentPreview: content?.substring(0, 100),
              headingsCount: headings?.length || 0,
              linksCount: links?.length || 0
            });
            
            pageContent = `Page Title: ${pageTitle}\n`;
            if (description) {
              pageContent += `Description: ${description}\n`;
            }
            pageContent += `\nPage Content:\n${content}`;
            console.log('✅ Loaded page content:', {
              totalLength: pageContent.length,
              preview: pageContent.substring(0, 200) + '...',
              hasValidContent: pageContent.length > 100
            });
          } else {
            console.warn('❌ Failed to get page content:', {
              success: contentResponse?.success,
              error: contentResponse?.error,
              hasData: !!contentResponse?.data
            });
          }
        } catch (contentError) {
          console.error('💥 Error loading page content:', {
            error: contentError,
            message: contentError instanceof Error ? contentError.message : 'Unknown error',
            stack: contentError instanceof Error ? contentError.stack : undefined
          });
        }
        
        setCurrentPageInfo({
          title: tab.title,
          favicon: faviconUrl,
          hasInfo: true,
          content: pageContent,
          tabId: tab.id,
          url: tab.url
        });

        // Load basic suggestions immediately, then load intelligent ones
        if (tab.url) {
          setAgentSuggestions(getBasicSuggestions(tab.url));
          setIntelligentSuggestionsLoaded(false);
          
          // Auto-load intelligent suggestions after a short delay if we have the necessary data
          setTimeout(async () => {
            if (suggestionMode === 'intelligent' && tab.title && pageContent) {
              try {
                console.log('🚀 Auto-loading intelligent suggestions on page load');
                const intelligentSuggestions = await getIntelligentSuggestions(tab.url!, tab.title, pageContent);
                setAgentSuggestions(intelligentSuggestions);
                setIntelligentSuggestionsLoaded(true);
              } catch (error) {
                console.error('❌ Failed to auto-load intelligent suggestions:', error);
                // Keep basic suggestions as fallback
              }
            }
          }, 100); // Small delay to let basic suggestions show first
        }
      } else {
        console.log('⚠️ Could not get tab information, using fallback');
        setCurrentPageInfo({
          title: 'Current Page Context',
          hasInfo: false,
          tabId: undefined,
          url: undefined
        });
      }
    } catch (error) {
      console.error('❌ Error loading current page info:', error);
      setCurrentPageInfo({
        title: 'Current Page Context',
        hasInfo: false,
        tabId: undefined
      });
    }
  };

  const clearCurrentPageInfo = () => {
    setCurrentPageInfo({
      title: '',
      hasInfo: false,
      content: undefined,
      tabId: undefined,
      url: undefined
    });
  };


  const loadIntelligentSuggestionsOnDemand = async () => {
    if (!intelligentSuggestionsLoaded && suggestionMode === 'intelligent' && currentPageInfo.url && currentPageInfo.content && currentPageInfo.title) {
      setIntelligentSuggestionsLoaded(true);
      try {
        console.log('🚀 Loading intelligent suggestions on demand');
        const intelligentSuggestions = await getIntelligentSuggestions(currentPageInfo.url, currentPageInfo.title, currentPageInfo.content);
        setAgentSuggestions(intelligentSuggestions);
      } catch (error) {
        console.error('❌ Failed to load intelligent suggestions:', error);
        // Keep basic suggestions as fallback
      }
    }
  };

  // Check if current tab is already manually attached
  const isCurrentTabAttached = () => {
    return currentPageInfo.tabId !== undefined && 
           attachedTabs.some(tab => tab.id === currentPageInfo.tabId);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Set upload progress state
    setUploadProgress({
      isUploading: true,
      fileName: file.name,
      status: 'uploading',
      message: 'Preparing to upload...'
    });

    // Add user message showing file selection
    const userMessage: ChatMessage = {
      role: 'user',
      content: `📎 Uploading file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);

    setShowUploadPopover(false);
    setIsLoading(true);

    try {
      // Update progress - getting collection
      setUploadProgress(prev => ({
        ...prev,
        message: 'Setting up collection...'
      }));

      // Get or create the collection for uploads
      const collectionId = await mieltoAPI.getOrCreateCollection();

      // Update progress - uploading
      setUploadProgress(prev => ({
        ...prev,
        status: 'uploading',
        message: `Uploading ${file.name}...`
      }));

      // Upload the file
      const uploadResult = await mieltoAPI.uploadToCollection(collectionId, [file], {
        label: `File upload from Intella: ${file.name}`,
        description: `File uploaded via Intella browser extension at ${new Date().toLocaleString()}`,
        metadata: {
          source: 'intella-extension',
          uploadType: 'manual',
          originalFilename: file.name,
          fileSize: file.size,
          fileType: file.type,
        }
      });

      // Update progress - processing
      setUploadProgress(prev => ({
        ...prev,
        status: 'processing',
        message: 'Processing content...'
      }));

      // Brief delay to show processing state
      await new Promise(resolve => setTimeout(resolve, 500));

      if (uploadResult.status === 'success' || (uploadResult.contents && uploadResult.contents.length > 0)) {
        const content = uploadResult.contents?.[0];

        // Update progress - success
        setUploadProgress(prev => ({
          ...prev,
          status: 'success',
          message: 'Upload completed successfully!'
        }));

        const successMessage: ChatMessage = {
          role: 'assistant',
          content: `✅ File uploaded successfully! I've processed "${file.name}" and it's now available for our conversation. ${content?.content ? 'I can see the content and answer questions about it.' : 'You can ask me questions about this file.'}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, successMessage]);

        // Hide progress after success
        setTimeout(() => {
          setUploadProgress({ isUploading: false });
        }, 2000);
      } else {
        throw new Error('Upload completed but no content was processed');
      }

    } catch (error) {
      console.error('File upload error:', error);

      // Update progress - error
      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      }));

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Sorry, there was an error uploading your file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or check your connection.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);

      // Hide progress after error
      setTimeout(() => {
        setUploadProgress({ isUploading: false });
      }, 3000);
    } finally {
      setIsLoading(false);

      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const toggleUploadPopover = () => {
    setShowUploadPopover(!showUploadPopover);
  };

  const handleScreenshot = async () => {
    setShowUploadPopover(false);

    try {
      // Capture screenshot using Chrome API
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 90
      });

      // Stage the screenshot instead of immediately sending it
      const stagedImage: StagedImage = {
        id: `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dataUrl,
        type: 'screenshot',
        timestamp: new Date(),
      };

      setStagedImages(prev => [...prev, stagedImage]);
    } catch (error) {
      console.error('Screenshot error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Sorry, there was an error capturing the screenshot: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleScreenshotRegion = async () => {
    setShowUploadPopover(false);

    try {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      const tabId = tabs[0].id;

      // Check if we can access the tab (not a chrome:// or extension page)
      if (tabs[0].url?.startsWith('chrome://') || tabs[0].url?.startsWith('chrome-extension://')) {
        throw new Error('Cannot capture screenshots on browser internal pages. Please navigate to a regular webpage.');
      }

      // Show screen capture overlay in the active tab
      await chrome.tabs.sendMessage(tabId, {
        type: MessageType.SHOW_SCREEN_CAPTURE_OVERLAY,
      });

      // The rest of the capture process will be handled by the processRegionCapture function
      // when it receives the CAPTURE_SCREEN_REGION message
    } catch (error) {
      console.error('Error starting region capture:', error);
      let errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (errorMsg.includes('Receiving end does not exist')) {
        errorMsg = 'The page needs to be refreshed before using screen capture. Please refresh this page and try again.';
      }

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ ${errorMsg}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const processRegionCapture = async (region: { x: number; y: number; width: number; height: number }) => {
    try {
      // Capture full screenshot using Chrome API
      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 90
      });

      // Crop the screenshot to the selected region
      const croppedDataUrl = await cropImage(dataUrl, region);

      // Stage the cropped screenshot instead of immediately sending it
      const stagedImage: StagedImage = {
        id: `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dataUrl: croppedDataUrl,
        type: 'region',
        timestamp: new Date(),
      };

      setStagedImages(prev => [...prev, stagedImage]);
    } catch (error) {
      console.error('Region capture error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Sorry, there was an error capturing the screenshot region: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const cropImage = (dataUrl: string, region: { x: number; y: number; width: number; height: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = region.width;
        canvas.height = region.height;

        // Draw the cropped region
        ctx.drawImage(
          img,
          region.x,
          region.y,
          region.width,
          region.height,
          0,
          0,
          region.width,
          region.height
        );

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  };

  const handleAttachCurrentPage = async () => {
    setShowUploadPopover(false);
    
    try {
      // Load current page info when user explicitly requests it
      await loadCurrentPageInfo();
      
      // Show user confirmation - note: currentPageInfo will be updated in next render
      // We'll just reload it and check the result
      const pageInfo = await (async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
      })();
      
      if (pageInfo && pageInfo.title) {
        const userMessage: ChatMessage = {
          role: 'user',
          content: `📄 Current page attached: ${pageInfo.title}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, userMessage]);
      }
    } catch (error) {
      console.error('Error attaching current page:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Sorry, there was an error attaching the current page: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const loadConversations = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await listConversations({ limit: 50 });

      dispatch({
        type: 'SET_CONVERSATIONS_CURSOR',
        payload: {
          conversations: response.data,
          total: response.total_count,
          nextCursor: response.next_cursor,
          prevCursor: response.prev_cursor,
          hasMore: response.has_more,
        }
      });

      console.log('💬 Loaded conversations:', response.data.length);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load conversations' });
    }
  };

  const handleNewChat = async () => {
    try {
      console.log('🆕 Creating new conversation...');
      const newConversation = await createConversation({
        title: `New Chat ${new Date().toLocaleString()}`,
      });

      // Add to conversation list and select it
      dispatch({ type: 'ADD_CONVERSATION', payload: newConversation });
      dispatch({ type: 'SELECT_CONVERSATION', payload: newConversation.id });

      // Clear current messages
      setChatMessages([]);

      console.log('✅ New conversation created:', newConversation.id);
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create conversation' });

      // Fallback to local new chat
      dispatch({ type: 'SELECT_CONVERSATION', payload: null });
      setChatMessages([]);
    }
  };

  const handleSwitchChat = () => {
    loadConversations(); // Refresh conversations when opening switcher
    setShowConversationSwitcher(true);
  };

  const handleSelectConversation = async (conversation: ConversationWithStats) => {
    try {
      console.log('🔄 Switching to conversation:', conversation.id);
      dispatch({ type: 'SELECT_CONVERSATION', payload: conversation.id });
      setIsLoading(true);

      // Load messages for the selected conversation
      const response = await getConversationWithMessages(conversation.id);
      const messages = response.data || [];

      const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
      }));

      setChatMessages(chatMessages);
      console.log('✅ Loaded conversation with', messages.length, 'messages');
    } catch (error) {
      console.error('Failed to load conversation:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load conversation' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    const currentConversation = conversationState.conversations.find(
      c => c.id === conversationState.selectedConversationId
    );

    if (!currentConversation) {
      // If no current conversation, just clear local messages
      if (chatMessages.length > 0) {
        const confirmed = window.confirm('Are you sure you want to clear this chat?');
        if (confirmed) {
          setChatMessages([]);
          console.log('🗑️ Local chat cleared');
        }
      }
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete "${currentConversation.title}"? This cannot be undone.`);
    if (confirmed) {
      try {
        console.log('🗑️ Deleting conversation:', currentConversation.id);
        await deleteConversation(currentConversation.id);

        // Remove from state and clear current chat
        dispatch({ type: 'DELETE_CONVERSATION', payload: currentConversation.id });
        setChatMessages([]);

        console.log('✅ Conversation deleted successfully');
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete conversation' });
        alert('Failed to delete conversation. Please try again.');
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // State tab functions (from popup)
  const checkAuthAndLoadData = async () => {
    const authenticated = await mieltoAuth.isAuthenticated();
    setIsAuthenticated(authenticated);

    if (authenticated) {
      loadPopupData();
    }
  };

  const handleLogin = async () => {
    setIsAuthenticated(true);
    await loadPopupData();
    await fetchAndSetApiKey();
  };

  const fetchAndSetApiKey = async () => {
    try {
      console.log('🔑 Fetching API key after login...');
      const apiKey = await getFirstActiveApiKey();

      if (apiKey) {
        console.log('✅ Found API key, updating settings...', {
          id: apiKey.id,
          label: apiKey.label,
          workspace_id: apiKey.workspace_id
        });

        // Update settings with the API key and workspace ID
        const response = await chrome.runtime.sendMessage({
          type: MessageType.UPDATE_SETTINGS,
          payload: {
            apiKey: apiKey.key,
            workspace_id: apiKey.workspace_id
          },
        });

        if (response.success) {
          console.log('✅ API key and workspace ID saved to settings');
          // Refresh settings state
          await loadPopupData();
        } else {
          console.error('❌ Failed to save API key to settings:', response.error);
        }
      } else {
        console.log('⚠️ No active API keys found');
      }
    } catch (error) {
      console.error('❌ Error fetching API key:', error);
    }
  };

  // Effect to redirect to State tab when not authenticated
  useEffect(() => {
    if (isAuthenticated === false && activeTab !== 'state') {
      setActiveTab('state');
    }
  }, [isAuthenticated, activeTab]);

  const loadPopupData = async () => {
    // Get recent memories
    const memoriesResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_MEMORIES,
    });

    if (memoriesResponse.success) {
      const memories = memoriesResponse.data;
      setMemoriesCount(memories.length);
      setRecentMemories(
        memories
          .sort((a: Memory, b: Memory) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, 5)
      );
    }

    // Get settings
    const settingsResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_SETTINGS,
    });

    if (settingsResponse.success) {
      setSettings(settingsResponse.data);
      setIsAnalysisActive(settingsResponse.data.isAnalysisActive ?? true);
      if (settingsResponse.data.selectedModel) {
        setSelectedModel(settingsResponse.data.selectedModel);
      }
      // Set suggestion mode from settings
      const intelligentEnabled = settingsResponse.data.ui?.intelligentSuggestionsEnabled ?? true;
      console.log('🔧 Settings loaded - intelligent suggestions enabled:', intelligentEnabled);
      const newMode = intelligentEnabled ? 'intelligent' : 'basic';
      console.log('🔧 Setting suggestion mode to:', newMode);
      setSuggestionMode(newMode);
      
      // Reload suggestions with the updated mode immediately
      if (currentPageInfo.url) {
        console.log('🔄 Immediately reloading suggestions with mode:', newMode);
        // Use the new mode directly instead of relying on state update
        if (newMode === 'intelligent') {
          // Load basic first as placeholder
          setAgentSuggestions(getBasicSuggestions(currentPageInfo.url));
          
          // Try intelligent if we have content
          if (currentPageInfo.content && currentPageInfo.title) {
            try {
              const intelligentSuggestions = await getIntelligentSuggestions(
                currentPageInfo.url, 
                currentPageInfo.title, 
                currentPageInfo.content
              );
              console.log('✅ Settings reload - Intelligent suggestions loaded:', intelligentSuggestions);
              setAgentSuggestions(intelligentSuggestions);
            } catch (error) {
              console.error('❌ Settings reload - Intelligent suggestions failed:', error);
            }
          } else {
            console.log('⚠️ Settings reload - Missing content for intelligent suggestions');
          }
        } else {
          setAgentSuggestions(getBasicSuggestions(currentPageInfo.url));
        }
      }
    }
  };

  const loadSelectedModel = async () => {
    try {
      const settingsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_SETTINGS,
      });

      if (settingsResponse.success && settingsResponse.data.selectedModel) {
        setSelectedModel(settingsResponse.data.selectedModel);
      }
    } catch (error) {
      console.error('Failed to load selected model:', error);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    
    // Save to settings
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: { selectedModel: modelId },
      });

      if (!response.success) {
        console.error('Failed to save model selection:', response.error);
      }
    } catch (error) {
      console.error('Error saving model selection:', error);
    }
  };

  const toggleAnalysisState = async () => {
    const newState = !isAnalysisActive;
    setIsAnalysisActive(newState);

    // Update settings with new analysis state
    const response = await chrome.runtime.sendMessage({
      type: MessageType.UPDATE_SETTINGS,
      payload: { isAnalysisActive: newState },
    });

    if (!response.success) {
      // Revert on failure
      setIsAnalysisActive(!newState);
      console.error('Failed to update analysis state:', response.error);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleLogout = async () => {
    try {
      // Send logout message to background script
      const response = await chrome.runtime.sendMessage({
        type: MessageType.LOGOUT,
      });

      if (response.success) {
        // Clear all local state
        setIsAuthenticated(false);
        setChatMessages([]);
        setMemories([]);
        setRecentMemories([]);
        setSettings(null);
        setMemoriesCount(0);
        setIsAnalysisActive(true);

        // Clean up voice chat
        await handleEndVoiceChat();

        // Force refresh of the State tab to show login screen
        setActiveTab('state');

        console.log('✅ Successfully logged out');
      } else {
        console.error('❌ Logout failed:', response.error);
        alert('Failed to logout. Please try again.');
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      alert('An error occurred during logout. Please try again.');
    }
  };

  // Voice chat handlers (browser speech-to-text)
  const handleStartVoiceChat = async () => {
    setIsConnecting(true);
    
    // Check if Speech Recognition API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setIsConnecting(false);
      return;
    }

    // Test microphone access
    try {
      console.log('🔍 Testing microphone access...');
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone access confirmed');
    } catch (permError) {
      console.error('❌ Microphone permission denied:', permError);
      setIsConnecting(false);
      alert('Microphone access is required for voice input. Please:\n\n1. Click the microphone icon in your browser address bar\n2. Select "Allow"\n3. Try again\n\nOr go to Chrome Settings > Privacy and security > Site Settings > Microphone and allow access for this extension.');
      return;
    }
    
    try {
      console.log('🎙️ Starting speech recognition...');
      
      // Initialize speech recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      // Set up event handlers
      recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
        setIsMicEnabled(true);
      };

      recognition.onresult = async (event: any) => {
        let transcript = '';
        
        // Get the latest result
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        
        if (transcript.trim()) {
          console.log('🗣️ Speech transcript:', transcript);
          
          // Add user message to chat
          const userMessage: ChatMessage = {
            role: 'user',
            content: transcript.trim(),
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, userMessage]);

          // Send to AI
          try {
            const context = currentPageInfo.hasInfo && currentPageInfo.content && currentPageInfo.title && !isCurrentTabAttached()
              ? currentPageInfo.content 
              : undefined;
            
            const conversationHistory = chatMessages.map(msg => ({
              role: msg.role,
              content: msg.content,
            }));
            
            const response = await chrome.runtime.sendMessage({
              type: MessageType.ASK_INTELLA,
              payload: { 
                question: transcript.trim(), 
                context, 
                model: selectedModel,
                conversationHistory,
              },
            });

            if (response.success) {
              const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.data,
                timestamp: new Date(),
                toolExecutions: (response as any).toolExecutions,
              };
              setChatMessages(prev => [...prev, assistantMessage]);
            }
          } catch (error) {
            console.error('Error processing speech:', error);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Continue listening for no-speech errors
          return;
        }
        
        setIsListening(false);
        if (event.error === 'not-allowed') {
          alert('Microphone access was denied. Please allow microphone access and try again.');
        }
      };

      recognition.onend = () => {
        console.log('🔇 Speech recognition ended');
        if (isVoiceChatActive && isMicEnabled) {
          // Restart if we're supposed to be listening
          setTimeout(() => {
            if (speechRecognition) {
              try {
                speechRecognition.start();
              } catch (e) {
                console.log('Recognition restart failed:', e);
              }
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      // Start recognition
      recognition.start();
      setSpeechRecognition(recognition);
      setIsVoiceChatActive(true);
      setIsMicEnabled(true);
      
      // Add system message to chat
      const systemMessage: ChatMessage = {
        role: 'assistant',
        content: '🎙️ Voice input started! You can now speak to me directly.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, systemMessage]);
      
      console.log('✅ Speech recognition started successfully');
    } catch (error) {
      console.error('❌ Failed to start speech recognition:', error);
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Voice input failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndVoiceChat = async () => {
    if (speechRecognition) {
      try {
        console.log('🎙️ Ending voice input...');
        speechRecognition.stop();
        setSpeechRecognition(null);
        setIsVoiceChatActive(false);
        setIsMicEnabled(false);
        setIsListening(false);
        
        // Add system message to chat
        const systemMessage: ChatMessage = {
          role: 'assistant',
          content: '🎙️ Voice input ended. You can continue chatting with text.',
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, systemMessage]);
        
        console.log('✅ Voice input ended successfully');
      } catch (error) {
        console.error('❌ Error ending voice input:', error);
      }
    }
  };

  const handleToggleMicrophone = async () => {
    if (!speechRecognition) return;
    
    try {
      if (isMicEnabled && isListening) {
        console.log('🔇 Stopping speech recognition...');
        speechRecognition.stop();
        setIsMicEnabled(false);
        setIsListening(false);
      } else {
        console.log('🎤 Starting speech recognition...');
        speechRecognition.start();
        setIsMicEnabled(true);
      }
    } catch (error) {
      console.error('❌ Error toggling microphone:', error);
      alert('Failed to toggle microphone. Please try again.');
    }
  };

  // Tab attachment handlers
  const handleOpenTabSelector = () => {
    setShowTabSelector(true);
  };

  const handleSelectTab = (tab: TabInfo) => {
    // Check if tab is already attached
    if (!attachedTabs.some(attachedTab => attachedTab.id === tab.id)) {
      setAttachedTabs(prev => [...prev, tab]);
      console.log('📑 Tab attached:', tab.title, '- Total attached:', attachedTabs.length + 1);
    }
  };

  const handleRemoveTab = (tabId: number) => {
    setAttachedTabs(prev => prev.filter(tab => tab.id !== tabId));
  };

  const handleTabMention = (tab: TabInfo) => {
    // Add to attached tabs if not already present
    if (!attachedTabs.some(attachedTab => attachedTab.id === tab.id)) {
      setAttachedTabs(prev => [...prev, tab]);
    }
  };

  const handleSendMessageWithTabs = async () => {
    // Allow sending if there's a query OR if there are staged images
    if ((!query.trim() && stagedImages.length === 0) || isLoading) return;

    // Build user message content with image indicators
    let messageContent = query || '';
    if (stagedImages.length > 0) {
      const imageIndicator = stagedImages.length === 1
        ? '📸 [Image attached]'
        : `📸 [${stagedImages.length} images attached]`;
      messageContent = messageContent
        ? `${messageContent}\n\n${imageIndicator}`
        : imageIndicator;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    const currentQuery = query || 'Analyze the attached image(s)';
    setQuery('');
    setIsLoading(true);

    try {
      console.log('🤖 Sending message with', attachedTabs.length, 'attached tabs...');

      // Include current page context only if we have actual content and current tab is not already manually attached
      let context = currentPageInfo.hasInfo && currentPageInfo.content && currentPageInfo.title && !isCurrentTabAttached()
        ? currentPageInfo.content
        : '';

      // Add attached tabs content to context
      if (attachedTabs.length > 0) {
        console.log('📑 Retrieving content from attached tabs:', attachedTabs.map(t => t.title));
        const tabContexts = [];
        for (const tab of attachedTabs) {
          try {
            console.log('📄 Getting content from tab:', tab.title);
            const tabContentResponse = await chrome.runtime.sendMessage({
              type: MessageType.GET_TAB_CONTENT,
              payload: { tabId: tab.id },
            });

            if (tabContentResponse.success && tabContentResponse.data?.content) {
              const content = tabContentResponse.data.content;
              const tabContext = `\n--- Content from tab: ${tab.title} (${tab.url}) ---\n${content.title ? `Title: ${content.title}\n` : ''}${content.description ? `Description: ${content.description}\n` : ''}${content.content || 'Content not available'}`;
              tabContexts.push(tabContext);
              console.log('✅ Retrieved content from tab:', tab.title, '- length:', content.content?.length || 0);
            } else {
              console.warn('⚠️ Failed to get content from tab:', tab.title, tabContentResponse.error);
              tabContexts.push(`\n--- Reference to tab: ${tab.title} (${tab.url}) ---\nNote: Content from this tab could not be retrieved.`);
            }
          } catch (error) {
            console.warn('❌ Error getting content from tab:', tab.title, error);
            tabContexts.push(`\n--- Reference to tab: ${tab.title} (${tab.url}) ---\nNote: Content from this tab could not be retrieved.`);
          }
        }

        if (tabContexts.length > 0) {
          const tabContextString = tabContexts.join('\n');
          context = context
            ? `${context}\n\n--- Additional Context from Attached Tabs ---${tabContextString}`
            : `--- Context from Attached Tabs ---${tabContextString}`;
          console.log('📦 Total context with tabs - length:', context.length, 'characters');
        }
      }

      // Convert chatMessages to conversation history format
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      console.log('🚀 Sending to AI with context length:', context.length);

      // Prepare payload with staged images if any
      const payload: any = {
        question: currentQuery,
        context,
        model: selectedModel,
        conversationHistory,
        attachedTabIds: attachedTabs.map(t => t.id), // Include tab IDs for reference
      };

      // Add staged images to payload
      if (stagedImages.length > 0) {
        console.log('📸 Including', stagedImages.length, 'staged image(s) in message');
        // For now, we'll send the first image as 'screenshot' for backward compatibility
        // In the future, we can support multiple images
        payload.screenshot = stagedImages[0].dataUrl;

        // If there are multiple images, add them as an array
        if (stagedImages.length > 1) {
          payload.screenshots = stagedImages.map(img => img.dataUrl);
        }
      }

      const response = await chrome.runtime.sendMessage({
        type: MessageType.ASK_INTELLA,
        payload,
      });

      if (response.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.data,
          timestamp: new Date(),
          toolExecutions: (response as any).toolExecutions,
        };
        setChatMessages(prev => [...prev, assistantMessage]);

        // Clear attached tabs and staged images after successful message
        console.log('🧹 Clearing attached tabs and staged images after successful message');
        setAttachedTabs([]);
        setStagedImages([]);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('💥 Chat error:', error);

      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-darkBg-primary">
      {/* Header with model selector on left and menu on right */}
      <div className="flex items-center justify-between p-3 dark:border-darkBg-secondary bg-white dark:bg-darkBg-primary">
        {/* Left side - Model Selector */}
        <div className="flex items-center">
          {activeTab === 'chat' && (
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
            />
          )}
        </div>
        {/* Right side - Theme toggle and menu */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowChatMenu(prev => !prev);
              }}
              className="p-2 text-gray-600 dark:text-darkText-secondary hover:text-gray-900 dark:hover:text-darkText-primary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary rounded-lg transition"
              title="Chat options"
            >
              <div className="relative w-5 h-5">
                <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  showChatMenu ? 'rotate-45 opacity-0' : 'rotate-0 opacity-100'
                }`}>
                  <div className="w-full h-0.5 bg-current absolute top-1 rounded"></div>
                  <div className="w-full h-0.5 bg-current absolute bottom-1 rounded"></div>
                </div>
                <div className={`absolute inset-0 transition-all duration-300 ease-in-out ${
                  showChatMenu ? 'rotate-0 opacity-100' : 'rotate-45 opacity-0'
                }`}>
                  <div className="w-full h-0.5 bg-current absolute top-1/2 -translate-y-1/2 rotate-45 rounded"></div>
                  <div className="w-full h-0.5 bg-current absolute top-1/2 -translate-y-1/2 -rotate-45 rounded"></div>
                </div>
              </div>
            </button>
            <ChatMenuPopover
              isOpen={showChatMenu}
              onClose={() => setShowChatMenu(false)}
              onNewChat={handleNewChat}
              onSwitchChat={handleSwitchChat}
              onDeleteChat={handleDeleteChat}
              onOpenSettings={openOptions}
            />
            <ConversationSwitcher
              isOpen={showConversationSwitcher}
              onClose={() => setShowConversationSwitcher(false)}
              conversations={conversationState.conversations}
              currentConversationId={conversationState.selectedConversationId || undefined}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewChat}
              isLoading={conversationState.loading}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!isAuthenticated ? (
          // Force users to State tab if not authenticated
          <div className="h-full flex items-center justify-center p-8 text-center">
            <div>
              <Sparkles size={48} className="text-gray-300 dark:text-darkText-tertiary mb-4 mx-auto" />
              <p className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">Please Sign In</p>
              <p className="text-gray-500 dark:text-darkText-tertiary mb-4">You need to be authenticated to access this feature.</p>
              <button
                onClick={() => setActiveTab('state')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                Go to Settings
              </button>
            </div>
          </div>
        ) : activeTab === 'chat' ? (
          <div className="h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-auto p-2 space-y-2">

              {/* Chat Messages */}
              <>
              {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`max-w-[85%] ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'
                        }`}
                    >
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-darkBg-secondary text-gray-900 dark:text-darkText-primary'
                          }`}
                      >
                        {msg.role === 'user' ? (
                          <div className="text-sm leading-relaxed text-white">{msg.content}</div>
                        ) : (
                          <MarkdownRenderer content={msg.content} className="text-sm" />
                        )}
                        {msg.toolExecutions && msg.toolExecutions.length > 0 && (() => {
                          const messageId = `${idx}-tools`;
                          const isExpanded = expandedToolExecutions.has(messageId);
                          
                          return (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-darkBg-secondary">
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedToolExecutions);
                                  if (isExpanded) {
                                    newExpanded.delete(messageId);
                                  } else {
                                    newExpanded.add(messageId);
                                  }
                                  setExpandedToolExecutions(newExpanded);
                                }}
                                className="w-full text-xs text-gray-500 dark:text-darkText-tertiary flex items-center gap-1 hover:text-gray-700 dark:hover:text-darkText-secondary transition-colors"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Used {msg.toolExecutions.length} tool{msg.toolExecutions.length > 1 ? 's' : ''}</span>
                                <ChevronDown 
                                  className={`w-3 h-3 transition-transform duration-200 ${
                                    isExpanded ? 'rotate-180' : 'rotate-0'
                                  }`} 
                                />
                              </button>
                              {isExpanded && (
                                <div className="mt-2 space-y-1.5">
                                  {msg.toolExecutions.map((toolExec, i) => (
                                    <div 
                                      key={i} 
                                      className={`text-xs rounded px-2 py-1.5 ${
                                        toolExec.success 
                                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{toolExec.toolName}</span>
                                        {toolExec.executionTime && (
                                          <span className="text-xs opacity-75 ml-2">
                                            {toolExec.executionTime}ms
                                          </span>
                                        )}
                                      </div>
                                      {Object.keys(toolExec.args).length > 0 && (
                                        <div className="mt-1 text-xs opacity-75 break-all overflow-hidden">
                                          {JSON.stringify(toolExec.args, null, 0).slice(0, 100)}
                                          {JSON.stringify(toolExec.args).length > 100 ? '...' : ''}
                                        </div>
                                      )}
                                      {toolExec.error && (
                                        <div className="mt-1 text-xs opacity-90">
                                          Error: {toolExec.error}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {msg.usedMemories && msg.usedMemories.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-darkBg-secondary">
                            <div className="text-xs text-gray-500 dark:text-darkText-tertiary mb-1">
                              📚 Based on {msg.usedMemories.length} memory{msg.usedMemories.length > 1 ? 'ies' : ''}:
                            </div>
                            <div className="space-y-1">
                              {msg.usedMemories.map((memory, i) => (
                                <div key={i} className="text-xs bg-white dark:bg-darkBg-tertiary rounded px-2 py-1 text-gray-700 dark:text-darkText-secondary">
                                  {memory.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="max-w-[85%] mr-auto">
                      <div className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-darkBg-secondary">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 dark:bg-darkText-tertiary rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-gray-400 dark:bg-darkText-tertiary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                          <span className="w-2 h-2 bg-gray-400 dark:bg-darkText-tertiary rounded-full animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                      </div>
                    </div>
                  )}


                  <div ref={chatEndRef} />
                </>
            </div>

            {/* Upload Progress */}
            {uploadProgress.isUploading && (
              <div className="border-t border-b border-gray-200 dark:border-darkBg-secondary bg-blue-50 dark:bg-darkBg-tertiary px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {uploadProgress.status === 'uploading' && <Loader2 size={16} className="text-blue-600 dark:text-blue-400 animate-spin" />}
                    {uploadProgress.status === 'processing' && <Loader2 size={16} className="text-blue-600 dark:text-blue-400 animate-spin" />}
                    {uploadProgress.status === 'success' && <CheckCircle size={16} className="text-green-600 dark:text-green-400" />}
                    {uploadProgress.status === 'error' && <AlertCircle size={16} className="text-red-600 dark:text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary truncate">
                      {uploadProgress.fileName}
                    </div>
                    <div className={`text-xs ${uploadProgress.status === 'success' ? 'text-green-600 dark:text-green-400' :
                        uploadProgress.status === 'error' ? 'text-red-600 dark:text-red-400' :
                          'text-blue-600 dark:text-blue-400'
                      }`}>
                      {uploadProgress.message}
                    </div>
                  </div>
                  {uploadProgress.status === 'uploading' || uploadProgress.status === 'processing' ? (
                    <div className="w-12 h-1 bg-gray-200 dark:bg-darkBg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Suggestions - Always show when available */}
            {agentSuggestions.length > 0 && (
              <div className="bg-white dark:bg-darkBg-primary">
                {/* Header with minimize button */}
                <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-darkBg-primary">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-darkText-primary">
                      {suggestionMode === 'intelligent' ? 'Intelligent' : ''} Prompts for {currentPageInfo.url ? (() => {
                        try {
                          return new URL(currentPageInfo.url).hostname.replace('www.', '');
                        } catch {
                          return 'this page';
                        }
                      })() : 'this page'}
                    </div>
                    <span className="inline-flex items-center bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded">
                      NEW
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      if (suggestionsMinimized) {
                        await loadIntelligentSuggestionsOnDemand();
                      }
                      setSuggestionsMinimized(!suggestionsMinimized);
                    }}
                    className="p-1 text-gray-500 dark:text-darkText-tertiary hover:text-gray-700 dark:hover:text-darkText-secondary transition-colors rounded"
                    title={suggestionsMinimized ? 'Expand suggestions' : 'Minimize suggestions'}
                  >
                    {suggestionsMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
                
                {/* Suggestions content - collapsible with animation */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  suggestionsMinimized ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
                }`}>
                  <div className="px-4 py-3">
                    <div className="space-y-2">
                      {agentSuggestions.slice(0, 3).map((suggestion, index) => (
                        <div
                          key={index}
                          className="relative group"
                        >
                          <button
                            onClick={() => {
                              setQuery(suggestion.prompt);
                              // Auto-execute the prompt
                              setTimeout(() => handleSendMessageWithTabs(), 100);
                            }}
                            className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-darkBg-secondary flex items-center justify-center flex-shrink-0">
                              <span className="text-sm">{suggestion.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary mb-0.5">{suggestion.title}</div>
                              <div className="text-xs text-gray-500 dark:text-darkText-tertiary line-clamp-2">{suggestion.description}</div>
                            </div>
                          </button>
                          {/* Pen icon for editing */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuery(suggestion.prompt);
                              // Focus the input but don't auto-execute
                            }}
                            className="absolute top-1 right-1 p-1.5 bg-white dark:bg-darkBg-primary rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition-all opacity-0 group-hover:opacity-100"
                            title="Edit this prompt"
                          >
                            <Edit3 size={12} className="text-gray-600 dark:text-darkText-secondary" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-darkBg-secondary bg-white dark:bg-darkBg-primary p-2">
              {/* Staged images thumbnails */}
              {stagedImages.length > 0 && (
                <div className="px-2 mb-2">
                  <div className="flex items-center gap-2 overflow-x-auto py-1 [&::-webkit-scrollbar]:thin [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                    {stagedImages.map((image) => (
                      <div
                        key={image.id}
                        className="relative flex-shrink-0 group"
                      >
                        <img
                          src={image.dataUrl}
                          alt={`${image.type} thumbnail`}
                          className="w-16 h-16 object-cover rounded-lg border-2 border-blue-500 dark:border-blue-400"
                        />
                        <button
                          onClick={() => setStagedImages(prev => prev.filter(img => img.id !== image.id))}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context indicator and attached tabs */}
              <div className="px-2 mb-2">
                {/* All tabs (current page + attached) in pill format with @ button inline */}
                <div className="flex items-center gap-1 overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {/* @ button for tab selection - inline with tabs */}
                  <button
                    ref={tabSelectorButtonRef}
                    onClick={handleOpenTabSelector}
                    className="flex-shrink-0 p-1.5 text-gray-600 dark:text-darkText-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition border border-gray-300 dark:border-darkBg-secondary"
                    title="Attach tab"
                  >
                    <AtSign size={14} />
                  </button>
                  <TabSelector
                    isOpen={showTabSelector}
                    onClose={() => setShowTabSelector(false)}
                    onSelectTab={handleSelectTab}
                    currentTabId={currentPageInfo.tabId}
                    buttonRef={tabSelectorButtonRef}
                  />

                  {/* Current page context as pill - only show if there's a title and current tab is not manually attached */}
                  {currentPageInfo.title && !isCurrentTabAttached() && (
                    <div
                      className="flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-lg text-xs whitespace-nowrap flex-shrink-0"
                      title={`Current page: ${currentPageInfo.title}${currentPageInfo.hasInfo ? `\n${currentPageInfo.content?.substring(0, 100) || 'Page content available'}` : '\nNo page context available'}`}
                    >
                      <div className="w-3 h-3 flex-shrink-0">
                        {currentPageInfo.hasInfo && currentPageInfo.favicon && !faviconError ? (
                          <img
                            src={currentPageInfo.favicon}
                            alt=""
                            className="w-3 h-3"
                            onError={() => {
                              setFaviconError(true);
                            }}
                          />
                        ) : (
                          <Zap size={10} className="text-green-600 dark:text-green-300" />
                        )}
                      </div>
                      <span className="font-medium">
                        {currentPageInfo.title.length > 20 ? currentPageInfo.title.substring(0, 20) + '...' : currentPageInfo.title}
                      </span>
                      <button
                        onClick={clearCurrentPageInfo}
                        className="p-0.5 hover:bg-green-200 dark:hover:bg-green-800 rounded transition"
                        title="Clear page context"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  
                  {/* Attached tabs */}
                  {attachedTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-lg text-xs whitespace-nowrap flex-shrink-0"
                      title={`${tab.title}\n${tab.url}`}
                    >
                      <div className="w-3 h-3 flex-shrink-0">
                        {tab.favIconUrl ? (
                          <img
                            src={tab.favIconUrl}
                            alt=""
                            className="w-3 h-3"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const icon = document.createElement('div');
                                icon.innerHTML = '<div class="w-3 h-3 flex items-center justify-center text-blue-600 dark:text-blue-300"><svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg></div>';
                                parent.appendChild(icon.firstChild as Node);
                              }
                            }}
                          />
                        ) : (
                          <Zap size={10} className="text-blue-600 dark:text-blue-300" />
                        )}
                      </div>
                      <span className="font-medium">
                        {tab.title.length > 20 ? tab.title.substring(0, 20) + '...' : tab.title}
                      </span>
                      <button
                        onClick={() => handleRemoveTab(tab.id)}
                        className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition"
                        title="Remove tab"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Voice Chat Controls */}
              {isVoiceChatActive && (
                <div className="px-2 mb-2">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-darkBg-tertiary border border-blue-200 dark:border-darkBg-secondary rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isMicEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Voice Chat {isMicEnabled ? 'Active' : 'Muted'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleMicrophone}
                        className={`p-2 rounded-lg transition ${isMicEnabled ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
                        title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                      >
                        {isMicEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                      </button>
                      <button
                        onClick={handleEndVoiceChat}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                        title="End voice chat"
                      >
                        <PhoneOff size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* New layout with corner buttons and full-width textarea */}
              <div className="relative">
                {/* Full-width text area */}
                <MentionInput
                  ref={chatInputRef}
                  value={query}
                  onChange={setQuery}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessageWithTabs()}
                  onTabMention={handleTabMention}
                  placeholder="Ask anything (use @ to mention tabs, Shift+Enter for new line)"
                  disabled={isLoading}
                  className="w-full pl-12 pr-12 py-3 focus:outline-none bg-transparent text-gray-900 dark:text-darkText-primary placeholder:text-gray-500 dark:placeholder:text-darkText-tertiary"
                />
                
                {/* Upload Button - Bottom Left */}
                <div className="absolute bottom-1 left-1">
                  <button
                    onClick={toggleUploadPopover}
                    className="p-2 text-gray-600 dark:text-darkText-secondary hover:text-gray-900 dark:hover:text-darkText-primary transition rounded-lg hover:bg-gray-100 dark:hover:bg-darkBg-tertiary"
                    disabled={isLoading || uploadProgress.isUploading}
                    title="Quick actions"
                  >
                    {uploadProgress.isUploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                  </button>

                  <QuickActionsPopover
                    isOpen={showUploadPopover}
                    onClose={() => setShowUploadPopover(false)}
                    onFileUpload={() => fileInputRef.current?.click()}
                    onScreenshot={handleScreenshot}
                    onScreenshotRegion={handleScreenshotRegion}
                    onAttachCurrentPage={handleAttachCurrentPage}
                    isUploading={uploadProgress.isUploading}
                  />

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="*/*"
                    disabled={uploadProgress.isUploading}
                  />
                </div>
                
                {/* Voice Chat Button - Bottom Right */}
                {!isVoiceChatActive && (
                  <div className="absolute bottom-1 right-1">
                    <button
                      onClick={handleStartVoiceChat}
                      disabled={isConnecting || !settings?.apiKey}
                      className="p-2 text-gray-600 dark:text-darkText-secondary hover:text-blue-600 dark:hover:text-blue-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-darkBg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!settings?.apiKey ? 'API key required for voice chat' : 'Start voice chat'}
                    >
                      {isConnecting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Mic size={16} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'memories' ? (
          <div className="h-full flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-darkBg-secondary bg-white dark:bg-darkBg-primary">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-darkText-tertiary" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchMemories(e.target.value)}
                    placeholder="Search memories..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                  />
                </div>
                <button
                  onClick={loadMemories}
                  className="p-2 text-gray-600 dark:text-darkText-secondary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-darkBg-tertiary rounded-lg transition"
                  title="Refresh memories"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Memories List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {(() => {
                console.log('📚 SidePanel render: memories.length =', memories.length, 'memories =', memories);
                return null;
              })()}
              {memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BookOpen size={48} className="text-gray-300 dark:text-darkText-tertiary mb-4" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">No memories yet</p>
                  <p className="text-sm text-gray-500 dark:text-darkText-tertiary max-w-xs">
                    Browse the web and Intella will automatically capture interesting pages.
                  </p>
                </div>
              ) : (
                memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="p-4 bg-gray-50 dark:bg-darkBg-secondary rounded-xl hover:bg-gray-100 dark:hover:bg-darkBg-tertiary cursor-pointer transition"
                    onClick={() => window.open(memory.url, '_blank')}
                  >
                    <div className="text-xs text-gray-500 dark:text-darkText-tertiary mb-2 font-medium">
                      {memory.title.length > 60 ? memory.title.substring(0, 60) + '...' : memory.title}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-darkText-primary mb-3 font-medium leading-relaxed">
                      {memory.summary}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-darkText-tertiary">{formatDate(memory.timestamp)}</span>
                      {memory.keywords.length > 0 && (
                        <div className="flex gap-1">
                          {memory.keywords.slice(0, 2).map((keyword, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded text-xs"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'state' ? (
          // Show loading state while checking authentication
          isAuthenticated === null ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-blue-600 dark:text-blue-400">Loading...</p>
              </div>
            </div>
          ) : !isAuthenticated ? (
            // Show login screen if not authenticated
            <div className="h-full">
              <LoginScreen onLogin={handleLogin} />
            </div>
          ) : (
            // Show authenticated state content (popup content)
            <div className="h-full flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={24} />
                    <h1 className="text-xl font-bold">Intella State</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleLogout}
                      className="p-2 hover:bg-white/20 rounded-lg transition text-sm"
                      title="Logout"
                    >
                      Logout
                    </button>
                    <button
                      onClick={openOptions}
                      className="p-2 hover:bg-white/20 rounded-lg transition"
                      title="Settings"
                    >
                      <SettingsIcon size={20} />
                    </button>
                  </div>
                </div>

                {/* Analysis State Toggle */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-xs opacity-75 mb-1">Memory Analysis</div>
                      <div className="text-sm font-medium">
                        {isAnalysisActive ? 'Active' : 'Paused'}
                        {!isAnalysisActive && (
                          <div className="text-xs opacity-60 mt-0.5">Paused</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={toggleAnalysisState}
                      className={`p-2 rounded-lg transition ${isAnalysisActive ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}
                    >
                      {isAnalysisActive ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 p-4 border-b border-gray-200 dark:border-darkBg-secondary">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-darkBg-tertiary dark:to-darkBg-tertiary p-3 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{memoriesCount}</div>
                  <div className="text-xs text-gray-600 dark:text-darkText-tertiary">Memories</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-darkBg-tertiary dark:to-darkBg-tertiary p-3 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {settings?.enableInlineAssistant ? 'ON' : 'OFF'}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-darkText-tertiary">Writing Helper</div>
                </div>
              </div>

              {/* Quick Tip */}
              <div className="px-4 py-4 border-b border-gray-200 dark:border-darkBg-secondary">
                <div className="bg-blue-50 dark:bg-darkBg-tertiary border border-blue-200 dark:border-darkBg-secondary rounded-lg p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    💡 Tip: Right-click on any text and select "Ask Intella" to capture and save content
                  </p>
                </div>
              </div>

              {/* Recent Memories */}
              <div className="flex-1 p-4 overflow-auto">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-darkText-secondary mb-2 flex items-center gap-2">
                  <BookOpen size={16} />
                  Recent Memories
                </h2>

                {recentMemories.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-darkText-tertiary">
                    <BookOpen size={40} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No memories yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className="p-3 bg-gray-50 dark:bg-darkBg-secondary rounded-lg hover:bg-gray-100 dark:hover:bg-darkBg-tertiary cursor-pointer transition"
                        onClick={() => window.open(memory.url, '_blank')}
                      >
                        <div className="text-sm font-medium text-gray-800 dark:text-darkText-secondary truncate mb-1">
                          {memory.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-darkText-tertiary line-clamp-2 mb-2">
                          {memory.summary}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-darkText-tertiary">
                          <span>{formatDate(memory.timestamp)}</span>
                          {memory.keywords.length > 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                              {memory.keywords[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-200 dark:border-darkBg-secondary bg-gray-50 dark:bg-darkBg-secondary text-center">
                <button
                  onClick={openOptions}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  View all memories & settings →
                </button>
              </div>
            </div>
          )
        ) : activeTab === 'settings' ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <SettingsIcon size={48} className="text-gray-300 dark:text-darkText-tertiary mb-4" />
            <p className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">Settings Tab</p>
            <p className="text-sm text-gray-500 dark:text-darkText-tertiary">This is a demo tab to show scrolling</p>
          </div>
        ) : activeTab === 'history' ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <RefreshCw size={48} className="text-gray-300 dark:text-darkText-tertiary mb-4" />
            <p className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">History Tab</p>
            <p className="text-sm text-gray-500 dark:text-darkText-tertiary">This is a demo tab to show scrolling</p>
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <Search size={48} className="text-gray-300 dark:text-darkText-tertiary mb-4" />
            <p className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">Analytics Tab</p>
            <p className="text-sm text-gray-500 dark:text-darkText-tertiary">This is a demo tab to show scrolling</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Wrapper component that provides theme context
const SidePanel: React.FC = () => {
  return (
    <ThemeProvider>
      <SidePanelInner />
    </ThemeProvider>
  );
};

// Mount side panel
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<SidePanel />);
}

