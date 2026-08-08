/**
 * HomeSection — A collapsible section with a stable `id` for in-page nav.
 *
 * Wraps the existing `CollapsibleSection` from `TabComponents` with:
 *   - a stable `id` attribute (used by `HomeNav` for scroll-into-view)
 *   - an optional "teaser" line that shows when collapsed
 *   - aria-controls wiring for accessibility
 *
 * This is the building block for the deep sections on the home page.
 * Each one (Guardian Pulse, Smart Tips, Rewards, Agent) becomes a
 * `HomeSection` so the user can scan headings and only expand what they want.
 */

import React, { forwardRef } from "react";
import { motion } from "framer-motion";
import { CollapsibleSection } from "./TabComponents";

export interface HomeSectionProps {
  /** Stable id used by `HomeNav` for in-page anchors. */
  id: string;
  /** Section title shown on the header. */
  title: string;
  /** Optional emoji icon. */
  icon?: string;
  /** Short teaser shown next to the title when collapsed. Helps the user
   *  decide whether to expand without having to open it first. */
  teaser?: string;
  /** Whether the section is expanded by default. */
  defaultOpen?: boolean;
  /** Optional badge shown in the header (e.g. a count, a "new" chip). */
  badge?: React.ReactNode;
  /** The section body — only rendered when expanded (lazy). */
  children: React.ReactNode;
}

/**
 * Use forwardRef so `HomeNav` can scroll-into-view a section by ref.
 * The outer motion.div wraps the entire section so the section's id
 * corresponds to the visible top of the section (not just the header).
 */
export const HomeSection = forwardRef<HTMLElement, HomeSectionProps>(
  function HomeSection(
    { id, title, icon, teaser, defaultOpen, badge, children },
    ref,
  ) {
    return (
      <section
        ref={ref}
        id={id}
        data-home-section={id}
        aria-labelledby={`${id}-title`}
        className="scroll-mt-20"
      >
        <CollapsibleSection
          title={title}
          icon={icon}
          defaultOpen={defaultOpen}
          badge={badge}
          subtitle={teaser}
        >
          {children}
        </CollapsibleSection>
      </section>
    );
  },
);
