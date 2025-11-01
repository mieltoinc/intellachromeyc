/**
 * Options/Settings Page
 * Manage memories, settings, and site visibility
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Sparkles,
  Settings,
  BookOpen,
  Shield,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Save,
  ExternalLink,
  MessageCircle,
  Send,
  RotateCcw,
  LogOut,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { MessageType } from '@/types/messages';
import { Memory, UserSettings, SiteVisibility } from '@/types/memory';
import { LoginScreen } from '@/components/LoginScreen';
import { ComposioManager } from '@/components/ComposioManager';
import { getFirstActiveApiKey } from '@/handlers/apikey.handler';
import { mieltoAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/components/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import './options.css';
import '@/styles/app.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  usedMemories?: Memory[];
}

const OptionsInner: React.FC = () => {
  const { theme, setTheme } = useTheme();
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  const [activeTab, setActiveTab] = useState<'memories' | 'chat' | 'settings' | 'tools' | 'privacy'>('memories');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [siteVisibility, _setSiteVisibility] = useState<SiteVisibility[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatQuery, setChatQuery] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Privacy state - Feature 4: Blocked Sites
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [isAddingDomain, setIsAddingDomain] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const authenticated = await mieltoAuth.isAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (authenticated) {
      loadData();
    }
  };

  const handleLogin = async () => {
    setIsAuthenticated(true);
    await loadData();
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
          await loadData();
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

  const loadData = async () => {
    // First sync memories from backend, then load all memories
    console.log('🔄 Loading and syncing memories...');
    
    try {
      const syncResponse = await chrome.runtime.sendMessage({
        type: MessageType.SYNC_MEMORIES,
      });
      
      if (syncResponse.success) {
        console.log('✅ Memory sync completed:', syncResponse.data);
        setMemories(syncResponse.data.memories);
      } else {
        console.warn('⚠️ Memory sync failed, loading local memories only:', syncResponse.error);
        // Fallback to local memories only
        const memoriesResponse = await chrome.runtime.sendMessage({
          type: MessageType.GET_MEMORIES,
        });
        if (memoriesResponse.success) {
          setMemories(memoriesResponse.data);
        }
      }
    } catch (error) {
      console.error('❌ Error during memory sync:', error);
      // Fallback to local memories only
      const memoriesResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_MEMORIES,
      });
      if (memoriesResponse.success) {
        setMemories(memoriesResponse.data);
      }
    }

    // Load settings
    const settingsResponse = await chrome.runtime.sendMessage({
      type: MessageType.GET_SETTINGS,
    });
    if (settingsResponse.success) {
      setSettings(settingsResponse.data);
      // Load blocked domains from settings
      setBlockedDomains(settingsResponse.data.privacy?.blockedDomains || []);
    }

    // Load site visibility (would need to implement this in background)
    // For now, we'll leave it empty
  };

  const handleSearchMemories = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      loadData();
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: MessageType.SEARCH_MEMORIES,
      payload: query,
    });

    if (response && response.success) {
      const memories = response.data;
      if (Array.isArray(memories)) {
        console.log(`📋 Options page: Received ${memories.length} memories from search`);
        setMemories(memories);
      } else {
        console.warn('⚠️ Options page: Invalid memories data format (not an array):', memories);
        setMemories([]);
      }
    } else {
      console.warn('⚠️ Options page: Search failed or invalid response:', response);
      // Keep existing memories or set empty array
      setMemories([]);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    const response = await chrome.runtime.sendMessage({
      type: MessageType.DELETE_MEMORY,
      payload: id,
    });

    if (response.success) {
      setMemories(memories.filter(m => m.id !== id));
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    const response = await chrome.runtime.sendMessage({
      type: MessageType.UPDATE_SETTINGS,
      payload: settings,
    });

    if (response.success) {
      setTimeout(() => setIsSaving(false), 1000);
    } else {
      setIsSaving(false);
      alert('Failed to save settings');
    }
  };

  const handleClearAllMemories = async () => {
    if (!confirm('Are you sure you want to clear ALL memories? This cannot be undone.')) return;

    // Delete all memories
    for (const memory of memories) {
      await chrome.runtime.sendMessage({
        type: MessageType.DELETE_MEMORY,
        payload: memory.id,
      });
    }

    setMemories([]);
  };

  const handleSendChatMessage = async () => {
    if (!chatQuery.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatQuery,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    const currentQuery = chatQuery;
    setChatQuery('');
    setIsChatLoading(true);

    try {
      // Ask Intella (memories will be automatically included by the API)
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
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleNewConversation = async () => {
    await chrome.runtime.sendMessage({
      type: MessageType.RESET_CONVERSATION,
    });
    setChatMessages([]);
    console.log('🗨️ Started new conversation');
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to log out? This will clear all your data.')) return;

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
        setSettings(null);
        setBlockedDomains([]);
        setSearchQuery('');
        setChatQuery('');
        
        console.log('✅ Successfully logged out');
      } else {
        console.error('❌ Logout failed:', response.error);
        alert('Failed to logout. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      alert('An error occurred during logout. Please try again.');
    }
  };

  // Feature 4: Blocked Domains Management
  const handleAddBlockedDomain = async () => {
    if (!newBlockedDomain.trim() || isAddingDomain) return;

    setIsAddingDomain(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ADD_BLOCKED_DOMAIN,
        payload: { domain: newBlockedDomain.trim() },
      });

      if (response.success) {
        setBlockedDomains(response.data.blockedDomains);
        setNewBlockedDomain('');
        console.log('✅ Domain added to blocked list');
      } else {
        alert('Failed to add domain: ' + response.error);
      }
    } catch (error: any) {
      alert('Failed to add domain: ' + error.message);
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleRemoveBlockedDomain = async (domain: string) => {
    if (!confirm(`Remove "${domain}" from blocked list?`)) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.REMOVE_BLOCKED_DOMAIN,
        payload: { domain },
      });

      if (response.success) {
        setBlockedDomains(response.data.blockedDomains);
        console.log('✅ Domain removed from blocked list');
      } else {
        alert('Failed to remove domain: ' + response.error);
      }
    } catch (error: any) {
      alert('Failed to remove domain: ' + error.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-blue-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-darkBg-primary">
        <div className="bg-white dark:bg-darkBg-secondary border-b border-gray-200 dark:border-darkBg-secondary">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <Sparkles size={28} color="white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-darkText-primary">Intella</h1>
                <p className="text-sm text-gray-500 dark:text-darkText-tertiary">Please sign in to manage your memories and settings</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <LoginScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  // Show loading if settings not loaded yet
  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-blue-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-darkBg-primary">
      {/* Header */}
      <div className="bg-white dark:bg-darkBg-secondary border-b border-gray-200 dark:border-darkBg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <Sparkles size={28} color="white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-darkText-primary">Intella</h1>
                <p className="text-sm text-gray-500 dark:text-darkText-tertiary">Manage your memories and settings</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'memories'
                  ? 'bg-blue-100 dark:bg-darkBg-tertiary text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-darkText-tertiary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary'
              }`}
            >
              <BookOpen size={18} />
              Memories
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'chat'
                  ? 'bg-blue-100 dark:bg-darkBg-tertiary text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-darkText-tertiary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary'
              }`}
            >
              <MessageCircle size={18} />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'settings'
                  ? 'bg-blue-100 dark:bg-darkBg-tertiary text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-darkText-tertiary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary'
              }`}
            >
              <Settings size={18} />
              Settings
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'tools'
                  ? 'bg-blue-100 dark:bg-darkBg-tertiary text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-darkText-tertiary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary'
              }`}
            >
              <Sparkles size={18} />
              Tools
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'privacy'
                  ? 'bg-blue-100 dark:bg-darkBg-tertiary text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-darkText-tertiary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary'
              }`}
            >
              <Shield size={18} />
              Privacy
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'memories' && (
          <div>
            {/* Search and Actions */}
            <div className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-darkText-tertiary" size={20} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchMemories(e.target.value)}
                    placeholder="Search memories..."
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                  />
                </div>
                <button
                  onClick={handleClearAllMemories}
                  className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-darkBg-tertiary text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-darkBg-secondary transition"
                >
                  <Trash2 size={18} />
                  Clear All
                </button>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-darkText-tertiary">
                <span className="font-medium">{memories.length} memories</span>
              </div>
            </div>

            {/* Memories Grid */}
            {memories.length === 0 ? (
              <div className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm p-12 text-center">
                <BookOpen size={48} className="mx-auto text-gray-300 dark:text-darkText-tertiary mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">No memories yet</h3>
                <p className="text-gray-500 dark:text-darkText-tertiary">
                  Browse the web and Intella will automatically capture interesting pages.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm p-6 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 pr-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2 leading-tight">
                          {memory.title.length > 80 ? memory.title.substring(0, 80) + '...' : memory.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-darkText-tertiary leading-relaxed">{memory.summary}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="p-2 text-gray-400 dark:text-darkText-tertiary hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-darkBg-tertiary rounded-lg transition flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {memory.keywords.slice(0, 5).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-lg"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-darkText-tertiary">
                      <span>{formatDate(memory.timestamp)}</span>
                      <a
                        href={memory.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Visit <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="max-w-4xl">
            <div className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-darkBg-secondary bg-gradient-to-r from-blue-50 to-blue-100 dark:from-darkBg-tertiary dark:to-darkBg-tertiary">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-darkText-primary mb-2">Chat with Your Memories</h2>
                    <p className="text-gray-600 dark:text-darkText-tertiary">
                      Ask questions about your captured memories. I'll search through your browsing history to provide relevant context.
                    </p>
                  </div>
                  <button
                    onClick={handleNewConversation}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-darkBg-primary text-gray-700 dark:text-darkText-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition border border-gray-200 dark:border-darkBg-secondary"
                    title="Start new conversation"
                  >
                    <RotateCcw size={16} />
                    New Chat
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="h-96 overflow-y-auto p-6">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageCircle size={48} className="text-gray-300 dark:text-darkText-tertiary mb-4" />
                    <p className="text-lg font-semibold text-gray-900 dark:text-darkText-primary mb-2">Start a conversation!</p>
                    <p className="text-sm text-gray-500 dark:text-darkText-tertiary max-w-md">
                      Ask me anything about the pages you've visited. I'll use your captured memories to provide helpful context.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                          <div
                            className={`px-4 py-3 rounded-2xl ${
                              msg.role === 'user'
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-darkBg-tertiary text-gray-900 dark:text-darkText-primary'
                            }`}
                          >
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                            {msg.usedMemories && msg.usedMemories.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-darkBg-secondary">
                                <div className="text-xs text-gray-500 dark:text-darkText-tertiary mb-2">
                                  📚 Based on {msg.usedMemories.length} memory{msg.usedMemories.length > 1 ? 'ies' : ''}:
                                </div>
                                <div className="space-y-1">
                                  {msg.usedMemories.map((memory, i) => (
                                    <div 
                                      key={i} 
                                      className="text-xs bg-white dark:bg-darkBg-secondary rounded px-2 py-1 text-gray-700 dark:text-darkText-secondary cursor-pointer hover:bg-gray-50 dark:hover:bg-darkBg-tertiary"
                                      onClick={() => window.open(memory.url, '_blank')}
                                    >
                                      {memory.title.length > 60 ? memory.title.substring(0, 60) + '...' : memory.title}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className={`text-xs mt-2 ${msg.role === 'user' ? 'opacity-75' : 'text-gray-500 dark:text-darkText-tertiary'}`}>
                              {msg.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="max-w-[80%] mr-auto">
                          <div className="px-4 py-3 rounded-2xl bg-gray-100 dark:bg-darkBg-tertiary">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-gray-400 dark:bg-darkText-tertiary rounded-full animate-bounce"></span>
                              <span className="w-2 h-2 bg-gray-400 dark:bg-darkText-tertiary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                              <span className="w-2 h-2 bg-gray-400 dark:bg-darkText-tertiary rounded-full animate-bounce [animation-delay:0.4s]"></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-gray-200 dark:border-darkBg-secondary bg-gray-50 dark:bg-darkBg-primary p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                    placeholder="Ask about your memories..."
                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-darkBg-secondary rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    disabled={isChatLoading}
                  />
                  <button
                    onClick={handleSendChatMessage}
                    disabled={isChatLoading || !chatQuery.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send size={18} />
                    Send
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-darkText-tertiary">
                  💡 Try asking: "What articles did I read about AI?" or "Summarize my recent research"
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-darkText-primary mb-6">Settings</h2>

            <div className="space-y-6">
              {/* API Configuration */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-darkText-secondary mb-3">Mielto API Configuration</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-darkText-secondary mb-2">
                      API URL
                    </label>
                    <input
                      type="text"
                      value={settings.apiUrl}
                      onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                      placeholder="https://api.mielto.com"
                      className="w-full px-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-darkText-secondary mb-2">
                      API Key (Optional)
                    </label>
                    <input
                      type="password"
                      value={settings.apiKey || ''}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      placeholder="Your API key"
                      className="w-full px-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-darkText-secondary mb-2">
                      Workspace ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={settings.workspace_id || ''}
                      onChange={(e) => setSettings({ ...settings, workspace_id: e.target.value })}
                      placeholder="Your workspace ID"
                      className="w-full px-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-darkText-secondary mb-2">
                      Memory Ingestion Method
                    </label>
                    <select
                      value={settings.ingestionMethod || 'both'}
                      onChange={(e) => setSettings({ ...settings, ingestionMethod: e.target.value as 'completions' | 'upload' | 'both' })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    >
                      <option value="both">Both (Completions + Memories API Fallback)</option>
                      <option value="completions">Completions Only (Better AI Understanding)</option>
                      <option value="upload">Memories API Only (Direct Storage)</option>
                    </select>
                    <div className="text-xs text-gray-500 dark:text-darkText-tertiary mt-2">
                      <strong>Completions:</strong> Processes memories through AI for better understanding and searchability.<br/>
                      <strong>Memories API:</strong> Directly stores structured memories using the /memories endpoint.<br/>
                      <strong>Both:</strong> Tries completions first, falls back to memories API if needed.
                    </div>
                  </div>
                </div>
              </div>

              {/* Default Action */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-darkText-secondary mb-3">Interface</h3>
                
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg">
                    <label className="block font-medium text-gray-900 dark:text-darkText-primary mb-2">
                      Appearance
                    </label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as 'system' | 'dark' | 'light')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    >
                      <option value="system">System</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                    <div className="text-xs text-gray-500 dark:text-darkText-tertiary mt-2">
                      Choose your preferred theme. "System" will match your OS settings.
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg">
                    <label className="block font-medium text-gray-900 dark:text-darkText-primary mb-2">
                      Default Action (Icon Click)
                    </label>
                    <select
                      value={settings.defaultAction}
                      onChange={(e) => setSettings({ ...settings, defaultAction: e.target.value as 'popup' | 'sidepanel' })}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary"
                    >
                      <option value="popup">Popup (Quick Stats)</option>
                      <option value="sidepanel">Side Panel (Full Chat)</option>
                    </select>
                    <div className="text-xs text-gray-500 dark:text-darkText-tertiary mt-2">
                      Choose what opens when you click the Intella icon
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-darkText-secondary mb-3">Features</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-darkText-primary">Memory Analysis</div>
                      <div className="text-sm text-gray-500 dark:text-darkText-tertiary">Enable/pause automatic memory analysis and capture</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.isAnalysisActive ?? true}
                      onChange={(e) => setSettings({ ...settings, isAnalysisActive: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-darkText-primary">Auto Capture</div>
                      <div className="text-sm text-gray-500 dark:text-darkText-tertiary">Automatically capture page memories when analysis is active</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableAutoCapture}
                      onChange={(e) => setSettings({ ...settings, enableAutoCapture: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-darkText-primary">Sidebar</div>
                      <div className="text-sm text-gray-500 dark:text-darkText-tertiary">Enable Ask Intella sidebar</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableSidebar}
                      onChange={(e) => setSettings({ ...settings, enableSidebar: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-darkText-primary">Inline Assistant</div>
                      <div className="text-sm text-gray-500 dark:text-darkText-tertiary">Enable inline writing help</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableInlineAssistant}
                      onChange={(e) => setSettings({ ...settings, enableInlineAssistant: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-darkBg-secondary/50 rounded-lg cursor-pointer">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-darkText-primary">Floating Search Bar</div>
                      <div className="text-sm text-gray-500 dark:text-darkText-tertiary">Show floating search bar with Ctrl+J/Cmd+J shortcut</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.ui?.floatingSearchEnabled ?? false}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        ui: { 
                          ...settings.ui, 
                          floatingSearchEnabled: e.target.checked 
                        } 
                      })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-orange-50 dark:bg-darkBg-secondary/50 rounded-lg cursor-pointer border border-orange-200 dark:border-orange-800">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-darkText-primary flex items-center gap-2">
                        🎃 Halloween Theme
                        <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 px-2 py-1 rounded-full">
                          Seasonal
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-darkText-tertiary">
                        Add spooky spider webs and friendly floating ghosts to websites
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.ui?.halloweenThemeEnabled ?? false}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        ui: { 
                          ...settings.ui, 
                          halloweenThemeEnabled: e.target.checked 
                        } 
                      })}
                      className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                    />
                  </label>
                </div>
              </div>


              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50"
              >
                <Save size={18} />
                {isSaving ? 'Saved!' : 'Save Settings'}
              </button>

              {/* Logout Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 dark:bg-darkBg-tertiary text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-darkBg-secondary transition border border-red-200 dark:border-darkBg-secondary"
                >
                  <LogOut size={18} />
                  Log Out
                </button>
                <p className="text-xs text-gray-500 dark:text-darkText-tertiary mt-2 text-center">
                  This will clear your session and require you to log in again
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-darkText-primary mb-2">Tools Integration</h2>
            <p className="text-gray-600 dark:text-darkText-tertiary mb-6">
              Connect external tools like Shopify and Perplexity AI to enhance your AI assistant capabilities.
            </p>

            <ComposioManager />
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="bg-white dark:bg-darkBg-secondary rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-darkText-primary mb-2">Privacy & Control</h2>
            <p className="text-gray-600 dark:text-darkText-tertiary mb-6">
              Manage which sites Intella can access and remember.
            </p>

            <div className="space-y-4">
              <div className="p-6 bg-blue-50 dark:bg-darkBg-tertiary border border-blue-200 dark:border-darkBg-secondary rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield size={24} className="text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-darkText-primary mb-1">Your data is private</h3>
                    <p className="text-sm text-blue-700 dark:text-darkText-tertiary">
                      All memories are stored locally and optionally synced to your Mielto workspace.
                      You have full control over what's captured and stored.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-darkBg-tertiary rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-darkText-primary mb-4">Per-Site Visibility</h3>
                <p className="text-sm text-gray-600 dark:text-darkText-tertiary mb-4">
                  Click the Intella icon in your toolbar to toggle visibility for the current site.
                  When hidden, Intella won't capture or process any content from that domain.
                </p>

                <div className="space-y-2">
                  {siteVisibility.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-darkText-tertiary italic">
                      No site-specific settings configured yet.
                    </p>
                  ) : (
                    siteVisibility.map((site) => (
                      <div key={site.domain} className="flex items-center justify-between p-3 bg-white dark:bg-darkBg-secondary rounded border border-gray-200 dark:border-darkBg-secondary">
                        <span className="text-sm font-medium dark:text-darkText-primary">{site.domain}</span>
                        {site.isVisible ? (
                          <span className="flex items-center gap-2 text-sm text-green-600">
                            <Eye size={16} /> Visible
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-sm text-red-600">
                            <EyeOff size={16} /> Hidden
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 bg-red-50 dark:bg-darkBg-tertiary border border-red-200 dark:border-darkBg-secondary rounded-lg">
                <h3 className="font-semibold text-red-900 dark:text-darkText-primary mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  Blocked Sites
                </h3>
                <p className="text-sm text-red-700 dark:text-darkText-tertiary mb-4">
                  Prevent Intella from capturing content on specific domains. Supports exact domains (e.g., "example.com") 
                  and wildcard patterns (e.g., "*.example.com" to block all subdomains).
                </p>

                {/* Add Domain Form */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBlockedDomain}
                      onChange={(e) => setNewBlockedDomain(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddBlockedDomain()}
                      placeholder="Enter domain (e.g., example.com or *.example.com)"
                      className="flex-1 px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      disabled={isAddingDomain}
                    />
                    <button
                      onClick={handleAddBlockedDomain}
                      disabled={isAddingDomain || !newBlockedDomain.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                      {isAddingDomain ? 'Adding...' : 'Block'}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-red-600">
                    💡 Use *.domain.com to block all subdomains, or domain.com for exact match
                  </div>
                </div>

                {/* Blocked Domains List */}
                <div className="space-y-2">
                  {blockedDomains.length === 0 ? (
                    <p className="text-sm text-red-600 dark:text-red-400 italic py-4 text-center bg-red-100 dark:bg-darkBg-tertiary rounded-lg">
                      No blocked domains configured. Content will be captured from all sites (when enabled).
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {blockedDomains.map((domain, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-darkBg-secondary rounded-lg border border-red-200 dark:border-darkBg-secondary">
                          <div className="flex items-center gap-2">
                            <Shield size={16} className="text-red-600" />
                            <span className="text-sm font-medium text-gray-900 dark:text-darkText-primary">{domain}</span>
                            {domain.startsWith('*.') && (
                              <span className="px-2 py-1 text-xs bg-orange-100 dark:bg-darkBg-tertiary text-orange-700 dark:text-orange-400 rounded">
                                Wildcard
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveBlockedDomain(domain)}
                            className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-darkBg-tertiary rounded-lg transition"
                            title="Remove from blocked list"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-yellow-50 dark:bg-darkBg-tertiary border border-yellow-200 dark:border-darkBg-secondary rounded-lg">
                <h3 className="font-semibold text-yellow-900 dark:text-darkText-primary mb-2">Incognito/Private Mode</h3>
                <p className="text-sm text-yellow-700 dark:text-darkText-tertiary">
                  Intella automatically disables memory capture in private/incognito windows
                  to respect your privacy.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapper component that provides theme context
const Options: React.FC = () => {
  return (
    <ThemeProvider>
      <OptionsInner />
    </ThemeProvider>
  );
};

// Mount options page
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<Options />);
}

