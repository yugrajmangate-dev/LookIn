"use client";

import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "lookin_chunk_error_reload";

export default function ChunkErrorRecovery(): null {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const message = event.error?.message ?? event.message ?? "";
      const isChunkError =
        message.includes("ChunkLoadError") ||
        message.includes("Loading chunk") ||
        message.includes("Failed to fetch dynamically imported module");

      if (!isChunkError) return;

      const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
      if (alreadyReloaded) return;

      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    };

    const clearReloadFlag = () => {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("pageshow", clearReloadFlag);

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("pageshow", clearReloadFlag);
    };
  }, []);

  return null;
}
