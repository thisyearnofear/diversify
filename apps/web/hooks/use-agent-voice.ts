import { useCallback } from "react";
import type { AgentVoiceActions, AgentVoiceDependencies } from "./agent-types";
// Deep leaf import — keeps the promise utils (and any upstream deps) out of first-load.
import { fetchWithTimeout } from "@diversifi/shared/src/utils/promise-utils";
import { speechReadback } from '@diversifi/shared/src/services/ai/guardian-interaction';

// Voice TTS/STT routes are write-heavy + upstream-bound (ElevenLabs) — give
// them the 8s budget so a busy API doesn't clip a user's spoken query.
const VOICE_FETCH_TIMEOUT_MS = 8000;

export function useAgentVoice({
  apiBase,
  capabilities,
}: AgentVoiceDependencies): AgentVoiceActions {
  const generateSpeech = useCallback(
    async (text: string, signal?: AbortSignal): Promise<Blob | null> => {
      if (!capabilities.voiceOutput) {
        console.warn("[useAgentVoice] Voice output not available");
        return null;
      }

      try {
        const response = await fetchWithTimeout(
          `${apiBase}/api/agent/speak`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: speechReadback(text) }),
            signal,
          },
          VOICE_FETCH_TIMEOUT_MS,
        );

        if (response.ok) {
          return await response.blob();
        }
      } catch (error) {
        if (!signal?.aborted) console.warn("[useAgentVoice] Speech generation unavailable");
      }
      return null;
    },
    [apiBase, capabilities.voiceOutput],
  );

  const transcribeAudio = useCallback(
    async (audioBlob: Blob, signal?: AbortSignal): Promise<string | null> => {
      if (!capabilities.voiceInput) {
        console.warn("[useAgentVoice] Voice input not available");
        return null;
      }

      try {
        const formData = new FormData();
        const mime = audioBlob.type.split(';')[0];
        const extension = mime === 'audio/mp4' ? 'm4a' : mime === 'audio/ogg' ? 'ogg' : mime === 'audio/wav' ? 'wav' : 'webm';
        formData.append("audio", audioBlob, `recording.${extension}`);

        const response = await fetchWithTimeout(
          `${apiBase}/api/agent/transcribe`,
          {
            method: "POST",
            body: formData,
            signal,
          },
          VOICE_FETCH_TIMEOUT_MS,
        );

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
        if (!signal?.aborted) console.warn("[useAgentVoice] Transcription unavailable");
      }
      return null;
    },
    [apiBase, capabilities.voiceInput],
  );

  return { generateSpeech, transcribeAudio };
}
