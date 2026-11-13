"use client";

import { useEffect, useState } from "react";

/**
 * RENTIT opening splash — cinematic, 7 seconds.
 *
 * 0.0s  slow dolly-in on the background, vignette settles
 * 0.15s the ribbon slams forward and settles
 * 1.25s RENTIT flips up into place, one letter at a time
 * 2.35s a light bar sweeps across the wordmark
 * 2.50s the gradient rule draws, tagline rises
 * 4.4s  hold, then fade
 *
 * The wordmark is a gradient taken from the logo itself, not flat white.
 */
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "leave" | "hidden">("show");

  useEffect(() => {
    if (sessionStorage.getItem("rentit_splash_v7")) {
      setPhase("hidden");
      return;
    }
    sessionStorage.setItem("rentit_splash_v7", "1");

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
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${phase === "leave" ? "opacity-0" : "opacity-100"
        }`}
    >
      <style>{`
        @keyframes rq7-push { from { transform: scale(1.16); } to { transform: scale(1); } }
        @keyframes rq7-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rq7-slam {
          0%   { transform: scale(0.2) rotate(-12deg); opacity: 0; filter: blur(16px); }
          40%  { opacity: 1; filter: blur(3px); }
          64%  { transform: scale(1.12) rotate(1.5deg); filter: blur(0); }
          80%  { transform: scale(0.97); }
          100% { transform: scale(1) rotate(0); opacity: 1; filter: blur(0); }
        }
        @keyframes rq7-flip {
          0%   { transform: translateY(-34px) rotateX(-92deg) scale(1.35); opacity: 0; filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0); }
          78%  { transform: translateY(3px) rotateX(6deg) scale(0.97); }
          100% { transform: translateY(0) rotateX(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes rq7-shine {
          0%   { transform: translateX(-160%) skewX(-20deg); }
          100% { transform: translateX(320%) skewX(-20deg); }
        }
        @keyframes rq7-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes rq7-tag {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes rq7-glow {
          0% { opacity: 0; transform: scale(0.6); }
          45% { opacity: 0.7; }
          100% { opacity: 0.42; transform: scale(1.15); }
        }
        @keyframes rq7-warm {
          0% { opacity: 0; }
          60% { opacity: 0.5; }
          100% { opacity: 0.28; }
        }

        .rq7-bg {
          background: radial-gradient(130% 100% at 50% 0%, #1B54C4 0%, #0E3588 34%, #08205A 68%, #04102B 100%);
          animation: rq7-push 5.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .rq7-vig {
          background: radial-gradient(70% 55% at 50% 50%, transparent 0%, rgba(2, 8, 26, 0.72) 100%);
          animation: rq7-fade 1.2s ease-out both;
        }
        .rq7-mark {
          animation: rq7-slam 1.4s cubic-bezier(0.16, 1.2, 0.3, 1) 0.15s both;
          filter: drop-shadow(0 24px 55px rgba(2, 10, 35, 0.6));
        }
        .rq7-word {
          background: linear-gradient(96deg, #FFD24A 0%, #FF8A00 26%, #FF4D6D 55%, #B25CF0 78%, #8E7BFF 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 6px 18px rgba(255, 120, 40, 0.25));
        }
        .rq7-letter {
          display: inline-block;
          transform-origin: 50% 100%;
          animation: rq7-flip 0.72s cubic-bezier(0.2, 1.25, 0.35, 1) both;
        }
        .rq7-shine {
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
          filter: blur(6px);
          mix-blend-mode: screen;
          animation: rq7-shine 1.15s cubic-bezier(0.4, 0, 0.2, 1) 2.35s both;
        }
        .rq7-rule {
          background: linear-gradient(90deg, #FFD24A, #FF8A00 45%, #FF4D6D);
          transform-origin: center;
          animation: rq7-rule 0.6s cubic-bezier(0.65, 0, 0.35, 1) 2.5s both;
        }
        .rq7-tag { animation: rq7-tag 0.6s ease-out 2.8s both; }
        .rq7-glow { animation: rq7-glow 1.7s ease-out 0.1s both; }
        .rq7-warm { animation: rq7-warm 1.9s ease-out 0.6s both; }

        @media (prefers-reduced-motion: reduce) {
          .rq7-bg, .rq7-vig, .rq7-mark, .rq7-letter, .rq7-shine, .rq7-rule,
          .rq7-tag, .rq7-glow, .rq7-warm {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <div className="rq7-bg absolute inset-0" />
      <div className="rq7-vig absolute inset-0" />
      <span className="rq7-glow absolute top-[14%] h-[320px] w-[320px] rounded-full bg-[#3A76FF] blur-[95px]" />
      <span className="rq7-warm absolute bottom-[16%] right-5 h-[200px] w-[200px] rounded-full bg-[#F97316] blur-[85px]" />

      <div
        className="relative z-10 flex flex-col items-center px-5"
        style={{ perspective: "900px" }}
      >
        <img
          src="/logo-mark.png"
          alt=""
          className="rq7-mark mb-6 w-[248px] max-w-[74vw]"
        />

        <div className="rq7-word relative flex text-[46px] font-black leading-none tracking-[-0.02em]">
          {"RENTIT".split("").map((ch, i) => (
            <span key={i} className="inline-block overflow-hidden px-[1px]">
              <span
                className="rq7-letter"
                style={{ animationDelay: `${1.25 + i * 0.1}s` }}
              >
                {ch}
              </span>
            </span>
          ))}
          <span className="rq7-shine pointer-events-none absolute inset-y-0 -left-[30%] w-[26%]" />
        </div>

        <div className="rq7-rule mt-[18px] h-[3px] w-[132px] rounded-full" />

        <p className="rq7-tag mt-[15px] text-[11.5px] font-bold uppercase tracking-[0.3em] text-white/70">
          Rent · Share · Return
        </p>
      </div>
    </div>
  );
}
