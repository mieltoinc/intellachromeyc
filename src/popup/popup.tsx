/**
 * Popup UI Component
 * Quick access menu for Intella
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Sparkles, BookOpen, Settings, Eye, EyeOff } from 'lucide-react';
import { MessageType } from '@/types/messages';
import { Memory, UserSettings } from '@/types/memory';
import { LoginScreen } from '@/components/LoginScreen';
import { mieltoAuth } from '@/lib/auth';
import { ThemeProvider } from '@/components/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import './popup.css';

const PopupInner: React.FC = () => {
  // Start with null (loading) - will be set quickly by fast auth check
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [memoriesCount, setMemoriesCount] = useState(0);
  const [isAnalysisActive, setIsAnalysisActive] = useState(true);

  useEffect(() => {
    // Do fast auth check immediately
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    // This is fast - just checks storage, no API calls
    const authenticated = await mieltoAuth.isAuthenticated();
    setIsAuthenticated(authenticated);
    
    if (authenticated) {
      loadPopupData();
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    loadPopupData();
  };

  // const checkDefaultAction = async () => {
  //   // Check if user prefers side panel as default
  //   const settingsResponse = await chrome.runtime.sendMessage({
  //     type: MessageType.GET_SETTINGS,
  //   });

  //   if (settingsResponse.success && settingsResponse.data.defaultAction === 'sidepanel') {
  //     // User wants side panel, redirect immediately
  //     if (chrome.sidePanel) {
  //       try {
  //         const currentWindow = await chrome.windows.getCurrent();
  //         if (currentWindow.id) {
  //           await chrome.sidePanel.open({ windowId: currentWindow.id });
  //           window.close(); // Close popup after opening side panel
  //         }
  //       } catch (error) {
  //         console.error('Failed to open side panel:', error);
  //         // Stay in popup if side panel fails
  //       }
  //     }
  //   }
  // };

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

  const openSidebar = async () => {
    // Try to use Side Panel API first (Chrome 114+)
    if (chrome.sidePanel) {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow.id) {
          await chrome.sidePanel.open({ windowId: currentWindow.id });
          window.close();
          return;
        }
      } catch (error) {
        console.log('Side panel not available, falling back to injected sidebar');
      }
    }
    
    // Fallback to injected sidebar
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { type: MessageType.TOGGLE_SIDEBAR });
      window.close();
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
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

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="bg-white dark:bg-darkBg-primary min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-blue-600 dark:text-blue-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="bg-white dark:bg-darkBg-primary min-h-[400px] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={24} />
            <h1 className="text-xl font-bold">Intella</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={openOptions}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <Settings size={20} />
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
              className={`p-2 rounded-lg transition ${
                isAnalysisActive ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}
            >
              {isAnalysisActive ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-4 border-b border-gray-200 dark:border-darkBg-secondary">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-3 rounded-lg">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{memoriesCount}</div>
          <div className="text-xs text-gray-600 dark:text-darkText-tertiary">Memories</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-3 rounded-lg">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {settings?.enableInlineAssistant ? 'ON' : 'OFF'}
          </div>
          <div className="text-xs text-gray-600 dark:text-darkText-tertiary">Writing Helper</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-gray-200 dark:border-darkBg-secondary">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-darkText-secondary mb-2">Quick Actions</h2>
        <div className="space-y-2">
          <button
            onClick={openSidebar}
            className="w-full flex items-center gap-3 p-3 bg-gradient-to-b from-blue-500 to-blue-700 text-white rounded-xl hover:from-blue-600 hover:to-blue-800 border border-blue-600 shadow-[inset_0_2px_0_0_rgba(255,255,255,0.1)] shadow-lg transition-all"
          >
            <Sparkles size={18} />
            <span className="font-medium">Open Sidebar</span>
          </button>
        </div>
      </div>
      
      {/* Quick Tip */}
      <div className="px-4 pb-4">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
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
  );
};

// Wrapper component that provides theme context
const Popup: React.FC = () => {
  return (
    <ThemeProvider>
      <PopupInner />
    </ThemeProvider>
  );
};

// Mount popup
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<Popup />);
}

