import React from 'react';
import { MessageCircle, Calendar } from 'lucide-react';
import { Popover } from './Popover';
import type { ConversationWithStats } from '@/handlers/conversation.handler';

interface ConversationSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: ConversationWithStats[];
  currentConversationId?: string;
  onSelectConversation: (conversation: ConversationWithStats) => void;
  onNewConversation: () => void;
  isLoading?: boolean;
}

export const ConversationSwitcher: React.FC<ConversationSwitcherProps> = ({
  isOpen,
  onClose,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isLoading = false,
}) => {
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

  return (
    <Popover
      isOpen={isOpen}
      onClose={onClose}
      title="Switch Conversation"
      className="min-w-[300px] max-h-[400px]"
      position="bottom-right"
    >
      <div className="space-y-2">
        {/* New Conversation Button */}
        <button
          onClick={() => {
            onNewConversation();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition text-left border border-blue-200 dark:border-darkBg-secondary bg-blue-50 dark:bg-darkBg-tertiary"
        >
          <MessageCircle size={18} className="text-blue-600 dark:text-blue-400" />
          <div>
            <div className="text-sm font-medium text-blue-700 dark:text-blue-400">New Conversation</div>
            <div className="text-xs text-blue-600 dark:text-blue-500">Start a fresh chat</div>
          </div>
        </button>

        {/* Divider */}
        {conversations.length > 0 && (
          <div className="border-t border-gray-200 dark:border-darkBg-secondary my-2"></div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <div className="text-sm text-gray-500 dark:text-darkText-tertiary">Loading conversations...</div>
          </div>
        )}

        {/* Conversations List */}
        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <MessageCircle size={32} className="text-gray-300 dark:text-gray-600 mb-2" />
            <div className="text-sm text-gray-500 dark:text-darkText-tertiary">No conversations yet</div>
            <div className="text-xs text-gray-400 dark:text-darkText-tertiary">Start your first chat above</div>
          </div>
        )}

        {!isLoading && conversations.length > 0 && (
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => {
                  onSelectConversation(conversation);
                  onClose();
                }}
                className={`w-full flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-darkBg-tertiary rounded-lg transition text-left ${
                  currentConversationId === conversation.id 
                    ? 'bg-blue-50 dark:bg-darkBg-tertiary border border-blue-200 dark:border-darkBg-secondary' 
                    : 'border border-transparent'
                }`}
              >
                <MessageCircle 
                  size={16} 
                  className={`mt-0.5 flex-shrink-0 ${
                    currentConversationId === conversation.id 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-400 dark:text-darkText-tertiary'
                  }`} 
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${
                    currentConversationId === conversation.id 
                      ? 'text-blue-700 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-darkText-secondary'
                  }`}>
                    {conversation.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar size={12} className="text-gray-400 dark:text-darkText-tertiary" />
                    <div className="text-xs text-gray-500 dark:text-darkText-tertiary">
                      {formatDate(conversation.updated_at)}
                    </div>
                    {conversation.message_count && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <div className="text-xs text-gray-500 dark:text-darkText-tertiary">
                          {conversation.message_count} messages
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
};