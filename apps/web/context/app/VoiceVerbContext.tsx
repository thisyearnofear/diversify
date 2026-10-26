/**
 * VoiceVerbContext — per-tab handlers for spoken instrument verbs.
 *
 * A tab registers one handler while mounted; use-voice-intent routes a
 * matched verb to the active tab's handler, which dispatches preview
 * actions and returns a third-person confirmation line for Guardian to
 * speak. No handler (or a null return) falls through to askAdvisor.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
} from "react";
import type { TabId } from "@/constants/tabs";
import type { VoiceVerb } from "@/lib/voice-verbs";

/** Returns the confirmation line, or null to fall through to askAdvisor. */
export type VoiceVerbHandler = (verb: VoiceVerb) => string | null | Promise<string | null>;

interface VoiceVerbRegistry {
  register: (tab: TabId, handler: VoiceVerbHandler) => () => void;
  handlerFor: (tab: TabId) => VoiceVerbHandler | undefined;
}

const VoiceVerbContext = createContext<VoiceVerbRegistry | null>(null);

export function VoiceVerbProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef(new Map<TabId, VoiceVerbHandler>());
  const register = useCallback((tab: TabId, handler: VoiceVerbHandler) => {
    handlers.current.set(tab, handler);
    return () => {
      if (handlers.current.get(tab) === handler) handlers.current.delete(tab);
    };
  }, []);
  const handlerFor = useCallback((tab: TabId) => handlers.current.get(tab), []);
  return (
    <VoiceVerbContext.Provider value={{ register, handlerFor }}>
      {children}
    </VoiceVerbContext.Provider>
  );
}

export function useVoiceVerbRegistry(): VoiceVerbRegistry | null {
  return useContext(VoiceVerbContext);
}
