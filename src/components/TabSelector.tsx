/**
 * Tab Selector Component - Dropdown for selecting open tabs
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Globe } from 'lucide-react';
import { MessageType, TabInfo } from '@/types/messages';

interface TabSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: TabInfo) => void;
  currentTabId?: number;
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export const TabSelector: React.FC<TabSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  currentTabId,
  buttonRef,
}) => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [filteredTabs, setFilteredTabs] = useState<TabInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ bottom: 0, left: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Calculate position based on button position
  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Position modal above the button, anchored to the left
      setPosition({
        bottom: viewportHeight - buttonRect.top + 8, // 8px gap above button
        left: buttonRect.left,
      });
    }
  }, [isOpen, buttonRef]);

  // Load open tabs when component opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 TabSelector: Opening, loading tabs...');
      setTabs([]); // Clear existing tabs first
      setFilteredTabs([]); // Clear filtered tabs
      setSearchQuery(''); // Clear search query
      loadOpenTabs();
      // Focus search input
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Filter tabs based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTabs(tabs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tabs.filter(tab => 
        tab.title.toLowerCase().includes(query) || 
        tab.url.toLowerCase().includes(query)
      );
      setFilteredTabs(filtered);
    }
  }, [searchQuery, tabs]);

  // Handle escape key and clicks outside
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && modalRef.current && !modalRef.current.contains(e.target as Node) &&
          buttonRef?.current && !buttonRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  const loadOpenTabs = async () => {
    setIsLoading(true);
    try {
      console.log('📑 TabSelector: Requesting open tabs...');
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_OPEN_TABS,
      });

      console.log('📑 TabSelector: Got response:', response);

      if (response.success) {
        console.log('📑 TabSelector: Raw tabs:', response.data?.length || 0);
        
        // Filter out current tab and extension pages
        const openTabs = response.data.filter((tab: TabInfo) => {
          const isCurrentTab = tab.id === currentTabId;
          const isExtensionPage = tab.url.startsWith('chrome-extension://') ||
            tab.url.startsWith('chrome://') ||
            tab.url.startsWith('moz-extension://') ||
            tab.url.startsWith('about:');
          
          // Only exclude current tab if currentTabId is provided
          const shouldExclude = isExtensionPage || (currentTabId && isCurrentTab);
          
          console.log('📑 Tab filter:', { 
            id: tab.id, 
            title: tab.title, 
            isCurrentTab, 
            isExtensionPage, 
            shouldExclude 
          });
          
          return !shouldExclude;
        });
        
        console.log('📑 TabSelector: Filtered to', openTabs.length, 'tabs');
        setTabs(openTabs);
      } else {
        console.error('Failed to load open tabs:', response.error);
      }
    } catch (error) {
      console.error('Error loading open tabs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTab = (tab: TabInfo) => {
    onSelectTab(tab);
    onClose();
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div
      ref={modalRef}
      className="fixed w-80 max-h-[500px] bg-white dark:bg-darkBg-primary border border-gray-200 dark:border-darkBg-secondary rounded-lg shadow-xl z-[9999]"
      style={{
        bottom: `${position.bottom}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="p-3 border-b border-gray-200 dark:border-darkBg-secondary">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-darkText-tertiary" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tabs..."
            className="w-full pl-9 pr-9 py-2 border border-gray-200 dark:border-darkBg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-darkBg-primary text-gray-900 dark:text-darkText-primary placeholder:text-gray-500 dark:placeholder:text-darkText-tertiary"
          />
          <button
            onClick={onClose}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 dark:text-darkText-tertiary hover:text-gray-600 dark:hover:text-darkText-secondary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-darkText-tertiary">Loading tabs...</p>
          </div>
        ) : filteredTabs.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-darkText-tertiary">
            {tabs.length === 0 ? (
              <p className="text-sm">No other tabs found</p>
            ) : (
              <p className="text-sm">No tabs match your search</p>
            )}
          </div>
        ) : (
          <div className="p-1">
            {filteredTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-darkBg-tertiary transition text-left"
              >
                <div className="w-4 h-4 flex-shrink-0">
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      className="w-4 h-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const icon = document.createElement('div');
                          icon.innerHTML = '<div class="w-4 h-4 flex items-center justify-center"><svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg></div>';
                          parent.appendChild(icon.firstChild as Node);
                        }
                      }}
                    />
                  ) : (
                    <Globe size={14} className="text-gray-400 dark:text-darkText-tertiary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary truncate">
                    {tab.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-darkText-tertiary truncate">
                    {formatUrl(tab.url)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render modal in a portal to escape overflow constraints
  return createPortal(modal, document.body);
};