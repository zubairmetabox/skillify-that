"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  // Track whether a navigation was started so we don't fire on initial mount
  const navigating = useRef(false);

  // Complete the bar when the pathname changes (navigation landed)
  useEffect(() => {
    if (!navigating.current) return;
    navigating.current = false;
    setWidth(100);
    const done = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
    return () => clearTimeout(done);
  }, [pathname]);

  // Detect link clicks to start the bar
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) return;
      if (href === window.location.pathname) return;
      navigating.current = true;
      setVisible(true);
      setWidth(35);
      setTimeout(() => setWidth(60), 200);
      setTimeout(() => setWidth(80), 700);
    }
    document.addEventListener("click", onLinkClick);
    return () => document.removeEventListener("click", onLinkClick);
  }, []);

  if (!visible && width === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] bg-primary transition-all ease-out"
      style={{ width: `${width}%`, transitionDuration: width === 100 ? "200ms" : "500ms" }}
    />
  );
}
