"use client";

import { useEffect, useState } from "react";

const LETTERS = "RENTIT".split("");
const GRADIENT =
  "linear-gradient(96deg, #FFD24A 0%, #FF8A00 26%, #FF4D6D 55%, #B25CF0 78%, #8E7BFF 100%)";

/**
 * RENTIT opening splash — cinematic, 5 seconds.
 *
 * The gradient is applied per letter, not to the whole word. Clipping one
 * gradient to a container breaks the moment the child spans are transformed,
 * which is why the name disappeared on some devices; each letter now carries
 * its own slice of the ramp.
 */
export default function Splash() {
  const [phase, setPhase] = useState<"show" | "leave" | "hidden">("show");

  useEffect(() => {
    if (sessionStorage.getItem("rentit_splash_v8")) {
      setPhase("hidden");
      return;
    }
    sessionStorage.setItem("rentit_splash_v8", "1");

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
        @keyframes rq8-push { from { transform: scale(1.16); } to { transform: scale(1); } }
        @keyframes rq8-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rq8-slam {
          0%   { transform: scale(0.2) rotate(-12deg); opacity: 0; filter: blur(16px); }
          40%  { opacity: 1; filter: blur(3px); }
          64%  { transform: scale(1.12) rotate(1.5deg); filter: blur(0); }
          80%  { transform: scale(0.97); }
          100% { transform: scale(1) rotate(0); opacity: 1; filter: blur(0); }
        }
        @keyframes rq8-flip {
          0%   { transform: translateY(-34px) rotateX(-92deg) scale(1.35); opacity: 0; filter: blur(8px); }
          60%  { opacity: 1; filter: blur(0); }
          78%  { transform: translateY(3px) rotateX(6deg) scale(0.97); }
          100% { transform: translateY(0) rotateX(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes rq8-shine {
          0%   { transform: translateX(-140%); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateX(520%); opacity: 0; }
        }
        @keyframes rq8-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes rq8-tag {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes rq8-glow {
          0% { opacity: 0; transform: scale(0.6); }
          45% { opacity: 0.7; }
          100% { opacity: 0.42; transform: scale(1.15); }
        }
        @keyframes rq8-warm {
          0% { opacity: 0; }
          60% { opacity: 0.5; }
          100% { opacity: 0.28; }
        }

        .rq8-bg {
          background: radial-gradient(130% 100% at 50% 0%, #1B54C4 0%, #0E3588 34%, #08205A 68%, #04102B 100%);
          animation: rq8-push 5.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .rq8-vig {
          background: radial-gradient(70% 55% at 50% 50%, transparent 0%, rgba(2, 8, 26, 0.72) 100%);
          animation: rq8-fade 1.2s ease-out both;
        }
        .rq8-mark {
          animation: rq8-slam 1.4s cubic-bezier(0.16, 1.2, 0.3, 1) 0.15s both;
          filter: drop-shadow(0 24px 55px rgba(2, 10, 35, 0.6));
        }
        .rq8-letter {
          display: inline-block;
          transform-origin: 50% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: rq8-flip 0.72s cubic-bezier(0.2, 1.25, 0.35, 1) both;
        }
        .rq8-shine {
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent);
          filter: blur(7px);
          mix-blend-mode: screen;
          animation: rq8-shine 1.5s cubic-bezier(0.45, 0, 0.35, 1) 2.3s both;
        }
        .rq8-rule {
          background: linear-gradient(90deg, #FFD24A, #FF8A00 45%, #FF4D6D);
          transform-origin: center;
          animation: rq8-rule 0.6s cubic-bezier(0.65, 0, 0.35, 1) 2.5s both;
        }
        .rq8-tag { animation: rq8-tag 0.6s ease-out 2.8s both; }
        .rq8-glow { animation: rq8-glow 1.7s ease-out 0.1s both; }
        .rq8-warm { animation: rq8-warm 1.9s ease-out 0.6s both; }

        @media (prefers-reduced-motion: reduce) {
          .rq8-bg, .rq8-vig, .rq8-mark, .rq8-letter, .rq8-shine, .rq8-rule,
          .rq8-tag, .rq8-glow, .rq8-warm {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      <div className="rq8-bg absolute inset-0" />
      <div className="rq8-vig absolute inset-0" />
      <span className="rq8-glow absolute top-[14%] h-[320px] w-[320px] rounded-full bg-[#3A76FF] blur-[95px]" />
      <span className="rq8-warm absolute bottom-[16%] right-5 h-[200px] w-[200px] rounded-full bg-[#F97316] blur-[85px]" />

      <div
        className="relative z-10 flex flex-col items-center px-5"
        style={{ perspective: "900px" }}
      >
        <img
          src="/logo-mark.png"
          alt=""
          className="rq8-mark mb-6 w-[248px] max-w-[74vw]"
        />

        <div className="relative flex text-[46px] font-black leading-none tracking-[-0.02em] drop-shadow-[0_6px_18px_rgba(255,120,40,0.25)]">
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              className="rq8-letter"
              style={{
                backgroundImage: GRADIENT,
                backgroundSize: `${LETTERS.length * 100}% 100%`,
                backgroundPosition: `${(i / (LETTERS.length - 1)) * 100}% 0`,
                animationDelay: `${1.25 + i * 0.1}s`,
              }}
            >
              {ch}
            </span>
          ))}

          <span className="rq8-shine pointer-events-none absolute left-0 top-[-6%] h-[112%] w-[22%]" />
        </div>

        <div className="rq8-rule mt-[18px] h-[3px] w-[132px] rounded-full" />

        <p className="rq8-tag mt-[15px] text-[11.5px] font-bold uppercase tracking-[0.3em] text-white/70">
          Rent · Share · Return
        </p>
      </div>
    </div>
  );
}
