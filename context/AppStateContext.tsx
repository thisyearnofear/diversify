import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

// Define the context type
interface AppStateContextType extends AppState {
  setActiveTab: (tab: string) => void;
  setChainId: (chainId: number | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  initializeFromStorage: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
}

// Create the context with default values
const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    // Initialize from localStorage or defaults
    const savedTab = typeof window !== 'undefined' 
      ? localStorage.getItem('activeTab') 
      : null;
    const savedDarkMode = typeof window !== 'undefined' 
      ? localStorage.getItem('darkMode') 
      : null;
    
    return {
      activeTab: savedTab || 'info',
      chainId: null,
      swapPrefill: null,
      darkMode: savedDarkMode ? JSON.parse(savedDarkMode) : false,
    };
  });

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', state.activeTab);
  }, [state.activeTab]);

  // Set chainId
  const setChainId = (chainId: number | null) => {
    setState(prev => ({ ...prev, chainId }));
  };

  // Set active tab
  const setActiveTab = (tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  // Navigate to swap with pre-filled values (from AI recommendations)
  const navigateToSwap = (prefill: SwapPrefill) => {
    setState(prev => ({ ...prev, activeTab: 'swap', swapPrefill: prefill }));
  };

  // Clear swap prefill after it's been consumed
  const clearSwapPrefill = () => {
    setState(prev => ({ ...prev, swapPrefill: null }));
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setState(prev => {
      const newDarkMode = !prev.darkMode;
      localStorage.setItem('darkMode', JSON.stringify(newDarkMode));
      return { ...prev, darkMode: newDarkMode };
    });
  };

  // Set dark mode directly
  const setDarkMode = (darkMode: boolean) => {
    setState(prev => {
      localStorage.setItem('darkMode', JSON.stringify(darkMode));
      return { ...prev, darkMode };
    });
  };

  // Initialize from storage
  const initializeFromStorage = () => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
      setState(prev => ({ ...prev, activeTab: savedTab }));
    }
  };

  const contextValue: AppStateContextType = {
    activeTab: state.activeTab,
    chainId: state.chainId,
    swapPrefill: state.swapPrefill,
    darkMode: state.darkMode,
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