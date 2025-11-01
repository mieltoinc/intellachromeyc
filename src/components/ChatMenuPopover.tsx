import React from 'react';
import { ArrowRightLeft, PenTool, Trash2, Settings } from 'lucide-react';
import { Popover } from './Popover';

interface ChatMenuPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchChat?: () => void;
  onNewChat?: () => void;
  onDeleteChat?: () => void;
  onOpenSettings?: () => void;
}

export const ChatMenuPopover: React.FC<ChatMenuPopoverProps> = ({
  isOpen,
  onClose,
  onSwitchChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
}) => {
  return (
    <Popover
      isOpen={isOpen}
      onClose={onClose}
      className="min-w-[180px]"
      position="bottom-right"
      showCloseButton={false}
    >
      <div className="space-y-1">
        <button
          onClick={() => {
            onSwitchChat?.();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-darkBg-tertiary rounded-lg transition text-left"
        >
          <ArrowRightLeft size={16} className="text-gray-500 dark:text-darkText-tertiary" />
          <div className="text-sm font-medium text-gray-700 dark:text-darkText-secondary">Switch Chat</div>
        </button>

        <button
          onClick={() => {
            onNewChat?.();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-darkBg-tertiary rounded-lg transition text-left"
        >
          <PenTool size={16} className="text-gray-500 dark:text-darkText-tertiary" />
          <div className="text-sm font-medium text-gray-700 dark:text-darkText-secondary">New Chat</div>
        </button>



        <button
          onClick={() => {
            onDeleteChat?.();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-2 hover:bg-red-50 dark:hover:bg-darkBg-tertiary rounded-lg transition text-left"
        >
          <Trash2 size={16} className="text-red-500" />
          <div className="text-sm font-medium text-red-600 dark:text-red-400">Delete Chat</div>
        </button>
        <div className="border-t border-gray-200 dark:border-darkBg-secondary my-2"></div>

        <button
          onClick={() => {
            onOpenSettings?.();
            onClose();
          }}
          className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-darkBg-tertiary rounded-lg transition text-left"
        >
          <Settings size={16} className="text-gray-500 dark:text-darkText-tertiary" />
          <div className="text-sm font-medium text-gray-700 dark:text-darkText-secondary">Settings</div>
        </button>


      </div>
    </Popover>
  );
};