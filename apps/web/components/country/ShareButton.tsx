/**
 * ShareButton — one share verb for the nation-desk surfaces.
 *
 * navigator.share when the platform has it, clipboard copy otherwise.
 * Fires `nation_share` with the surface + code — never the content.
 */
import { useState } from 'react';
import { trackFunnelEvent } from '@/lib/analytics';

interface Props {
  /** 'country' | 'compare' — coarse surface only. */
  surface: string;
  code: string;
  title: string;
  url: string;
}

export function ShareButton({ surface, code, title, url }: Props) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    trackFunnelEvent('nation_share', { surface, code });
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dismissed share sheet or denied clipboard — silent.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="min-h-11 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white"
    >
      {copied ? 'Link copied' : 'Share this'}
    </button>
  );
}
