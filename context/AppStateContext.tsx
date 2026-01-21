import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define the application state interface
interface AppState {
  activeTab: string;
  chainId: number | null;
}

// Define the context type
interface AppStateContextType extends AppState {
  setActiveTab: (tab: string) => void;
  setChainId: (chainId: number | null) => void;
  initializeFromStorage: () => void;
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
    
    return {
      activeTab: savedTab || 'info',
      chainId: null,
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
    setActiveTab,
    setChainId,
    initializeFromStorage,
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