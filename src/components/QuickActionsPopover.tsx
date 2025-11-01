import React from 'react';
import { Paperclip, Zap, Camera, Compass, Image, BookOpen, MoreHorizontal, ChevronRight } from 'lucide-react';
import { Popover } from './Popover';

interface QuickActionsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUpload: () => void;
  onScreenshot?: () => void;
  onAttachCurrentPage?: () => void;
  isUploading: boolean;
}

export const QuickActionsPopover: React.FC<QuickActionsPopoverProps> = ({
  isOpen,
  onClose,
  onFileUpload,
  onScreenshot,
  onAttachCurrentPage,
  isUploading,
}) => {
  return (
    <Popover
      isOpen={isOpen}
      onClose={onClose}
      className="min-w-[240px]"
      position="bottom-left"
      showCloseButton={false}
    >
      {/* Active Features */}
      <div className="space-y-1">
        <button
          onClick={onFileUpload}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
          disabled={isUploading}
        >
          <Paperclip size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Add photos & files</div>
          </div>
        </button>
        
        <button
          onClick={onAttachCurrentPage}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
        >
          <Zap size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Attach tab</div>
          </div>
        </button>
        
        <button
          onClick={onScreenshot}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
          disabled={isUploading}
        >
          <Camera size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Attach screenshot</div>
          </div>
        </button>
        
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
        >
          <Compass size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Deep research</div>
          </div>
        </button>
        
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
        >
          <Image size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Create image</div>
          </div>
        </button>
        
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition relative group"
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Agent mode</div>
          </div>
          <div className="bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded">
            NEW
          </div>
        </button>
        
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
        >
          <BookOpen size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">Study and learn</div>
          </div>
        </button>
        
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-darkBg-tertiary transition"
        >
          <MoreHorizontal size={18} className="text-gray-600 dark:text-darkText-secondary" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-darkText-primary">More</div>
          </div>
          <ChevronRight size={16} className="text-gray-400 dark:text-darkText-tertiary" />
        </button>
      </div>
    </Popover>
  );
};