"use client";

import { useEffect } from "react";

// Adds ‹ › buttons under every sideways-scrolling row on the page (New
// Releases, each genre, Radio, TV…), like the arrows on a music app's
// shelves. One button press glides the row by about a screenful; each
// button dims at its end of the row. It finds the rows itself, so any new
// row added later gets arrows too. Opt a row out with data-no-row-arrows.
export default function RowScrollArrows() {
  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    const done = new WeakSet<HTMLElement>();
    const cleanups: Array<() => void> = [];

    const chevron = (dir: "left" | "right") => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2.2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7");
      svg.appendChild(path);
      return svg;
    };

    const makeButton = (dir: "left" | "right", row: HTMLElement) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", dir === "left" ? "Scroll back" : "Scroll forward");
      b.className =
        "w-9 h-9 rounded-full border border-paper/25 bg-paper/[0.06] text-paper flex items-center justify-center transition hover:bg-paper/15 hover:border-paper/50 disabled:opacity-30 disabled:cursor-default disabled:hover:bg-paper/[0.06]";
      b.appendChild(chevron(dir));
      b.addEventListener("click", () => {
        const step = Math.max(240, row.clientWidth * 0.85);
        row.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
      });
      return b;
    };

    const attach = () => {
      root.querySelectorAll<HTMLElement>("div, ul, section").forEach((row) => {
        if (done.has(row) || row.closest("[data-no-row-arrows]")) return;
        const cs = getComputedStyle(row);
        if (cs.overflowX !== "auto" && cs.overflowX !== "scroll") return;
        // Only real shelves: wide content and tall enough to hold cards
        // (skips thin chip strips).
        if (row.scrollWidth <= row.clientWidth + 8 || row.clientHeight < 120) return;
        done.add(row);

        const bar = document.createElement("div");
        bar.className = "flex items-center justify-end gap-2 mt-3 mb-2";
        const prev = makeButton("left", row);
        const next = makeButton("right", row);
        bar.append(prev, next);
        row.insertAdjacentElement("afterend", bar);
        row.style.scrollBehavior = "smooth";

        const update = () => {
          const overflow = row.scrollWidth > row.clientWidth + 8;
          bar.style.display = overflow ? "flex" : "none";
          prev.disabled = row.scrollLeft <= 2;
          next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
        };
        update();
        row.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        cleanups.push(() => {
          row.removeEventListener("scroll", update);
          window.removeEventListener("resize", update);
          bar.remove();
        });
      });
    };

    attach();
    const timer = window.setTimeout(attach, 800);
    let pending = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(attach, 250);
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(pending);
      observer.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
