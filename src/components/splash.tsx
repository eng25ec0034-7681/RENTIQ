"use client";

import { useEffect, useState } from "react";

/**
 * RENTIT opening — title-card style.
 *
 * 0.0s  the background pushes in slowly, vignette settles
 * 0.3s  the R emblem lands with a heavy bounce and a glow ring
 * 1.0s  RENTIT expands into place, tracking tightening from wide to tight
 * 1.9s  a light bar sweeps across the wordmark
 * 2.4s  the orange rule draws and the tagline fades up
 * 4.2s  hold, then fade to the app
 */
export default function Splash() {
  // Starts visible so the very first paint is the splash, never the home page.
  const [phase, setPhase] = useState<"show" | "leave" | "hidden">("show");

  useEffect(() => {
    if (sessionStorage.getItem("rentit_splash_v4")) {
      setPhase("hidden"); // already seen this session - disappear immediately
      return;
    }
    sessionStorage.setItem("rentit_splash_v4", "1");

    const leave = setTimeout(() => setPhase("leave"), 4200);
    const hide = setTimeout(() => setPhase("hidden"), 4750);

    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${phase === "leave" ? "opacity-0" : "opacity-100"
        }`}
    >
      <style>{`
        @keyframes rq4-push {
          from { transform: scale(1.18); }
          to   { transform: scale(1); }
        }
        @keyframes rq4-vignette {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rq4-emblem {
          0%   { opacity: 0; transform: scale(2.4) translateY(14px); filter: blur(10px); }
          55%  { opacity: 1; transform: scale(0.94) translateY(0); filter: blur(0); }
          75%  { transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes rq4-ring {
          0%   { opacity: 0; transform: scale(0.5); }
          30%  { opacity: 0.5; }
          100% { opacity: 0; transform: scale(2.1); }
        }
        @keyframes rq4-expand {
          0%   { opacity: 0; transform: scale(0.82); letter-spacing: 0.55em; filter: blur(6px); }
          60%  { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); letter-spacing: 0.12em; filter: blur(0); }
        }
        @keyframes rq4-shine {
          0%   { transform: translateX(-140%) skewX(-18deg); }
          100% { transform: translateX(240%) skewX(-18deg); }
        }
        @keyframes rq4-rule {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes rq4-tag {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes rq4-breathe {
          0%, 100% { opacity: 0.9; }
          50%      { opacity: 1; }
        }

        .rq4-bg { animation: rq4-push 5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .rq4-vignette { animation: rq4-vignette 1.2s ease-out both; }
        .rq4-emblem { animation: rq4-emblem 1.05s cubic-bezier(0.34, 1.4, 0.64, 1) 0.3s both; }
        .rq4-ring { animation: rq4-ring 1.5s ease-out 0.45s both; }
        .rq4-word {
          animation: rq4-expand 1.15s cubic-bezier(0.16, 1, 0.3, 1) 1.0s both,
                     rq4-breathe 3s ease-in-out 2.2s infinite;
        }
        .rq4-shine { animation: rq4-shine 1.05s cubic-bezier(0.4, 0, 0.2, 1) 1.95s both; }
        .rq4-rule { transform-origin: center; animation: rq4-rule 0.55s cubic-bezier(0.65, 0, 0.35, 1) 2.4s both; }
        .rq4-tag { animation: rq4-tag 0.5s ease-out 2.7s both; }

        @media (prefers-reduced-motion: reduce) {
          .rq4-bg, .rq4-vignette, .rq4-emblem, .rq4-ring, .rq4-word, .rq4-shine, .rq4-rule, .rq4-tag {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            letter-spacing: 0.12em !important;
          }
        }
      `}</style>

      {/* background */}
      <div
        className="rq4-bg absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 85% at 50% 8%, #3A76FF 0%, #2563EB 34%, #1B44C4 66%, #0C1F63 100%)",
        }}
      />
      <div className="rq4-vignette absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_50%,transparent_0%,rgba(6,14,45,0.55)_100%)]" />

      <div className="relative z-10 flex flex-col items-center px-6">
        {/* emblem */}
        <div className="relative mb-8 flex h-[92px] w-[92px] items-center justify-center">
          <span className="rq4-ring absolute inset-0 rounded-full border-2 border-white/50" />
          <div className="rq4-emblem flex h-full w-full items-center justify-center rounded-[28px] bg-white shadow-[0_26px_60px_rgba(4,12,40,0.55)]">
            <span className="text-[46px] font-black leading-none text-[#2563EB]">R</span>
          </div>
        </div>

        {/* wordmark with a light bar sweeping across it */}
        <div className="relative overflow-hidden px-2">
          <div
            className="rq4-word text-white font-black leading-none"
            style={{
              fontSize: "46px",
              letterSpacing: "0.12em",
              textShadow: "0 10px 30px rgba(4, 12, 40, 0.45)",
            }}
          >
            RENTIT
          </div>
          <span
            className="rq4-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 100%)",
              filter: "blur(6px)",
              mixBlendMode: "screen",
            }}
          />
        </div>

        {/* orange rule */}
        <div className="rq4-rule mt-4 h-[3px] w-32 rounded-full bg-[#F97316]" />

        <p className="rq4-tag mt-4 text-[12.5px] font-medium tracking-[0.18em] text-white/80 uppercase">
          Rent smart · Spend less
        </p>
      </div>
    </div>
  );
}
