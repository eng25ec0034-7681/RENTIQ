"use client";

import { useEffect, useState } from "react";

export default function Splash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "leave">("hidden");

  useEffect(() => {
    if (sessionStorage.getItem("rentit_splash")) return;
    sessionStorage.setItem("rentit_splash", "1");

    setPhase("show");
    const leave = setTimeout(() => setPhase("leave"), 1500);
    const hide = setTimeout(() => setPhase("hidden"), 2000);

    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === "leave" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(160deg, #2563EB 0%, #1D4ED8 55%, #1637A8 100%)",
      }}
    >
      <style>{`
        @keyframes rq-letter {
          0%   { opacity: 0; transform: translateY(18px) scale(0.8); }
          60%  { opacity: 1; transform: translateY(-4px) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rq-bar {
          0%   { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        @keyframes rq-ring {
          0%   { opacity: 0.55; transform: scale(0.7); }
          100% { opacity: 0; transform: scale(1.9); }
        }
        @keyframes rq-tag {
          0%, 40% { opacity: 0; transform: translateY(8px); }
          100%    { opacity: 1; transform: none; }
        }
        .rq-splash-letter {
          display: inline-block;
          animation: rq-letter 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .rq-splash-bar {
          transform-origin: left center;
          animation: rq-bar 1.35s cubic-bezier(0.65, 0, 0.35, 1) 0.15s both;
        }
        .rq-splash-ring {
          animation: rq-ring 1.6s ease-out 0.1s both;
        }
        .rq-splash-tag {
          animation: rq-tag 1.2s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .rq-splash-letter, .rq-splash-bar, .rq-splash-ring, .rq-splash-tag {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="relative flex flex-col items-center px-8">
        <span className="absolute -top-6 w-28 h-28 rounded-full border-2 border-white/40 rq-splash-ring" />

        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-5 shadow-2xl">
          <span className="text-[#2563EB] text-2xl font-black">R</span>
        </div>

        <div className="flex text-white text-4xl font-black tracking-tight">
          {"RENTIT".split("").map((letter, i) => (
            <span
              key={i}
              className="rq-splash-letter"
              style={{ animationDelay: `${0.12 + i * 0.07}s` }}
            >
              {letter}
            </span>
          ))}
        </div>

        <p className="rq-splash-tag text-white/85 text-sm font-medium mt-2">
          Rent smart. Spend less.
        </p>

        <div className="mt-7 h-1 w-40 rounded-full bg-white/25 overflow-hidden">
          <div className="rq-splash-bar h-full w-full bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}
