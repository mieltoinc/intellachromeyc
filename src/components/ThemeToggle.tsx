import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') return <Monitor size={18} />;
    if (theme === 'dark') return <Sun size={18} />;
    return <Moon size={18} />;
  };

  const getTitle = () => {
    if (theme === 'system') return 'Using system theme';
    if (theme === 'dark') return 'Switch to light mode';
    return 'Switch to dark mode';
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-gray-600 dark:text-darkText-secondary hover:text-gray-900 dark:hover:text-darkText-primary hover:bg-gray-100 dark:hover:bg-darkBg-tertiary rounded-lg transition"
      title={getTitle()}
    >
      {getIcon()}
    </button>
  );
};
