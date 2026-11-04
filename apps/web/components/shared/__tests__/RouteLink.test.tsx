/**
 * @vitest-environment jsdom
 *
 * RouteLink must stay a link. A plain click goes through the seam; every
 * other click (new tab, middle-click, download) is left to the browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { forwardRef } from "react";

const { push } = vi.hoisted(() => ({ push: vi.fn(() => Promise.resolve(true)) }));
vi.mock("next/router", () => ({ useRouter: () => ({ push }) }));

// next/link reaches the router through a relative import that the module mock
// above can't intercept; a plain anchor is all this test needs.
vi.mock("next/link", () => ({
  default: forwardRef<HTMLAnchorElement, Record<string, unknown>>(function MockLink(
    { href, children, ...rest },
    ref,
  ) {
    return (
      <a ref={ref} href={href as string} {...rest}>
        {children as React.ReactNode}
      </a>
    );
  }),
}));

import { RouteLink } from "../RouteLink";

beforeEach(() => push.mockClear());
afterEach(() => cleanup());

describe("RouteLink", () => {
  it("navigates a plain click through the route seam", () => {
    render(<RouteLink href="/currency/NGN">Open</RouteLink>);

    fireEvent.click(screen.getByRole("link", { name: "Open" }));

    expect(push).toHaveBeenCalledWith("/currency/NGN");
  });

  it("leaves modified clicks to the browser", () => {
    render(<RouteLink href="/currency/NGN">Open</RouteLink>);
    const link = screen.getByRole("link", { name: "Open" });

    let prevented: boolean | null = null;
    const spy = (event: MouseEvent) => {
      // Record what RouteLink did, then cancel the real navigation so jsdom
      // doesn't try to leave the test document.
      prevented = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener("click", spy);
    fireEvent.click(link, { ctrlKey: true });
    document.removeEventListener("click", spy);

    expect(push).not.toHaveBeenCalled();
    expect(prevented).toBe(false);
  });

  it("runs the caller's onClick first and respects preventDefault", () => {
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <RouteLink href="/currency/NGN" onClick={onClick}>
        Open
      </RouteLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Open" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
