"use client";

import { useEffect, useState } from "react";

/**
 * RENTIT opening splash — 5 seconds.
 *
 * 0.0s  background blooms in, the ribbon mark slams to the front (heavy overshoot)
 * 1.3s  RENTIT letters drop in one by one, each with its own weight
 * 2.4s  the orange rule sweeps and the tagline rises
 * 4.4s  hold, then fade to the app
 *
 * The mark is /public/logo-mark.png — the 369 ribbon cut out of the app icon.
 */
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "leave" | "hidden">("show");

  useEffect(() => {
    if (sessionStorage.getItem("rentit_splash_v6")) {
      setPhase("hidden");
      return;
    }
    sessionStorage.setItem("rentit_splash_v6", "1");

    const leave = setTimeout(() => setPhase("leave"), 4400);
    const hide = setTimeout(() => setPhase("hidden"), 5000);

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
      style={{
        background:
          "radial-gradient(130% 100% at 50% 0%, #1447A8 0%, #0E3588 34%, #08205A 68%, #04102B 100%)",
      }}
    >
      <style>{`
        /* the mark slams forward: tiny, blurred, then overshoots and settles */
        @keyframes rq6-slam {
          0%   { transform: scale(0.18) rotate(-14deg); opacity: 0; filter: blur(18px); }
          38%  { opacity: 1; filter: blur(4px); }
          62%  { transform: scale(1.14) rotate(2deg); filter: blur(0); }
          78%  { transform: scale(0.96) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0); }
        }
        /* each letter drops from above and lands hard */
        @keyframes rq6-drop {
          0%   { transform: translateY(-46px) scale(1.7); opacity: 0; filter: blur(10px); }
          55%  { opacity: 1; filter: blur(0); }
          72%  { transform: translateY(4px) scale(0.94); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes rq6-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes rq6-tag {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes rq6-glow {
          0%   { opacity: 0; transform: scale(0.6); }
          45%  { opacity: 0.75; }
          100% { opacity: 0.45; transform: scale(1.15); }
        }
        @keyframes rq6-warm {
          0%   { opacity: 0; }
          60%  { opacity: 0.55; }
          100% { opacity: 0.3; }
        }

        .rq6-mark { animation: rq6-slam 1.35s cubic-bezier(0.16, 1.2, 0.3, 1) 0.15s both; }
        .rq6-letter { display: inline-block; animation: rq6-drop 0.62s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
        .rq6-rule {
          transform-origin: center;
          animation: rq6-rule 0.55s cubic-bezier(0.65, 0, 0.35, 1) 2.45s both;
        }
        .rq6-tag { animation: rq6-tag 0.55s ease-out 2.75s both; }
        .rq6-glow { animation: rq6-glow 1.6s ease-out 0.1s both; }
        .rq6-warm { animation: rq6-warm 1.8s ease-out 0.6s both; }

        @media (prefers-reduced-motion: reduce) {
          .rq6-mark, .rq6-letter, .rq6-rule, .rq6-tag, .rq6-glow, .rq6-warm {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      {/* light behind the mark */}
      <span className="rq6-glow absolute top-[16%] h-[300px] w-[300px] rounded-full bg-[#3A76FF] blur-[90px]" />
      <span className="rq6-warm absolute bottom-[18%] right-6 h-[190px] w-[190px] rounded-full bg-[#F97316] blur-[80px]" />

      <div className="relative z-10 flex flex-col items-center px-6">
        {/* the ribbon */}
        <img
          src="/logo-mark.png"
          alt=""
          className="rq6-mark mb-8 w-[260px] max-w-[72vw] drop-shadow-[0_22px_50px_rgba(2,10,35,0.55)]"
        />

        {/* RENTIT */}
        <div className="flex text-white text-[44px] font-black leading-none tracking-[-0.02em]">
          {"RENTIT".split("").map((ch, i) => (
            <span key={i} className="overflow-hidden px-[1px]">
              <span
                className="rq6-letter"
                style={{ animationDelay: `${1.3 + i * 0.09}s` }}
              >
                {ch}
              </span>
            </span>
          ))}
        </div>

        <div className="rq6-rule mt-4 h-[3px] w-32 rounded-full bg-[#F97316]" />

        <p className="rq6-tag mt-4 text-[12px] font-semibold uppercase tracking-[0.28em] text-white/75">
          Rent · Share · Return
        </p>
      </div>
    </div>
  );
}
