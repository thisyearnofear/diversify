/**
 * The 8 Protection Plan cards.
 *
 * Each is a thin BaseCard + per-archetype hero + per-archetype background
 * pattern. Position marks (01/08, 02/08…) act as a system marker so
 * judges can read each card as "part 1 of an 8-plan family" at a glance.
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
  PanCaribbeanHero,
} from './heroes';
import {
  AfricaWeavePattern,
  BuenVivirTerracePattern,
  CaribbeanSwellPattern,
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
  pan_caribbean: PanCaribbeanHero,
  confucian: ConfucianHero,
  gotong_royong: GotongRoyongHero,
  islamic_finance: IslamicFinanceHero,
  global_diversification: GlobalDiversificationHero,
  custom: CustomHero,
};

const PATTERN_FOR: Record<ArchetypeId, React.ComponentType<{ cardWidth: number; cardHeight: number; accent: string; accentSoft: string }>> = {
  africapitalism: AfricaWeavePattern,
  buen_vivir: BuenVivirTerracePattern,
  pan_caribbean: CaribbeanSwellPattern,
  confucian: ConfucianColumnPattern,
  gotong_royong: GotongDiamondPattern,
  islamic_finance: IslamicTessellationPattern,
  global_diversification: GlobalMeridianPattern,
  custom: CustomScatterPattern,
};

const POSITION_MARK: Record<ArchetypeId, string> = {
  africapitalism: '01 / 08',
  buen_vivir: '02 / 08',
  pan_caribbean: '03 / 08',
  confucian: '04 / 08',
  gotong_royong: '05 / 08',
  islamic_finance: '06 / 08',
  global_diversification: '07 / 08',
  custom: '08 / 08',
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
export const PanCaribbeanStory = makeStoryCard('pan_caribbean');
export const ConfucianStory = makeStoryCard('confucian');
export const GotongRoyongStory = makeStoryCard('gotong_royong');
export const IslamicFinanceStory = makeStoryCard('islamic_finance');
export const GlobalDiversificationStory = makeStoryCard('global_diversification');
export const CustomStory = makeStoryCard('custom');

export const STORY_REGISTRY = {
  africapitalism: AfricapitalismStory,
  buen_vivir: BuenVivirStory,
  pan_caribbean: PanCaribbeanStory,
  confucian: ConfucianStory,
  gotong_royong: GotongRoyongStory,
  islamic_finance: IslamicFinanceStory,
  global_diversification: GlobalDiversificationStory,
  custom: CustomStory,
} as const;

function makeCard(id: ArchetypeId) {
  return function ArchetypeCard(_props: { [k: string]: never } = {}) {
    const a = ARCHETYPES[id];
    const Hero = HERO_FOR[id];
    const Pattern = PATTERN_FOR[id];
    return (
      <BaseCard
        archetype={a}
        pattern={<Pattern cardWidth={cardSize} cardHeight={cardSize} accent={a.accent} accentSoft={a.accentSoft} />}
        hero={<Hero accent={a.accent} accentSoft={a.accentSoft} />}
        subMark={POSITION_MARK[id]}
      />
    );
  };
}

export const AfricapitalismCard = makeCard('africapitalism');
export const BuenVivirCard = makeCard('buen_vivir');
export const PanCaribbeanCard = makeCard('pan_caribbean');
export const ConfucianCard = makeCard('confucian');
export const GotongRoyongCard = makeCard('gotong_royong');
export const IslamicFinanceCard = makeCard('islamic_finance');
export const GlobalDiversificationCard = makeCard('global_diversification');
export const CustomCard = makeCard('custom');

export const CARD_REGISTRY = {
  africapitalism: AfricapitalismCard,
  buen_vivir: BuenVivirCard,
  pan_caribbean: PanCaribbeanCard,
  confucian: ConfucianCard,
  gotong_royong: GotongRoyongCard,
  islamic_finance: IslamicFinanceCard,
  global_diversification: GlobalDiversificationCard,
  custom: CustomCard,
} as const;
