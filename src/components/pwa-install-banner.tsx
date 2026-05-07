"use client";

import { useState, useEffect, useRef } from "react";
import { Smartphone, X } from "lucide-react";

const DISMISSED_KEY = "pullens-pwa-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already dismissed or already installed as PWA
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const isiOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(isiOS);

    // On non-iOS, listen for the native install prompt
    if (!isiOS) {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPrompt.current = e as BeforeInstallPromptEvent;
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);

      // Also show banner on iOS or if beforeinstallprompt never fires (give it 2s)
      const timeout = setTimeout(() => {
        // If prompt hasn't fired yet, still show banner (user can get instructions)
        setVisible(true);
      }, 2000);

      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        clearTimeout(timeout);
      };
    } else {
      // iOS — show immediately
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function handleAdd() {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const result = await deferredPrompt.current.userChoice;
      if (result.outcome === "accepted") {
        dismiss();
      }
      deferredPrompt.current = null;
    } else if (isIos) {
      setShowIosInstructions(true);
    } else {
      // Fallback: show generic instructions
      setShowIosInstructions(true);
    }
  }

  if (!visible) return null;

  return (
    <div className="bg-[#1E40AF] text-white px-4 py-3 flex items-center gap-3 shadow-md relative z-50">
      <Smartphone className="h-6 w-6 shrink-0" />

      <div className="flex-1 min-w-0">
        {showIosInstructions ? (
          <p className="text-sm leading-snug">
            {isIos
              ? "Tap the Share button (square with arrow), then tap \"Add to Home Screen\"."
              : "Open your browser menu, then tap \"Install app\" or \"Add to Home Screen\"."}
          </p>
        ) : (
          <p className="text-sm leading-snug">
            Add Pullens Admin to your home screen for quick access
          </p>
        )}
      </div>

      {!showIosInstructions && (
        <button
          onClick={handleAdd}
          className="shrink-0 rounded-lg bg-white text-[#1E40AF] font-semibold text-sm px-4 py-2 min-h-[48px] min-w-[48px] hover:bg-blue-50 transition-colors"
        >
          Add
        </button>
      )}

      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg p-2 min-h-[48px] min-w-[48px] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Dismiss install banner"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
