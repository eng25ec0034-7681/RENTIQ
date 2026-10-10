"use client";

import { useEffect, useState } from "react";
import { Share, PlusSquare, X } from "lucide-react";

export function IPhoneInstallBanner() {
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user is on iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/.test(ua);
    const isStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;

    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
    }
  }, []);

  if (!isIOS || dismissed) return null;

  return (
    <div className="mx-4 my-3 p-4 bg-slate-900/90 border border-brand-teal/30 rounded-2xl relative text-sm text-slate-200 shadow-lg backdrop-blur">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Close tip"
      >
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="w-10 h-10 rounded-xl bg-brand-teal/20 text-brand-teal flex items-center justify-center shrink-0">
          <Share className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-semibold text-white mb-1">Install RENTIQ on iPhone</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-brand-teal" /> Share button in Safari, then select{" "}
            <span className="font-semibold text-brand-teal inline-flex items-center gap-1">
              <PlusSquare className="w-3.5 h-3.5 inline" /> Add to Home Screen
            </span>{" "}
            for full app experience.
          </p>
        </div>
      </div>
    </div>
  );
}
