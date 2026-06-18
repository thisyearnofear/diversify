/**
 * Per-archetype hero motifs (v2 — richer, larger, more layered).
 *
 * Each motif is *abstract geometry inspired by* a cultural tradition —
 * never literal symbol or imagery use. The vocabulary is intentionally
 * geometric (concentric, stepped, tessellated, brushed, gridded) so the
 * cards stay on the right side of appropriation while still feeling
 * culturally distinct rather than generic.
 *
 * Heroes occupy a ~640px slot in the BaseCard (scaled up from the v1
 * 520px). All shapes built from primitives so satori 0.26 renders them
 * cleanly without inline SVG quirks.
 */

import React from 'react';
import { alpha } from './tokens';

interface HeroProps {
  accent: string;
  accentSoft: string;
  size?: number;
}

const DEFAULT = 640;

/* ────────────────────────────────────────────────────────────────────
 * Africapitalism — layered Adinkra-adjacent concentric system.
 * Concentric rotated squares + cardinal arms + central sun. Reads as
 * a celestial / continental medallion. Warm ochre + amber.
 * ──────────────────────────────────────────────────────────────────── */
export function AfricapitalismHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const center = size / 2;
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Cardinal "rays" — four bars from center */}
      {[0, 90].map((deg, i) => (
        <div
          key={`ray-${i}`}
          style={{
            display: 'flex',
            position: 'absolute',
            top: center - 6,
            left: 40,
            width: size - 80,
            height: 12,
            background: `linear-gradient(90deg, ${alpha(accent, 0)} 0%, ${alpha(accent, 0.35)} 20%, ${alpha(accentSoft, 0.65)} 50%, ${alpha(accent, 0.35)} 80%, ${alpha(accent, 0)} 100%)`,
            transform: `rotate(${deg}deg)`,
            transformOrigin: `${center - 40}px center`,
          }}
        />
      ))}
      {/* Concentric rotated squares — outer to inner */}
      {[0, 1, 2, 3].map((ring) => {
        const inset = 50 + ring * 70;
        return (
          <div
            key={ring}
            style={{
              display: 'flex',
              position: 'absolute',
              top: inset,
              left: inset,
              width: size - inset * 2,
              height: size - inset * 2,
              border: `${ring === 0 ? 5 : 3 - ring * 0.5}px solid ${alpha(ring === 0 ? accentSoft : accent, 0.92 - ring * 0.18)}`,
              transform: 'rotate(45deg)',
              background:
                ring === 0
                  ? `linear-gradient(135deg, ${alpha(accent, 0.08)}, ${alpha(accentSoft, 0.04)})`
                  : 'transparent',
            }}
          />
        );
      })}
      {/* Central sun */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: center - 64,
          left: center - 64,
          width: 128,
          height: 128,
          borderRadius: 64,
          background: `radial-gradient(circle at 35% 35%, ${accentSoft} 0%, ${accent} 65%, ${alpha(accent, 0.6)} 100%)`,
          border: `3px solid ${alpha(accentSoft, 0.7)}`,
        }}
      />
      {/* Inner highlight */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: center - 22,
          left: center - 22,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: alpha('#fff8e7', 0.55),
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Buen Vivir — chakana-adjacent stepped cross + horizon.
 * Andean stepped cross silhouette + horizon band. Jade/teal register.
 * ──────────────────────────────────────────────────────────────────── */
export function BuenVivirHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const center = size / 2;
  // Stepped cross built from 9 squares in a plus shape with stepped corners
  const u = 60; // unit cell
  // Pattern (5×5 grid, 1 = filled):
  // 0 0 1 0 0
  // 0 1 1 1 0
  // 1 1 1 1 1
  // 0 1 1 1 0
  // 0 0 1 0 0
  const grid = [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ];
  const totalW = 5 * u;
  const totalH = 5 * u;
  const startX = (size - totalW) / 2;
  const startY = (size - totalH) / 2;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c]) {
        const isCenter = r === 2 && c === 2;
        cells.push(
          <div
            key={`${r}-${c}`}
            style={{
              display: 'flex',
              position: 'absolute',
              top: startY + r * u,
              left: startX + c * u,
              width: u - 3,
              height: u - 3,
              background: isCenter
                ? `linear-gradient(135deg, ${accentSoft}, ${accent})`
                : alpha(accent, 0.35 + (r + c) * 0.04),
              border: `1.5px solid ${alpha(accentSoft, 0.7)}`,
            }}
          />,
        );
      }
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      {/* Horizon line */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 30,
          right: 30,
          top: center,
          height: 2,
          background: alpha(accentSoft, 0.45),
        }}
      />
      {/* Sun above horizon */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 40,
          left: size - 130,
          width: 60,
          height: 60,
          borderRadius: 30,
          background: alpha(accentSoft, 0.30),
          border: `2px solid ${alpha(accentSoft, 0.65)}`,
        }}
      />
      {cells}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Confucian — hexagram column with brushstroke gravitas.
 * Six horizontal bars, alternating broken/whole, framed by vertical
 * brushmark columns. Restrained vermilion ink.
 * ──────────────────────────────────────────────────────────────────── */
