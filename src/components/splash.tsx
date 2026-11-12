"use client";

import { useEffect, useState } from "react";

/**
 * RENTIT opening splash.
 *
 * Sequence: the R monogram draws itself in white, the wordmark rises letter by
 * letter, an orange rule sweeps underneath, then the whole screen fades to the
 * app. Runs once per browser session and respects reduced-motion.
 */
export default function Splash() {
  const [phase, setPhase] = useState<"hidden" | "show" | "leave">("hidden");

  useEffect(() => {
    if (sessionStorage.getItem("rentit_splash_v2")) return;
    sessionStorage.setItem("rentit_splash_v2", "1");

    setPhase("show");
    const leave = setTimeout(() => setPhase("leave"), 1750);
    const hide = setTimeout(() => setPhase("hidden"), 2250);

    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${phase === "leave" ? "opacity-0" : "opacity-100"
        }`}
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #2E6BFF 0%, #2563EB 42%, #1D4ED8 72%, #1637A8 100%)",
      }}
    >
      <style>{`
        /* monogram draws itself */
        @keyframes rq-draw {
          from { stroke-dashoffset: 160; }
          to   { stroke-dashoffset: 0; }
        }
        /* wordmark letters rise out of a mask */
        @keyframes rq-rise {
          from { transform: translateY(110%); }
          to   { transform: translateY(0); }
        }
        /* orange rule sweeps left to right */
        @keyframes rq-sweep {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        /* soft glow behind the mark */
        @keyframes rq-bloom {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 0.5; }
          100% { opacity: 0.28; transform: scale(1); }
        }
        @keyframes rq-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }

        .rq-s-mark {
          stroke-dasharray: 160;
          stroke-dashoffset: 160;
          animation: rq-draw 0.85s cubic-bezier(0.65, 0, 0.35, 1) 0.1s forwards;
        }
        .rq-s-glow {
          animation: rq-bloom 1.2s ease-out 0.15s both;
        }
        .rq-s-letter {
          display: inline-block;
          animation: rq-rise 0.62s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .rq-s-rule {
          transform-origin: left center;
          animation: rq-sweep 0.55s cubic-bezier(0.65, 0, 0.35, 1) 1.02s both;
        }
        .rq-s-tag {
          animation: rq-fade-up 0.5s ease-out 1.15s both;
        }

        @media (prefers-reduced-motion: reduce) {
          .rq-s-mark, .rq-s-glow, .rq-s-letter, .rq-s-rule, .rq-s-tag {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      <div className="relative flex flex-col items-center px-8">
        {/* bloom */}
        <span className="rq-s-glow absolute top-2 w-40 h-40 rounded-full bg-white blur-2xl" />

        {/* logo tile */}
        <div className="relative w-20 h-20 rounded-3xl bg-white shadow-[0_18px_40px_rgba(9,20,60,0.35)] flex items-center justify-center mb-7">
          <svg width="46" height="46" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <path
              className="rq-s-mark"
              d="M24 68 V20 H46 a13 13 0 0 1 0 26 H26 M48 46 L64 68"
              stroke="#2563EB"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="60" cy="22" r="4" fill="#F97316" opacity="0" />
          </svg>
        </div>

        {/* wordmark */}
        <div className="flex overflow-hidden text-white text-[40px] leading-none font-black tracking-[-0.02em]">
          {"RENTIT".split("").map((letter, i) => (
            <span key={i} className="overflow-hidden">
              <span
                className="rq-s-letter"
                style={{ animationDelay: `${0.32 + i * 0.06}s` }}
              >
                {letter}
              </span>
            </span>
          ))}
        </div>

        {/* orange rule */}
        <div className="mt-3 h-[3px] w-28 rounded-full bg-[#F97316] rq-s-rule" />

        <p className="rq-s-tag mt-4 text-[13px] font-medium text-white/85 tracking-wide">
          Rent smart. Spend less.
        </p>
      </div>
    </div>
  );
}
