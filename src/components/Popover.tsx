import React, { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  showCloseButton?: boolean;
}

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  children,
  title,
  className = '',
  position = 'bottom-left',
  showCloseButton = true,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-full left-0 mb-2';
      case 'bottom-right':
        return 'bottom-right right-0 mb-2';
      case 'top-left':
        return 'top-left left-0 mt-2';
      case 'top-right':
        return 'top-right right-0 mt-2';
      default:
        return 'bottom-left left-0 mb-2';
    }
  };

  return (
    <div
      ref={popoverRef}
      className={`absolute ${getPositionClasses()} bg-white dark:bg-darkBg-secondary border border-gray-200 dark:border-darkBg-secondary rounded-lg shadow-lg p-2 min-w-[200px] z-10 ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-darkText-secondary">{title}</span>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-darkBg-tertiary rounded text-gray-400 dark:text-darkText-tertiary hover:text-gray-600 dark:hover:text-darkText-secondary"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {!title && showCloseButton && (
        <div className="flex items-center justify-end mb-3">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-darkBg-tertiary rounded text-gray-400 dark:text-darkText-tertiary hover:text-gray-600 dark:hover:text-darkText-secondary"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {children}
    </div>
  );
};