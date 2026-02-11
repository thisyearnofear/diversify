import React from 'react';
import { useAppState } from '../../context/AppStateContext';

const ThemeToggle: React.FC = () => {
  const { darkMode, themeMode, toggleDarkMode, themeLoaded } = useAppState();

  // Prevent flash by not rendering until theme is loaded
  if (!themeLoaded) {
    return (
      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
    );
  }

  // ENHANCEMENT: Dynamic tooltip based on current mode
  const getTooltip = () => {
    if (themeMode === 'auto') {
      return '🌅 Auto (time-based) • Click for light mode';
    } else if (themeMode === 'light') {
      return '☀️ Light mode • Click for dark mode';
    } else {
      return '🌙 Dark mode • Click for auto mode';
    }
  };

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 hover:scale-105 active:scale-95"
      aria-label={getTooltip()}
      title={getTooltip()}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon */}
        <svg 
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
            darkMode 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-50'
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" strokeWidth="2" />
          <line x1="12" y1="1" x2="12" y2="3" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="21" x2="12" y2="23" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" strokeWidth="2" strokeLinecap="round" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" strokeWidth="2" strokeLinecap="round" />
          <line x1="1" y1="12" x2="3" y2="12" strokeWidth="2" strokeLinecap="round" />
          <line x1="21" y1="12" x2="23" y2="12" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" strokeWidth="2" strokeLinecap="round" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" strokeWidth="2" strokeLinecap="round" />
        </svg>
        
        {/* Moon icon */}
        <svg 
          className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
            darkMode 
              ? 'opacity-0 -rotate-90 scale-50' 
              : 'opacity-100 rotate-0 scale-100'
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            strokeWidth="2"
          />
        </svg>
      </div>
    </button>
  );
};

export default ThemeToggle;
