/**
 * Intella Side Panel Component (Chrome Side Panel API)
 * Native browser side panel for AI assistance and memory search
 */

import React, { useState, useEffect, useRef, useReducer } from 'react';
import ReactDOM from 'react-dom/client';
import { Send, Search, BookOpen, Sparkles, Settings as SettingsIcon, RefreshCw, Plus, CheckCircle, AlertCircle, Loader2, Menu, Eye, EyeOff, Zap, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { MessageType } from '@/types/messages';
import { Memory, UserSettings } from '@/types/memory';
import { mieltoAPI } from '@/utils/api';
import { QuickActionsPopover } from '@/components/QuickActionsPopover';
import { ChatMenuPopover } from '@/components/ChatMenuPopover';
import { ConversationSwitcher } from '@/components/ConversationSwitcher';
import { LoginScreen } from '@/components/LoginScreen';
import { conversationReducer, initialConversationState } from '@/reducers/conversationReducer';
import { listConversations, createConversation, deleteConversation, getConversationWithMessages } from '@/handlers/conversation.handler';
import type { ConversationWithStats } from '@/handlers/conversation.handler';
import { getFirstActiveApiKey } from '@/handlers/apikey.handler';
import { mieltoAuth } from '@/lib/auth';
import { ThemeProvider } from '@/components/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LiveKitVoiceChat, createLiveKitToken } from '@/utils/livekit';
import '../styles/app.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  usedMemories?: Memory[];
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
  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    fileName?: string;
    status?: 'uploading' | 'processing' | 'success' | 'error';
    message?: string;
  }>({ isUploading: false });
  // const [isStreaming, setIsStreaming] = useState(false);
  
  // Voice chat state
  const [voiceChat, setVoiceChat] = useState<LiveKitVoiceChat | null>(null);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);

  // State tab variables (from popup)
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
  }>({ title: 'Current Page Context', hasInfo: false });
  const [faviconError, setFaviconError] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('📚 SidePanel: useEffect mounting - loading memories...');
    loadMemories();
    checkForFloatingQuery();
    loadConversations();
    checkAuthAndLoadData();
    loadCurrentPageInfo();

    // Establish connection with background script for close detection
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    console.log('📱 SidePanel: Connected to background script');

    // Listen for close messages
    const messageListener = (message: any) => {
      if (message.type === 'CLOSE_SIDEPANEL') {
        console.log('📱 SidePanel: Received close message, closing...');
        window.close();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Listen for tab updates to refresh page info
    const tabUpdateListener = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
        loadCurrentPageInfo();
      }
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);

    // Cleanup on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      port.disconnect();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);


  const handleSendMessage = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);

    try {
      console.log('🤖 Using AI SDK for chat...');
      
      // Use traditional API (which now uses AI SDK internally)
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ASK_INTELLA,
        payload: { question: currentQuery },
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
      console.error('💥 Chat error:', error);
      
      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.ASK_INTELLA,
          payload: { question: currentQuery },
        });

        if (response.success) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: `${response.data}`,
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error(response.error);
        }
      } catch (fallbackError) {
        console.error('💥 Fallback also failed:', fallbackError);
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
        const { query, timestamp, source } = result['floating-query'];
        console.log('✅ SidePanel: Found floating query:', query, 'from:', source, 'timestamp:', timestamp);

        // Check if query is recent (within last 10 seconds)
        const age = Date.now() - timestamp;
        console.log('⏰ SidePanel: Query age:', age, 'ms');

        if (age < 10000) {
          console.log('🔍 SidePanel: Processing floating query...');

          // Switch to chat tab first
          console.log('📑 SidePanel: Switching to chat tab');
          setActiveTab('chat');

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
            const response = await chrome.runtime.sendMessage({
              type: MessageType.ASK_INTELLA,
              payload: { question: query },
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
        
        setCurrentPageInfo({
          title: tab.title,
          favicon: faviconUrl,
          hasInfo: true
        });
      } else {
        console.log('⚠️ Could not get tab information, using fallback');
        setCurrentPageInfo({
          title: 'Current Page Context',
          hasInfo: false
        });
      }
    } catch (error) {
      console.error('❌ Error loading current page info:', error);
      setCurrentPageInfo({
        title: 'Current Page Context',
        hasInfo: false
      });
    }
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

  // Voice chat handlers
  const handleStartVoiceChat = async () => {
    if (!settings?.apiKey) {
      alert('Please configure your API key in settings first.');
      return;
    }

    setIsConnecting(true);
    
    // First, test if we can access microphone at all
    try {
      console.log('🔍 Testing microphone access...');
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach(track => track.stop());
      console.log('✅ Microphone access confirmed');
    } catch (permError) {
      console.error('❌ Microphone permission denied:', permError);
      setIsConnecting(false);
      alert('Microphone access is required for voice chat. Please:\n\n1. Click the microphone icon in your browser address bar\n2. Select "Allow"\n3. Try again\n\nOr go to Chrome Settings > Privacy and security > Site Settings > Microphone and allow access for this extension.');
      return;
    }
    
    try {
      console.log('🎙️ Starting voice chat...');
      
      // Get user ID from settings if available
      const userId = settings?.workspace_id || 'anonymous';
      
      // Create LiveKit token with API key and user ID
      const { token, wsUrl } = await createLiveKitToken(settings.apiKey, userId);
      
      // Initialize voice chat
      const livekitClient = new LiveKitVoiceChat();
      
      // Set up message handler to display responses in chat
      livekitClient.onMessage((message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'response' && data.content) {
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
            };
            setChatMessages(prev => [...prev, assistantMessage]);
          }
        } catch (e) {
          // If not JSON, treat as plain text response
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: message,
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, assistantMessage]);
        }
      });
      
      // Connect to LiveKit
      await livekitClient.connect({
        wsUrl,
        token,
        apiKey: settings.apiKey,
        userId: userId
      });
      
      // Enable microphone
      await livekitClient.enableMicrophone();
      
      setVoiceChat(livekitClient);
      setIsVoiceChatActive(true);
      setIsMicEnabled(true);
      
      // Add system message to chat
      const systemMessage: ChatMessage = {
        role: 'assistant',
        content: '🎙️ Voice chat started! You can now speak to me directly.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, systemMessage]);
      
      console.log('✅ Voice chat started successfully');
    } catch (error) {
      console.error('❌ Failed to start voice chat:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('Microphone permission')) {
          errorMessage = 'Please allow microphone access in your browser settings and try again.';
        } else if (error.message.includes('Failed to create token')) {
          errorMessage = 'Unable to connect to voice chat service. Please check your internet connection.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(`Failed to start voice chat: ${errorMessage}`);
      
      // Add error message to chat
      const errorChatMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Voice chat failed to start: ${errorMessage}`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndVoiceChat = async () => {
    if (voiceChat) {
      try {
        console.log('🎙️ Ending voice chat...');
        await voiceChat.disconnect();
        setVoiceChat(null);
        setIsVoiceChatActive(false);
        setIsMicEnabled(false);
        
        // Add system message to chat
        const systemMessage: ChatMessage = {
          role: 'assistant',
          content: '🎙️ Voice chat ended. You can continue chatting with text.',
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, systemMessage]);
        
        console.log('✅ Voice chat ended successfully');
      } catch (error) {
        console.error('❌ Error ending voice chat:', error);
      }
    }
  };

  const handleToggleMicrophone = async () => {
    if (!voiceChat) return;
    
    try {
      if (isMicEnabled) {
        await voiceChat.disableMicrophone();
        setIsMicEnabled(false);
      } else {
        await voiceChat.enableMicrophone();
        setIsMicEnabled(true);
      }
    } catch (error) {
      console.error('❌ Error toggling microphone:', error);
      alert('Failed to toggle microphone. Please try again.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-darkBg-primary">
      {/* Minimal Header with only menu button */}
      <div className="flex justify-end p-3 dark:border-darkBg-secondary bg-white dark:bg-darkBg-primary">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setShowChatMenu(!showChatMenu)}
              className="p-2 text-gray-600 dark:text-darkText-secondary hover:text-gray-900 dark:hover:text-darkText-primary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary rounded-lg transition"
              title="Chat options"
            >
              <Menu size={20} />
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
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col justify-end pb-6">
                  {/* Empty space at top */}
                  <div className="flex-1"></div>

                  {/* Agent mode feature */}


                  {/* Suggested prompts */}
                  <div className="px-4 space-y-3">
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary mb-2">
                        Agent mode{' '}
                        <span className="inline-flex items-center bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded">
                          NEW
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-darkText-tertiary">
                        Ask Intella to perform complex tasks in the browser
                      </div>
                    </div>
                    <button
                      onClick={() => setQuery('Suggest endpoints')}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition text-left group"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-darkBg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">💭</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary mb-0.5">Suggest endpoints</div>
                        <div className="text-xs text-gray-500 dark:text-darkText-tertiary">Which endpoints are best to start with?</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setQuery('Summarize usage')}
                      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition text-left group"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-darkBg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">💭</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary mb-0.5">Summarize usage</div>
                        <div className="text-xs text-gray-500 dark:text-darkText-tertiary">Summarize the main ways this API is used.</div>
                      </div>
                    </button>
                  </div>


                </div>
              ) : (
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
                        <div className="text-sm leading-relaxed">{msg.content}</div>
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
              )}
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

            {/* Input */}
            <div className="border-t border-gray-200 dark:border-darkBg-secondary bg-white dark:bg-darkBg-primary p-2">
              {/* Context indicator */}
              <div className="px-2 flex">
                <button id="current-page-context" className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-darkBg-secondary hover:bg-gray-200 dark:hover:bg-darkBg-tertiary rounded-lg transition" style={{ width: '50%' }}>
                  {currentPageInfo.hasInfo && currentPageInfo.favicon && !faviconError ? (
                    <img 
                      src={currentPageInfo.favicon} 
                      alt="Page favicon" 
                      className="w-4 h-4"
                      onError={() => {
                        // If favicon fails to load, set error flag to show Zap icon
                        setFaviconError(true);
                      }}
                    />
                  ) : (
                    <Zap size={16} className="text-gray-600 dark:text-darkText-secondary" />
                  )}
                  <span className="text-sm text-gray-700 dark:text-darkText-secondary truncate">{currentPageInfo.title}</span>
                </button>
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
              
              <div className="flex gap-2">
                {/* Upload Button */}
                <div className="relative">
                  <button
                    onClick={toggleUploadPopover}
                    className="px-3 py-3 text-gray-600 dark:text-darkText-secondary hover:text-gray-900 dark:hover:text-darkText-primary transition"
                    disabled={isLoading || uploadProgress.isUploading}
                    title="Quick actions"
                  >
                    {uploadProgress.isUploading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Plus size={18} />
                    )}
                  </button>

                  <QuickActionsPopover
                    isOpen={showUploadPopover}
                    onClose={() => setShowUploadPopover(false)}
                    onFileUpload={() => fileInputRef.current?.click()}
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

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask anything"
                    className="w-full px-2 py-3 focus:outline-none bg-transparent text-gray-900 dark:text-darkText-primary placeholder:text-gray-500 dark:placeholder:text-darkText-tertiary"
                    disabled={isLoading}
                  />
                </div>
                
                {/* Voice Chat Button */}
                {!isVoiceChatActive ? (
                  <button
                    onClick={handleStartVoiceChat}
                    disabled={isConnecting || !settings?.apiKey}
                    className="px-3 py-3 text-gray-600 dark:text-darkText-secondary hover:text-blue-600 dark:hover:text-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!settings?.apiKey ? 'API key required for voice chat' : 'Start voice chat'}
                  >
                    {isConnecting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Phone size={18} />
                    )}
                  </button>
                ) : null}
                
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !query.trim()}
                  className="px-3 py-3 text-gray-600 dark:text-darkText-secondary hover:text-gray-900 dark:hover:text-darkText-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <Send size={18} />
                </button>
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

