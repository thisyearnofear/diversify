import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

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
        const response = await fetch(`${API_BASE}/api/bitso/juno?resource=status`);
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
