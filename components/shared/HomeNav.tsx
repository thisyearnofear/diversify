/**
 * HomeNav — A compact, sticky in-page section nav for the Overview tab.
 *
 * Appears once the user scrolls past the hero. Lets them jump between
 * Protection Mix, Insights, and Settings without having to scroll-scan
 * a 5-screen page. Hidden when there's nothing useful to navigate to.
 *
 * Uses `IntersectionObserver` to highlight the section currently in view.
 * On click, smooth-scrolls to the section and updates the URL hash so the
 * link is shareable / back-button friendly.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import type { HomeSectionDescriptor } from "@/hooks/use-home-sections";

export interface HomeNavProps {
  /** Section ids in display order. The first item is the "hero" anchor. */
  sections: HomeSectionDescriptor[];
  /** Optional id for the "settings / more" row at the bottom of the page. */
  moreOptionsId?: string;
  /** Top offset (px) used for scroll-margin-top, in case you have a fixed header. */
  scrollOffset?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon?: string;
}

export function HomeNav({
  sections,
  moreOptionsId,
  scrollOffset = 80,
}: HomeNavProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Build the nav items: hero (always) + sections + optional more-options
  const items: NavItem[] = useMemoNavItems(sections, moreOptionsId);

  // Show the nav once the user scrolls past a sentinel that sits just
  // below the hero. This avoids pinning the nav to the very top of the
  // page where it would just be visual noise.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      { rootMargin: `-${scrollOffset}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [scrollOffset]);

  // Track which section is currently in view
  useEffect(() => {
    const targetIds = items.map((i) => i.id);
    const elements = targetIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top of the viewport
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: `-${scrollOffset + 20}px 0px -50% 0px`, threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items, scrollOffset]);

  const handleClick = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Update URL hash without triggering a navigation
      if (typeof window !== "undefined") {
        history.replaceState(null, "", `#${id}`);
      }
    },
    [],
  );

  if (items.length < 2) return null;

  return (
    <>
      {/* Sentinel sits just below the hero; observing it tells us when
          the user has scrolled past, which is when the nav should appear. */}
      <div ref={sentinelRef} aria-hidden className="h-0" />

      <nav
        aria-label="In-page navigation"
        className={`
          fixed left-1/2 -translate-x-1/2 z-30
          top-[max(0.5rem,env(safe-area-inset-top))]
          transition-colors duration-200
          ${isVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}
        `}
      >
        <ul className="flex items-center gap-1 px-1.5 py-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full border border-gray-200/80 dark:border-gray-800/80 shadow-lg">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleClick(item.id)}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                    transition-colors
                    ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }
                  `}
                  aria-current={isActive ? "true" : undefined}
                >
                  {item.icon && <span aria-hidden>{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

import { useMemo } from "react";
function useMemoNavItems(
  sections: HomeSectionDescriptor[],
  moreOptionsId?: string,
): NavItem[] {
  return useMemo(() => {
    const items: NavItem[] = [
      { id: "home-hero", label: "Overview", icon: "🏠" },
    ];
    sections.forEach((s) => {
      items.push({ id: s.id, label: s.title, icon: s.icon });
    });
    if (moreOptionsId) {
      items.push({ id: moreOptionsId, label: "Settings", icon: "⚙️" });
    }
    return items;
  }, [sections, moreOptionsId]);
}
