"use client";
import { useEffect } from "react";
import { html } from "./redesign-content";

export default function CurriculumPage() {
  useEffect(() => {
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("#stayguide .tab"));
    const handlers: Array<[HTMLButtonElement, () => void]> = [];
    tabs.forEach((t) => {
      const fn = () => {
        tabs.forEach((x) => {
          const on = x === t;
          x.classList.toggle("on", on);
          x.setAttribute("aria-selected", String(on));
          const id = x.getAttribute("aria-controls");
          const pane = id ? document.getElementById(id) : null;
          if (pane) pane.hidden = !on;
        });
      };
      t.addEventListener("click", fn);
      handlers.push([t, fn]);
    });
    return () => handlers.forEach(([t, fn]) => t.removeEventListener("click", fn));
  }, []);
  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Poppins:wght@500;600;700&display=swap" />
      <div className="da-redesign" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
