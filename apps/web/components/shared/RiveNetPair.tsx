'use client';

/**
 * RiveNetPair — the FX-netting object: two coins converge and a link ring
 * draws around them; when the host sets `settled` the ring turns emerald
 * and a seal stamps the junction. Self-contained per design-language §5:
 * Rive owns the inside of the object; it never owns screen motion.
 *
 * Coin accents are view-model binds — the caller passes the sell/buy
 * currency tints. Reduced motion renders the static linked pair (or the
 * sealed pair) built from the `Coin` primitive; the canvas never mounts.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { Coin } from './FloatingCoins';
import { COIN_TINTS, STATUS_COLORS } from './palette';
import { canMountRive } from '../../lib/rive-runtime';

const RiveNetPairCanvas = dynamic(() => import('./RiveNetPairCanvas'), { ssr: false });

interface RiveNetPairProps {
  /** Canvas width in px; the artboard is 240×140. */
  size?: number;
  /** Sell-side coin tint (hex). Defaults to the file's teal. */
  leftColor?: string;
  /** Buy-side coin tint (hex). Defaults to the file's gold. */
  rightColor?: string;
  /** True once a settlement involving the caller has completed on-chain. */
  settled?: boolean;
}

function StaticPair({
  size,
  leftColor,
  rightColor,
  settled,
}: {
  size: number;
  leftColor: string;
  rightColor: string;
  settled: boolean;
}) {
  const coin = Math.round(size * 0.233);
  const badge = Math.round(size * 0.142);
  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: Math.round(size * (140 / 240)) }}
      role="img"
      aria-label={settled ? 'Settled currency pair' : 'Matched currency pair'}
    >
      {/* link ring */}
      <div
        className="absolute rounded-full border-[3px]"
        style={{
          left: '21%',
          right: '21%',
          top: '23%',
          bottom: '23%',
          borderColor: settled ? STATUS_COLORS.good : COIN_TINTS[1],
        }}
      />
      <Coin
        size={coin}
        color={leftColor}
        symbol=""
        className="absolute"
        style={{ left: '39.6%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Coin
        size={coin}
        color={rightColor}
        symbol=""
        className="absolute"
        style={{ left: '60.4%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      {settled && (
        <div
          className="absolute flex items-center justify-center rounded-full text-white font-black"
          style={{
            width: badge,
            height: badge,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: STATUS_COLORS.good,
            fontSize: Math.round(badge * 0.55),
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}

export default function RiveNetPair({
  size = 180,
  leftColor = COIN_TINTS[1],
  rightColor = COIN_TINTS[0],
  settled = false,
}: RiveNetPairProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || !canMountRive()) {
    return (
      <StaticPair size={size} leftColor={leftColor} rightColor={rightColor} settled={settled} />
    );
  }
  return (
    <RiveNetPairCanvas size={size} leftColor={leftColor} rightColor={rightColor} settled={settled} />
  );
}
