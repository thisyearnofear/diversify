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

// User activity tracking for auto-progression
interface UserActivity {
  swapCount: number;
  lastSwapDate: number | null;
  hasViewedProtection: boolean;
  hasViewedAnalytics: boolean;
}

// Define the application state interface
interface AppState {
  activeTab: string;
  chainId: number | null;
  swapPrefill: SwapPrefill | null;
  darkMode: boolean;
  themeLoaded: boolean;
  guidedTour: GuidedTourState | null;
  visitedTabs: string[];
  experienceMode: UserExperienceMode;
  userActivity: UserActivity;
}

// Define the context type
interface AppStateContextType extends Omit<AppState, "themeLoaded"> {
  setActiveTab: (tab: string) => void;
  setChainId: (chainId: number | null) => void;
  setSwapPrefill: (prefill: SwapPrefill | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  initializeFromStorage: () => void;
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
  themeLoaded: boolean;
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
    activeTab: "info",
    chainId: null,
    swapPrefill: null,
    darkMode: false,
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
  });

  // Initialize theme on mount (client-side only)
  useEffect(() => {
    const savedTab = localStorage.getItem("activeTab");
    const storedPreference = getStoredPreference();
    const initialDarkMode =
      storedPreference !== null ? storedPreference : getSystemPreference();

    // Load experience mode and activity from storage
    const savedMode = localStorage.getItem("experienceMode") as UserExperienceMode | null;
    const savedActivity = localStorage.getItem("userActivity");

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
      activeTab: savedTab || "info",
      darkMode: initialDarkMode,
      themeLoaded: true,
      experienceMode,
      userActivity,
    }));
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply system preference if no stored preference exists
      if (getStoredPreference() === null) {
        const newDarkMode = e.matches;
        applyTheme(newDarkMode);
        setState((prev) => ({ ...prev, darkMode: newDarkMode }));
      }
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

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setState((prev) => {
      const newDarkMode = !prev.darkMode;
      localStorage.setItem("darkMode", String(newDarkMode));
      applyTheme(newDarkMode);
      return { ...prev, darkMode: newDarkMode };
    });
  }, []);

  // Set dark mode directly
  const setDarkMode = useCallback((darkMode: boolean) => {
    localStorage.setItem("darkMode", String(darkMode));
    applyTheme(darkMode);
    setState((prev) => ({ ...prev, darkMode }));
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

  const contextValue: AppStateContextType = {
    activeTab: state.activeTab,
    chainId: state.chainId,
    swapPrefill: state.swapPrefill,
    darkMode: state.darkMode,
    themeLoaded: state.themeLoaded,
    guidedTour: state.guidedTour,
    visitedTabs: state.visitedTabs,
    experienceMode: state.experienceMode,
    userActivity: state.userActivity,
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
