"use client";
import { useEffect } from "react";

// Staff home-screen shortcuts must reopen the staff workspace, not the guest app.
export default function StaffAppManifest() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const previous = link.getAttribute("href");
    link.href = "/staff-manifest.json";
    return () => {
      if (previous) link.setAttribute("href", previous);
    };
  }, []);
  return null;
}
