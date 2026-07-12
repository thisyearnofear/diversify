import { useEffect, useState } from 'react';
// Deep leaf import — NOT the barrel — keeps the timeout helper available
// without dragging the AI/swap/ethers stack into first-load.
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
// Bound Juno status check so a slow upstream can't hold up the onramp UI.
const JUNO_STATUS_TIMEOUT_MS = 6000;

export interface JunoStatus {
  configured: boolean;
  demoMode?: boolean;
  baseUrl: string;
  mutationsEnabled: boolean;
}

export function useJunoStatus() {
  const [status, setStatus] = useState<JunoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchWithTimeout(
          `${API_BASE}/api/bitso/juno?resource=status`,
          {},
          JUNO_STATUS_TIMEOUT_MS,
        );
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || 'Could not load Juno status');
        }

        if (!cancelled) {
          setStatus(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load Juno status');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, isLoading, error };
}
