"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const navigating = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // Complete the bar when the pathname changes (navigation landed)
  useEffect(() => {
    if (!navigating.current) return;
    navigating.current = false;
    clearTimers();
    setWidth(100);
    const done = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 250);
    timers.current.push(done);
    return clearTimers;
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
      clearTimers();
      navigating.current = true;
      setVisible(true);
      setWidth(35);
      const t1 = setTimeout(() => setWidth(60), 200);
      const t2 = setTimeout(() => setWidth(80), 700);
      timers.current.push(t1, t2);
    }
    document.addEventListener("click", onLinkClick);
    return () => document.removeEventListener("click", onLinkClick);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] bg-primary transition-all ease-out"
      style={{ width: `${width}%`, transitionDuration: width === 100 ? "200ms" : "500ms" }}
    />
  );
}
