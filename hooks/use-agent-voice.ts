import { useCallback } from "react";
import type { AgentVoiceActions, AgentVoiceDependencies } from "./agent-types";

export function useAgentVoice({
  apiBase,
  capabilities,
}: AgentVoiceDependencies): AgentVoiceActions {
  const generateSpeech = useCallback(
    async (text: string): Promise<Blob | null> => {
      if (!capabilities.voiceOutput) {
        console.warn("[useAgentVoice] Voice output not available");
        return null;
      }

      try {
        const response = await fetch(`${apiBase}/api/agent/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (response.ok) {
          return await response.blob();
        }
      } catch (error) {
        console.error("[useAgentVoice] Speech generation failed:", error);
      }
      return null;
    },
    [apiBase, capabilities.voiceOutput],
  );

  const transcribeAudio = useCallback(
    async (audioBlob: Blob): Promise<string | null> => {
      if (!capabilities.voiceInput) {
        console.warn("[useAgentVoice] Voice input not available");
        return null;
      }

      try {
        const formData = new FormData();
        formData.append("audio", audioBlob);

        const response = await fetch(`${apiBase}/api/agent/transcribe`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          return result.text;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            "[useAgentVoice] Transcription API error:",
            response.status,
            errorData,
          );
        }
      } catch (error) {
        console.error("[useAgentVoice] Transcription network error:", error);
      }
      return null;
    },
    [apiBase, capabilities.voiceInput],
  );

  return { generateSpeech, transcribeAudio };
}
