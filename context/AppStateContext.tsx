import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Swap pre-fill configuration from AI recommendations
interface SwapPrefill {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  reason?: string;
}

// Define the application state interface
interface AppState {
  activeTab: string;
  chainId: number | null;
  swapPrefill: SwapPrefill | null;
  darkMode: boolean;
  themeLoaded: boolean;
}

// Define the context type
interface AppStateContextType extends Omit<AppState, 'themeLoaded'> {
  setActiveTab: (tab: string) => void;
  setChainId: (chainId: number | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  initializeFromStorage: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
  themeLoaded: boolean;
}

// Create the context with default values
const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Helper to get system preference
function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Helper to get stored preference
function getStoredPreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      return stored === 'true';
    }
  } catch (e) {
    // localStorage may be unavailable
  }
  return null;
}

// Helper to apply theme to document
function applyTheme(isDark: boolean) {
  if (typeof document === 'undefined') return;
  
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    activeTab: 'info',
    chainId: null,
    swapPrefill: null,
    darkMode: false,
    themeLoaded: false,
  });

  // Initialize theme on mount (client-side only)
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    const storedPreference = getStoredPreference();
    const initialDarkMode = storedPreference !== null ? storedPreference : getSystemPreference();
    
    // Apply theme immediately
    applyTheme(initialDarkMode);
    
    setState(prev => ({
      ...prev,
      activeTab: savedTab || 'info',
      darkMode: initialDarkMode,
      themeLoaded: true,
    }));
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply system preference if no stored preference exists
      if (getStoredPreference() === null) {
        const newDarkMode = e.matches;
        applyTheme(newDarkMode);
        setState(prev => ({ ...prev, darkMode: newDarkMode }));
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    if (state.themeLoaded) {
      localStorage.setItem('activeTab', state.activeTab);
    }
  }, [state.activeTab, state.themeLoaded]);

  // Set chainId
  const setChainId = useCallback((chainId: number | null) => {
    setState(prev => ({ ...prev, chainId }));
  }, []);

  // Set active tab
  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Navigate to swap with pre-filled values (from AI recommendations)
  const navigateToSwap = useCallback((prefill: SwapPrefill) => {
    setState(prev => ({ ...prev, activeTab: 'swap', swapPrefill: prefill }));
  }, []);

  // Clear swap prefill after it's been consumed
  const clearSwapPrefill = useCallback(() => {
    setState(prev => ({ ...prev, swapPrefill: null }));
  }, []);

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setState(prev => {
      const newDarkMode = !prev.darkMode;
      localStorage.setItem('darkMode', String(newDarkMode));
      applyTheme(newDarkMode);
      return { ...prev, darkMode: newDarkMode };
    });
  }, []);

  // Set dark mode directly
  const setDarkMode = useCallback((darkMode: boolean) => {
    localStorage.setItem('darkMode', String(darkMode));
    applyTheme(darkMode);
    setState(prev => ({ ...prev, darkMode }));
  }, []);

  // Initialize from storage
  const initializeFromStorage = useCallback(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
      setState(prev => ({ ...prev, activeTab: savedTab }));
    }
  }, []);

  const contextValue: AppStateContextType = {
    activeTab: state.activeTab,
    chainId: state.chainId,
    swapPrefill: state.swapPrefill,
    darkMode: state.darkMode,
    themeLoaded: state.themeLoaded,
    setActiveTab,
    setChainId,
    navigateToSwap,
    clearSwapPrefill,
    initializeFromStorage,
    toggleDarkMode,
    setDarkMode,
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook to use the app state context
export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
