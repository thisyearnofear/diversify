import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

// Swap pre-fill configuration from AI recommendations
interface SwapPrefill {
  fromToken?: string;
  toToken?: string;
  amount?: string;
  reason?: string;
  fromChainId?: number;
  toChainId?: number;
}

// Guided tour state (ENHANCEMENT: extends navigation system)
interface GuidedTourState {
  tourId: string;
  currentStep: number;
  totalSteps: number;
  highlightSection?: string;
}

// User experience modes for progressive disclosure
export type UserExperienceMode = 'beginner' | 'intermediate' | 'advanced';

// Financial strategy based on cultural philosophy
export type FinancialStrategy =
  | 'africapitalism'
  | 'buen_vivir'
  | 'confucian'
  | 'gotong_royong'
  | 'islamic'
  | 'global'
  | 'custom'
  | null; // null = not yet selected

// User activity tracking for auto-progression
interface UserActivity {
  swapCount: number;
  lastSwapDate: number | null;
  hasViewedProtection: boolean;
  hasViewedAnalytics: boolean;
}

// Demo mode for trying the app without connecting wallet
interface DemoModeState {
  isActive: boolean;
  mockAddress: string;
  mockChainId: number;
}

// Theme preference mode
export type ThemeMode = 'auto' | 'light' | 'dark';

// Define the application state interface
interface AppState {
  activeTab: string;
  chainId: number | null;
  swapPrefill: SwapPrefill | null;
  darkMode: boolean;
  themeMode: ThemeMode; // ENHANCEMENT: auto time-based switching
  themeLoaded: boolean;
  guidedTour: GuidedTourState | null;
  visitedTabs: string[];
  experienceMode: UserExperienceMode;
  userActivity: UserActivity;
  demoMode: DemoModeState;
  financialStrategy: FinancialStrategy;
}

// Define the context type
interface AppStateContextType extends Omit<AppState, "themeLoaded"> {
  setActiveTab: (tab: string) => void;
  setChainId: (chainId: number | null) => void;
  setSwapPrefill: (prefill: SwapPrefill | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  initializeFromStorage: () => void;
  toggleDarkMode: () => void; // ENHANCEMENT: now cycles through auto → light → dark → auto
  setDarkMode: (darkMode: boolean) => void;
  themeLoaded: boolean;
  themeMode: ThemeMode;
  // Guided tour methods (ENHANCEMENT: adds tour orchestration)
  startTour: (
    tourId: string,
    totalSteps: number,
    initialTab: string,
    section?: string,
  ) => void;
  nextTourStep: (
    nextTab: string,
    section?: string,
    prefill?: SwapPrefill,
  ) => void;
  exitTour: () => void;
  dismissTour: (tourId: string) => void;
  isTourDismissed: (tourId: string) => boolean;
  // Experience mode methods (ENHANCEMENT: progressive disclosure)
  setExperienceMode: (mode: UserExperienceMode) => void;
  recordSwap: () => void;
  shouldShowAdvancedFeatures: () => boolean;
  shouldShowIntermediateFeatures: () => boolean;
  // Demo mode methods
  demoMode: DemoModeState;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
  // Financial strategy methods
  financialStrategy: FinancialStrategy;
  setFinancialStrategy: (strategy: FinancialStrategy) => void;
}

// Create the context with default values
const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined,
);

// Helper to get system preference
function getSystemPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Helper to get stored preference
function getStoredPreference(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("darkMode");
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // localStorage may be unavailable
  }
  return null;
}

// ENHANCEMENT: Time-based theme calculation (6PM-6AM = dark)
function shouldBeDarkBasedOnTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6; // 6PM to 6AM
}

