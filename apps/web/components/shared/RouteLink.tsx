/**
 * RouteLink — a link that crosses between surfaces through the route seam.
 *
 * Use this instead of `next/link` for a jump that stays inside the app. It
 * behaves exactly like `next/link` (prefetch, middle-click, keyboard) and
 * additionally routes plain left-clicks through `useRouteTransition`, so the
 * arriving page settles in rather than hard-cutting. Modified clicks,
 * downloads and hash jumps keep the browser's own behaviour — the seam is
 * opt-in per click, never a hijack.
 */
import Link from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { useRouteTransition } from "@/lib/route-transition";

export interface RouteLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** In-app path, with query string if needed. External URLs must use `<a>`. */
  href: string;
  prefetch?: boolean;
  scroll?: boolean;
}

export const RouteLink = forwardRef<HTMLAnchorElement, RouteLinkProps>(
  function RouteLink({ href, onClick, prefetch, scroll, ...rest }, ref) {
    const { navigate } = useRouteTransition();

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (href.startsWith("#")) return;

      event.preventDefault();
      navigate(href);
    };

    return (
      <Link ref={ref} href={href} prefetch={prefetch} scroll={scroll} onClick={handleClick} {...rest} />
    );
  },
);
