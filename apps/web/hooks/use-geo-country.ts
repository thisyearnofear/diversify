import { useEffect, useState } from 'react';
import { geoCountryFromDocument } from '@/lib/geo';

/**
 * The visitor's country as the edge saw it (ISO alpha-2), read once from
 * the `dfi-cc` cookie the proxy stamps. Null on SSR and in dev until a
 * cookie exists — the same "unknown geo" a headerless request produces.
 */
export function useGeoCountry(): string | null {
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    setCountry(geoCountryFromDocument());
  }, []);
  return country;
}
