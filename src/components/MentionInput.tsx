/**
 * Mention Input Component - Handles @ mentions for tab selection
 */

import React, { useState, useRef, useEffect } from 'react';
import { TabInfo, MessageType } from '@/types/messages';

interface MentionMatch {
  start: number;
  end: number;
  query: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onTabMention: (tab: TabInfo) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onKeyPress,
  onTabMention,
  placeholder,
  disabled,
  className,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<TabInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [allTabs, setAllTabs] = useState<TabInfo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all tabs when component mounts
  useEffect(() => {
    loadOpenTabs();
  }, []);

  // Detect @ mentions and update suggestions
  useEffect(() => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const beforeCursor = value.substring(0, cursorPosition);
    
    // Find the last @ symbol before cursor
    const atIndex = beforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const afterAt = beforeCursor.substring(atIndex + 1);
      
      // Check if there's no space after @ (valid mention)
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        const match: MentionMatch = {
          start: atIndex,
          end: cursorPosition,
          query: afterAt.toLowerCase(),
        };
        
        setMentionMatch(match);
        
        // Filter tabs based on query
        const filtered = allTabs.filter(tab =>
          tab.title.toLowerCase().includes(match.query) ||
          tab.url.toLowerCase().includes(match.query)
        ).slice(0, 5); // Limit to 5 suggestions
        
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(0);
        return;
      }
    }
    
    // No valid mention found
    setShowSuggestions(false);
    setMentionMatch(null);
  }, [value, allTabs]);

  const loadOpenTabs = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_OPEN_TABS,
      });

      if (response.success) {
        // Filter out current tab and extension pages
        const openTabs = response.data.filter((tab: TabInfo) => 
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('moz-extension://') &&
          !tab.url.startsWith('about:')
        );
        setAllTabs(openTabs);
      }
    } catch (error) {
      console.error('Error loading open tabs:', error);
    }
  };

  const insertMention = (tab: TabInfo) => {
    if (!mentionMatch || !inputRef.current) return;

    const beforeMention = value.substring(0, mentionMatch.start);
    const afterMention = value.substring(mentionMatch.end);
    const mentionText = `@[${tab.title}]`;
    
    const newValue = beforeMention + mentionText + ' ' + afterMention;
    onChange(newValue);
    
    // Call the callback to handle the tab attachment
    onTabMention(tab);
    
    // Hide suggestions
    setShowSuggestions(false);
    setMentionMatch(null);
    
    // Set cursor position after the mention
    setTimeout(() => {
      const newPosition = beforeMention.length + mentionText.length + 1;
      inputRef.current?.setSelectionRange(newPosition, newPosition);
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            insertMention(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          setMentionMatch(null);
          break;
      }
    } else {
      // Pass through to parent if not handling suggestions
      if (e.key === 'Enter') {
        onKeyPress(e);
      }
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {/* Mention suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 mb-4 w-full max-w-sm bg-white dark:bg-darkBg-primary border border-gray-200 dark:border-darkBg-secondary rounded-lg shadow-xl z-[9999] transform translate-y-[-8px]">
          <div className="p-2 border-b border-gray-200 dark:border-darkBg-secondary">
            <div className="text-xs text-gray-500 dark:text-darkText-tertiary">Select a tab to attach:</div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {suggestions.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => insertMention(tab)}
                className={`w-full flex items-center gap-2 p-2 text-left transition ${
                  index === selectedIndex
                    ? 'bg-blue-100 dark:bg-blue-900/50'
                    : 'hover:bg-gray-100 dark:hover:bg-darkBg-tertiary'
                }`}
              >
                <div className="w-4 h-4 flex-shrink-0">
                  {tab.favIconUrl ? (
                    <img src={tab.favIconUrl} alt="" className="w-4 h-4" />
                  ) : (
                    <div className="w-4 h-4 bg-gray-300 dark:bg-darkBg-secondary rounded"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary truncate">
                    {tab.title || 'Untitled'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-darkText-tertiary truncate">
                    {tab.url}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};