// Helper to get stored theme mode
function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return 'auto';
  try {
    const stored = localStorage.getItem("themeMode") as ThemeMode;
    if (stored && ['auto', 'light', 'dark'].includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  return 'auto';
}

// Helper to calculate effective dark mode based on theme mode
function calculateDarkMode(themeMode: ThemeMode): boolean {
  if (themeMode === 'auto') {
    return shouldBeDarkBasedOnTime();
  }
  return themeMode === 'dark';
}

// Helper to apply theme to document
function applyTheme(isDark: boolean) {
  if (typeof document === "undefined") return;

  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// Provider component
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>({
    activeTab: "overview",
    chainId: null,
    swapPrefill: null,
    darkMode: false,
    themeMode: 'auto', // ENHANCEMENT: default to auto time-based
    themeLoaded: false,
    guidedTour: null,
    visitedTabs: [],
    experienceMode: "beginner",
    userActivity: {
      swapCount: 0,
      lastSwapDate: null,
      hasViewedProtection: false,
      hasViewedAnalytics: false,
    },
    demoMode: {
      isActive: false,
      mockAddress: "0xDemo1234567890123456789012345678901234",
      mockChainId: 42220, // Celo Mainnet
    },
    financialStrategy: null, // User hasn't selected yet
  });

  // Initialize theme on mount (client-side only)
  useEffect(() => {
    const savedTab = localStorage.getItem("activeTab");
    
    // ENHANCEMENT: Check for new themeMode, migrate from old darkMode if needed
    let themeMode = getStoredThemeMode();
    const legacyDarkMode = getStoredPreference();
    
    // Migration: if old darkMode exists but no themeMode, migrate to manual mode
    if (legacyDarkMode !== null && !localStorage.getItem("themeMode")) {
      themeMode = legacyDarkMode ? 'dark' : 'light';
      localStorage.setItem("themeMode", themeMode);
    }
    
    const initialDarkMode = calculateDarkMode(themeMode);

    // Load experience mode and activity from storage
    const savedMode = localStorage.getItem("experienceMode") as UserExperienceMode | null;
    const savedActivity = localStorage.getItem("userActivity");
    const savedStrategy = localStorage.getItem("financialStrategy") as FinancialStrategy | null;

    let experienceMode: UserExperienceMode = "beginner";
    let userActivity: UserActivity = {
      swapCount: 0,
      lastSwapDate: null,
      hasViewedProtection: false,
      hasViewedAnalytics: false,
    };

    if (savedMode && ["beginner", "intermediate", "advanced"].includes(savedMode)) {
      experienceMode = savedMode;
    }

    if (savedActivity) {
      try {
        userActivity = JSON.parse(savedActivity);
      } catch (e) {
        console.warn("Failed to parse user activity:", e);
      }
    }

    // Auto-upgrade based on activity
    if (experienceMode === "beginner" && userActivity.swapCount >= 3) {
      experienceMode = "intermediate";
    } else if (experienceMode === "intermediate" && userActivity.swapCount >= 10) {
      experienceMode = "advanced";
    }

    // Apply theme immediately
    applyTheme(initialDarkMode);

    setState((prev) => ({
      ...prev,
      activeTab: savedTab || "overview",
      darkMode: initialDarkMode,
      themeMode,
      themeLoaded: true,
      experienceMode,
      userActivity,
      financialStrategy: savedStrategy || null,
    }));
  }, []);

  // ENHANCEMENT: Auto-update theme in auto mode (checks every hour)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const updateAutoTheme = () => {
      setState((prev) => {
        // Only update if in auto mode
        if (prev.themeMode === 'auto') {
          const newDarkMode = shouldBeDarkBasedOnTime();
          if (newDarkMode !== prev.darkMode) {
            applyTheme(newDarkMode);
            return { ...prev, darkMode: newDarkMode };
          }
        }
        return prev;
      });
    };
    
    // Check every hour
    const interval = setInterval(updateAutoTheme, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Listen for system preference changes (fallback for manual mode)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      // Ignore - we handle theme via themeMode now
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    if (state.themeLoaded) {
      localStorage.setItem("activeTab", state.activeTab);
    }
  }, [state.activeTab, state.themeLoaded]);

  // Set chainId
  const setChainId = useCallback((chainId: number | null) => {
    setState((prev) => ({ ...prev, chainId }));
  }, []);

  // Set swap prefill
  const setSwapPrefill = useCallback((swapPrefill: SwapPrefill | null) => {
    setState((prev) => ({ ...prev, swapPrefill }));
  }, []);

  // Set active tab (ENHANCEMENT: tracks visited tabs for tour detection)
  const setActiveTab = useCallback((tab: string) => {
    setState((prev) => ({
      ...prev,
      activeTab: tab,
      visitedTabs: prev.visitedTabs.includes(tab)
        ? prev.visitedTabs
        : [...prev.visitedTabs, tab],
    }));
  }, []);

  // Navigate to swap with pre-filled values (from AI recommendations)
  const navigateToSwap = useCallback((prefill: SwapPrefill) => {
    setState((prev) => ({ ...prev, activeTab: "swap", swapPrefill: prefill }));
  }, []);

  // Clear swap prefill after it's been consumed
  const clearSwapPrefill = useCallback(() => {
    setState((prev) => ({ ...prev, swapPrefill: null }));
  }, []);

  // ENHANCEMENT: Toggle through theme modes (auto → light → dark → auto)
  const toggleDarkMode = useCallback(() => {
    setState((prev) => {
      let newThemeMode: ThemeMode;
      
      // Cycle through modes
      if (prev.themeMode === 'auto') {
        newThemeMode = 'light';
      } else if (prev.themeMode === 'light') {
        newThemeMode = 'dark';
      } else {
        newThemeMode = 'auto';
      }
      
      const newDarkMode = calculateDarkMode(newThemeMode);
      localStorage.setItem("themeMode", newThemeMode);
      // Keep legacy darkMode in sync for compatibility
      localStorage.setItem("darkMode", String(newDarkMode));
      applyTheme(newDarkMode);
      
      return { ...prev, darkMode: newDarkMode, themeMode: newThemeMode };
    });
  }, []);

  // Set dark mode directly (sets to manual mode)
  const setDarkMode = useCallback((darkMode: boolean) => {
    const themeMode: ThemeMode = darkMode ? 'dark' : 'light';
    localStorage.setItem("themeMode", themeMode);
    localStorage.setItem("darkMode", String(darkMode));
    applyTheme(darkMode);
    setState((prev) => ({ ...prev, darkMode, themeMode }));
  }, []);

  // Initialize from storage
  const initializeFromStorage = useCallback(() => {
    const savedTab = localStorage.getItem("activeTab");
    const deprecatedTabs = ["analytics", "strategies", "protect"]; // protection renamed to oracle but ID kept, but for others
    if (savedTab) {
      if (deprecatedTabs.includes(savedTab)) {
        setState((prev) => ({ ...prev, activeTab: "overview" }));
      } else {
        setState((prev) => ({ ...prev, activeTab: savedTab }));
      }
    }
  }, []);

  // Guided tour methods (ENHANCEMENT: minimal tour orchestration)
  const startTour = useCallback(
    (
      tourId: string,
      totalSteps: number,
      initialTab: string,
      section?: string,
    ) => {
      setState((prev) => ({
        ...prev,
        activeTab: initialTab,
        guidedTour: {
          tourId,
          currentStep: 0,
          totalSteps,
          highlightSection: section,
        },
      }));
    },
    [],
  );

  const nextTourStep = useCallback(
    (nextTab: string, section?: string, prefill?: SwapPrefill) => {
      setState((prev) => {
        if (!prev.guidedTour) return prev;
        const nextStep = prev.guidedTour.currentStep + 1;
        return {
          ...prev,
          activeTab: nextTab,
          guidedTour: {
            ...prev.guidedTour,
            currentStep: nextStep,
            highlightSection: section,
          },
          swapPrefill: prefill || prev.swapPrefill,
        };
      });
    },
    [],
  );

  const exitTour = useCallback(() => {
    setState((prev) => ({ ...prev, guidedTour: null }));
  }, []);

  const dismissTour = useCallback(
    (tourId: string) => {
      try {
        const dismissed = JSON.parse(
          localStorage.getItem("dismissedTours") || "[]",
        );
        localStorage.setItem(
          "dismissedTours",
          JSON.stringify([...dismissed, tourId]),
        );
      } catch (e) {
        console.error("Failed to dismiss tour:", e);
      }
      exitTour();
    },
    [exitTour],
  );

  const isTourDismissed = useCallback((tourId: string): boolean => {
    try {
      const dismissed = JSON.parse(
        localStorage.getItem("dismissedTours") || "[]",
      );
      return dismissed.includes(tourId);
    } catch {
      return false;
    }
  }, []);

  // Experience mode methods (ENHANCEMENT: progressive disclosure)
  const setExperienceMode = useCallback((mode: UserExperienceMode) => {
    setState((prev) => ({ ...prev, experienceMode: mode }));
    localStorage.setItem("experienceMode", mode);
  }, []);

  const recordSwap = useCallback(() => {
    setState((prev) => {
      const newActivity = {
        ...prev.userActivity,
        swapCount: prev.userActivity.swapCount + 1,
        lastSwapDate: Date.now(),
      };

      // Auto-upgrade experience mode based on activity
      let newMode = prev.experienceMode;
      if (newMode === "beginner" && newActivity.swapCount >= 3) {
        newMode = "intermediate";
      } else if (newMode === "intermediate" && newActivity.swapCount >= 10) {
        newMode = "advanced";
      }

      // Persist to storage
      localStorage.setItem("userActivity", JSON.stringify(newActivity));
      if (newMode !== prev.experienceMode) {
        localStorage.setItem("experienceMode", newMode);
      }

      return {
        ...prev,
        userActivity: newActivity,
        experienceMode: newMode,
      };
    });
  }, []);

  const shouldShowAdvancedFeatures = useCallback(() => {
    return state.experienceMode === "advanced";
  }, [state.experienceMode]);

  const shouldShowIntermediateFeatures = useCallback(() => {
    return state.experienceMode === "intermediate" || state.experienceMode === "advanced";
  }, [state.experienceMode]);

  // Demo mode methods
  const enableDemoMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      demoMode: { ...prev.demoMode, isActive: true },
      activeTab: "overview", // Start at overview
    }));
  }, []);

  const disableDemoMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      demoMode: { ...prev.demoMode, isActive: false },
    }));
  }, []);

  const setFinancialStrategy = useCallback((strategy: FinancialStrategy) => {
    setState((prev) => ({
      ...prev,
      financialStrategy: strategy,
    }));
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (strategy) {
        localStorage.setItem('financialStrategy', strategy);
      } else {
        localStorage.removeItem('financialStrategy');
      }
    }
  }, []);

  const contextValue: AppStateContextType = {
    activeTab: state.activeTab,
    chainId: state.chainId,
    swapPrefill: state.swapPrefill,
    darkMode: state.darkMode,
    themeLoaded: state.themeLoaded,
    themeMode: state.themeMode,
    guidedTour: state.guidedTour,
    visitedTabs: state.visitedTabs,
    experienceMode: state.experienceMode,
    userActivity: state.userActivity,
    financialStrategy: state.financialStrategy,
    setActiveTab,
    setChainId,
    setSwapPrefill,
    navigateToSwap,
    clearSwapPrefill,
    initializeFromStorage,
    toggleDarkMode,
    setDarkMode,
    startTour,
    nextTourStep,
    exitTour,
    dismissTour,
    isTourDismissed,
    setExperienceMode,
    recordSwap,
    shouldShowAdvancedFeatures,
    shouldShowIntermediateFeatures,
    demoMode: state.demoMode,
    enableDemoMode,
    disableDemoMode,
    setFinancialStrategy,
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
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
};