export function ConfucianHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const pattern: Array<'solid' | 'broken'> = [
    'solid',
    'broken',
    'solid',
    'solid',
    'broken',
    'solid',
  ];
  const barW = 360;
  const barH = 28;
  const gap = 32;
  const totalH = pattern.length * (barH + gap) - gap;
  const startY = (size - totalH) / 2;
  const startX = (size - barW) / 2;
  const split = 56;

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      {/* Vertical brushmark columns flanking */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: startY - 20,
          left: startX - 50,
          width: 6,
          height: totalH + 40,
          background: `linear-gradient(180deg, ${alpha(accent, 0)} 0%, ${accent} 12%, ${accent} 88%, ${alpha(accent, 0)} 100%)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: startY - 20,
          left: startX + barW + 44,
          width: 6,
          height: totalH + 40,
          background: `linear-gradient(180deg, ${alpha(accent, 0)} 0%, ${accent} 12%, ${accent} 88%, ${alpha(accent, 0)} 100%)`,
        }}
      />
      {/* Imperial seal frame behind bars */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: startY - 36,
          left: startX - 24,
          width: barW + 48,
          height: totalH + 72,
          border: `2px solid ${alpha(accent, 0.55)}`,
          background: alpha(accent, 0.06),
        }}
      />
      {/* Bars */}
      {pattern.map((kind, i) => {
        const y = startY + i * (barH + gap);
        if (kind === 'solid') {
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                position: 'absolute',
                top: y,
                left: startX,
                width: barW,
                height: barH,
                background: `linear-gradient(90deg, ${accent}, ${accentSoft}, ${accent})`,
              }}
            />
          );
        }
        const halfW = (barW - split) / 2;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                top: y,
                left: startX,
                width: halfW,
                height: barH,
                background: `linear-gradient(90deg, ${accent}, ${accentSoft})`,
              }}
            />
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                top: y,
                left: startX + halfW + split,
                width: halfW,
                height: barH,
                background: `linear-gradient(90deg, ${accentSoft}, ${accent})`,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Gotong Royong — interlocking ring cluster with central node.
 * Five-ring mutual-aid composition, depth via opacity layers. Sunset.
 * ──────────────────────────────────────────────────────────────────── */
export function GotongRoyongHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const r = 92;
  const positions = [
    { x: size / 2 - r * 2.4, y: size / 2 - r * 0.5 },
    { x: size / 2 - r * 1.0, y: size / 2 - r * 1.4 },
    { x: size / 2 + r * 1.0 - r * 2, y: size / 2 - r * 0.5 },  // center
    { x: size / 2 + r * 0.0, y: size / 2 + r * 0.4 },
    { x: size / 2 + r * 1.2, y: size / 2 - r * 0.5 },
  ];
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      {/* Soft halo behind cluster */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: size / 2 - 220,
          left: size / 2 - 220,
          width: 440,
          height: 440,
          borderRadius: 220,
          background: `radial-gradient(circle, ${alpha(accent, 0.30)} 0%, transparent 65%)`,
        }}
      />
      {positions.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            position: 'absolute',
            top: p.y,
            left: p.x,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            border: `6px solid ${alpha(accent, 0.9 - i * 0.05)}`,
            background: `radial-gradient(circle at 30% 30%, ${alpha(accentSoft, 0.20)} 0%, ${alpha(accent, 0.08)} 70%)`,
          }}
        />
      ))}
      {/* Central node */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: size / 2 - 18,
          left: size / 2 - 18,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: `radial-gradient(circle at 40% 40%, #fff8e7 0%, ${accentSoft} 60%, ${accent} 100%)`,
          border: `2px solid ${alpha(accentSoft, 0.85)}`,
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Islamic Finance — 8-point star + mandala frame.
 * Two rotated squares form the classic 8-point star, framed by an
 * outer dotted ring and inner geometric petals. Emerald.
 * ──────────────────────────────────────────────────────────────────── */
export function IslamicFinanceHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const center = size / 2;
  const sBig = 440;
  const sMed = 320;
  const offsetBig = (size - sBig) / 2;
  const offsetMed = (size - sMed) / 2;

  // 8 petals around center
  const petals = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 130;
    const px = center + Math.cos(angle) * dist - 18;
    const py = center + Math.sin(angle) * dist - 18;
    petals.push(
      <div
        key={`p-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: py,
          left: px,
          width: 36,
          height: 36,
          borderRadius: 18,
          background: alpha(accentSoft, 0.40),
          border: `2px solid ${alpha(accentSoft, 0.85)}`,
        }}
      />,
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 30,
          left: 30,
          width: size - 60,
          height: size - 60,
          borderRadius: (size - 60) / 2,
          border: `1.5px solid ${alpha(accent, 0.30)}`,
        }}
      />
      {/* 8-point star: two rotated squares */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: offsetBig,
          left: offsetBig,
          width: sBig,
          height: sBig,
          border: `5px solid ${alpha(accent, 0.88)}`,
          background: `linear-gradient(135deg, ${alpha(accent, 0.15)}, ${alpha(accentSoft, 0.06)})`,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: offsetBig,
          left: offsetBig,
          width: sBig,
          height: sBig,
          border: `5px solid ${alpha(accent, 0.88)}`,
          background: `linear-gradient(135deg, ${alpha(accent, 0.15)}, ${alpha(accentSoft, 0.06)})`,
          transform: 'rotate(45deg)',
        }}
      />
      {/* Inner star (smaller, rotated 22.5°) */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: offsetMed,
          left: offsetMed,
          width: sMed,
          height: sMed,
          border: `3px solid ${alpha(accentSoft, 0.75)}`,
          transform: 'rotate(22.5deg)',
        }}
      />
      {/* Center medallion */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          background: `radial-gradient(circle at 35% 35%, ${accentSoft} 0%, ${accent} 70%)`,
          border: `3px solid ${alpha(accentSoft, 0.9)}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          width: 36,
          height: 36,
          borderRadius: 18,
          background: alpha('#fff', 0.6),
        }}
      />
      {petals}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Global Diversification — globe wireframe with region pins.
 * Concentric ellipses suggesting a globe, with longitude/latitude
 * lines and pin markers across the surface.
 * ──────────────────────────────────────────────────────────────────── */
export function GlobalDiversificationHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const center = size / 2;
  const R = 240;
  // Ellipses to suggest 3D globe
  const ellipses: React.ReactNode[] = [];
  const offsets = [0, 15, -15, 30, -30, 45, -45];
  offsets.forEach((deg, i) => {
    ellipses.push(
      <div
        key={`e-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: center - R,
          left: center - R,
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          border: `1px solid ${alpha(accent, 0.15)}`,
          transform: `rotateX(${deg}deg)`,
        }}
      />,
    );
  });
  // Latitude lines (horizontal ovals)
  const latRatios = [0.3, 0.55, 0.75, 0.92];
  latRatios.forEach((ratio, i) => {
    const w = R * 2 * ratio;
    const h = w * 0.25;
    ellipses.push(
      <div
        key={`lat-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: center - h / 2,
          left: center - w / 2,
          width: w,
          height: h,
          borderRadius: '50%',
          border: `1px solid ${alpha(accent, 0.22)}`,
        }}
      />,
    );
    ellipses.push(
      <div
        key={`lat-${i}-mirror`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: center - h / 2 - h * (1 - ratio) * 2,
          left: center - w / 2,
          width: w,
          height: h,
          borderRadius: '50%',
          border: `1px solid ${alpha(accent, 0.18)}`,
        }}
      />,
    );
  });

  // Main circle outline (the globe boundary)
  ellipses.push(
    <div
      key="globe"
      style={{
        display: 'flex',
        position: 'absolute',
        top: center - R,
        left: center - R,
        width: R * 2,
        height: R * 2,
        borderRadius: R,
        border: `3px solid ${alpha(accent, 0.85)}`,
        background: `radial-gradient(circle at 35% 30%, ${alpha(accentSoft, 0.20)} 0%, ${alpha(accent, 0.05)} 70%)`,
      }}
    />,
  );

  // Equator (bold)
  ellipses.push(
    <div
      key="equator"
      style={{
        display: 'flex',
        position: 'absolute',
        top: center - 1,
        left: center - R,
        width: R * 2,
        height: 2,
        background: alpha(accentSoft, 0.7),
      }}
    />,
  );
  // Prime meridian
  ellipses.push(
    <div
      key="meridian"
      style={{
        display: 'flex',
        position: 'absolute',
        top: center - R,
        left: center - 1,
        width: 2,
        height: R * 2,
        background: alpha(accentSoft, 0.7),
      }}
    />,
  );

  // Region pins
  const pins = [
    { angle: -50, dist: 0.6 },
    { angle: 0, dist: 0.75 },
    { angle: 60, dist: 0.55 },
    { angle: 130, dist: 0.7 },
    { angle: 200, dist: 0.5 },
    { angle: 260, dist: 0.7 },
  ];
  pins.forEach((p, i) => {
    const rad = (p.angle * Math.PI) / 180;
    const px = center + Math.cos(rad) * R * p.dist - 9;
    const py = center + Math.sin(rad) * R * p.dist - 9;
    ellipses.push(
      <div
        key={`pin-${i}`}
        style={{
          display: 'flex',
          position: 'absolute',
          top: py,
          left: px,
          width: 18,
          height: 18,
          borderRadius: 9,
          background: alpha(accentSoft, 0.95),
          border: `2px solid ${accent}`,
        }}
      />,
    );
  });

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      {ellipses}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Custom — your-allocation builder with three configurable bands.
 * Three dashed-frame allocation rows with fill bars + slider handles.
 * Violet register evokes user agency.
 * ──────────────────────────────────────────────────────────────────── */
