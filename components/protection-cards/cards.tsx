/**
 * The 7 Protection Plan cards.
 *
 * Each is a thin BaseCard + per-archetype hero + per-archetype background
 * pattern. Position marks (01/07, 02/07…) act as a system marker so
 * judges can read each card as "part 1 of a 7-plan family" at a glance.
 *
 * Figma binding: each component maps 1:1 to a Figma component on the
 * `DiversiFi — Protection Plans` file. The mapping is recorded in
 * `code-connect.manifest.json` after the Figma file is built.
 */

import React from 'react';
import { ARCHETYPES, ArchetypeId } from './tokens';
import { BaseCard } from './BaseCard';
import { StoryCard, STORY_SIZE } from './StoryCard';
import {
  AfricapitalismHero,
  BuenVivirHero,
  ConfucianHero,
  CustomHero,
  GlobalDiversificationHero,
  GotongRoyongHero,
  IslamicFinanceHero,
} from './heroes';
import {
  AfricaWeavePattern,
  BuenVivirTerracePattern,
  ConfucianColumnPattern,
  CustomScatterPattern,
  GlobalMeridianPattern,
  GotongDiamondPattern,
  IslamicTessellationPattern,
} from './patterns';
import { CARD_SIZE } from './tokens';

const cardSize = CARD_SIZE;

const HERO_FOR: Record<ArchetypeId, React.ComponentType<{ accent: string; accentSoft: string }>> = {
  africapitalism: AfricapitalismHero,
  buen_vivir: BuenVivirHero,
  confucian: ConfucianHero,
  gotong_royong: GotongRoyongHero,
  islamic_finance: IslamicFinanceHero,
  global_diversification: GlobalDiversificationHero,
  custom: CustomHero,
};

const PATTERN_FOR: Record<ArchetypeId, React.ComponentType<{ cardWidth: number; cardHeight: number; accent: string; accentSoft: string }>> = {
  africapitalism: AfricaWeavePattern,
  buen_vivir: BuenVivirTerracePattern,
  confucian: ConfucianColumnPattern,
  gotong_royong: GotongDiamondPattern,
  islamic_finance: IslamicTessellationPattern,
  global_diversification: GlobalMeridianPattern,
  custom: CustomScatterPattern,
};

const POSITION_MARK: Record<ArchetypeId, string> = {
  africapitalism: '01 / 07',
  buen_vivir: '02 / 07',
  confucian: '03 / 07',
  gotong_royong: '04 / 07',
  islamic_finance: '05 / 07',
  global_diversification: '06 / 07',
  custom: '07 / 07',
};

function makeStoryCard(id: ArchetypeId) {
  return function StoryArchetypeCard(_props: { [k: string]: never } = {}) {
    const a = ARCHETYPES[id];
    const Hero = HERO_FOR[id];
    const Pattern = PATTERN_FOR[id];
    return (
      <StoryCard
        archetype={a}
        pattern={
          <Pattern
            cardWidth={STORY_SIZE.w}
            cardHeight={STORY_SIZE.h}
            accent={a.accent}
            accentSoft={a.accentSoft}
          />
        }
        hero={<Hero accent={a.accent} accentSoft={a.accentSoft} />}
        subMark={POSITION_MARK[id]}      />
    );
  };
}

export const AfricapitalismStory = makeStoryCard('africapitalism');
export const BuenVivirStory = makeStoryCard('buen_vivir');
export const ConfucianStory = makeStoryCard('confucian');
export const GotongRoyongStory = makeStoryCard('gotong_royong');
export const IslamicFinanceStory = makeStoryCard('islamic_finance');
export const GlobalDiversificationStory = makeStoryCard('global_diversification');
export const CustomStory = makeStoryCard('custom');

export const STORY_REGISTRY = {
  africapitalism: AfricapitalismStory,
  buen_vivir: BuenVivirStory,
  confucian: ConfucianStory,
  gotong_royong: GotongRoyongStory,
  islamic_finance: IslamicFinanceStory,
  global_diversification: GlobalDiversificationStory,
  custom: CustomStory,
} as const;

export function AfricapitalismCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.africapitalism;
  return (
    <BaseCard
      archetype={a}
      pattern={<AfricaWeavePattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<AfricapitalismHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="01 / 07"
    />
  );
}

export function BuenVivirCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.buen_vivir;
  return (
    <BaseCard
      archetype={a}
      pattern={<BuenVivirTerracePattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<BuenVivirHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="02 / 07"
    />
  );
}

export function ConfucianCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.confucian;
  return (
    <BaseCard
      archetype={a}
      pattern={<ConfucianColumnPattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<ConfucianHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="03 / 07"
    />
  );
}

export function GotongRoyongCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.gotong_royong;
  return (
    <BaseCard
      archetype={a}
      pattern={<GotongDiamondPattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<GotongRoyongHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="04 / 07"
    />
  );
}

export function IslamicFinanceCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.islamic_finance;
  return (
    <BaseCard
      archetype={a}
      pattern={<IslamicTessellationPattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<IslamicFinanceHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="05 / 07"
    />
  );
}

export function GlobalDiversificationCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.global_diversification;
  return (
    <BaseCard
      archetype={a}
      pattern={<GlobalMeridianPattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<GlobalDiversificationHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="06 / 07"
    />
  );
}

export function CustomCard(_props: { [k: string]: never } = {}) {
  const a = ARCHETYPES.custom;
  return (
    <BaseCard
      archetype={a}
      pattern={<CustomScatterPattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
      hero={<CustomHero accent={a.accent} accentSoft={a.accentSoft} />}
      subMark="07 / 07"
    />
  );
}

export const CARD_REGISTRY = {
  africapitalism: AfricapitalismCard,
  buen_vivir: BuenVivirCard,
  confucian: ConfucianCard,
  gotong_royong: GotongRoyongCard,
  islamic_finance: IslamicFinanceCard,
  global_diversification: GlobalDiversificationCard,
  custom: CustomCard,
} as const;
