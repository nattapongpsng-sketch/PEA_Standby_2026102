"use client";

import { useEffect } from "react";

const LEGACY_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/sweetalert2@11",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "/js/config.js",
  "/js/utils.js",
  "/js/api.js",
  "/js/standby.js",
  "/js/ui.js",
  "/js/app.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.legacySrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load legacy script: ${src}`));
    document.body.appendChild(script);
  });
}

export default function LegacyScripts() {
  useEffect(() => {
    if (window.__peaStandbyLegacyLoaded) return;
    window.__peaStandbyLegacyLoaded = true;

    (async () => {
      for (const src of LEGACY_SCRIPTS) {
        await loadScript(src);
      }

      document.dispatchEvent(new Event("DOMContentLoaded"));
      window.dispatchEvent(new Event("load"));
    })().catch((err) => {
      console.error(err);
    });
  }, []);

  return null;
}