export function CustomHero({ accent, accentSoft, size = DEFAULT }: HeroProps) {
  const slots = [
    { label: 'A', y: 60, w: 480, h: 110, fill: 0.65 },
    { label: 'B', y: 215, w: 480, h: 110, fill: 0.35 },
    { label: 'C', y: 370, w: 480, h: 110, fill: 0.85 },
  ];
  const totalH = 480;
  const startY = (size - totalH) / 2;
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      {slots.map((s, i) => {
        const y = startY + i * 155;
        const left = (size - s.w) / 2;
        return (
          <React.Fragment key={i}>
            {/* Slot frame */}
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                top: y,
                left,
                width: s.w,
                height: s.h,
                border: `2px dashed ${alpha(accent, 0.8)}`,
                borderRadius: 14,
                background: alpha(accent, 0.06),
              }}
            />
            {/* Slot label */}
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                top: y + s.h / 2 - 12,
                left: left - 36,
                width: 24,
                height: 24,
                borderRadius: 12,
                background: alpha(accent, 0.20),
                border: `1.5px solid ${alpha(accentSoft, 0.6)}`,
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: alpha('#fff', 0.85),
                fontWeight: 700,
              }}
            >
              {s.label}
            </div>
            {/* Fill bar */}
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                top: y + 12,
                left: left + 12,
                width: (s.w - 24) * s.fill,
                height: s.h - 24,
                background: `linear-gradient(135deg, ${accent}, ${accentSoft})`,
                borderRadius: 8,
              }}
            />
            {/* Slider handle */}
            <div
              style={{
                display: 'flex',
                position: 'absolute',
                top: y + s.h / 2 - 16,
                left: left + 12 + (s.w - 24) * s.fill - 16,
                width: 32,
                height: 32,
                borderRadius: 16,
                background: '#fff',
                border: `3px solid ${accent}`,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
