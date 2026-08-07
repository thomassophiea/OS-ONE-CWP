"use client";

import { useEffect, useState } from "react";

/**
 * Sends the guest on to the page they were originally trying to open.
 *
 * The URL has already been sanitised server-side; the delay gives the station a
 * moment to settle into its authenticated role before the first real request,
 * and the visible link is the fallback for anyone with JavaScript disabled or a
 * captive-portal assistant that blocks navigation.
 */
export default function ForwardToDestination({ url }: { url: string }) {
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const go = setTimeout(() => {
      window.location.replace(url);
    }, 3000);
    return () => {
      clearInterval(tick);
      clearTimeout(go);
    };
  }, [url]);

  return (
    <p className="mt-6 text-xs text-slate-500">
      Continuing in {seconds}s —{" "}
      <a className="text-blue-600 underline break-all" href={url}>
        go now
      </a>
    </p>
  );
}
