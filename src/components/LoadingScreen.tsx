import { useEffect, useState } from "react";
import logo from "@/assets/electrosoft-logo.png";

/**
 * Electricity-themed boot splash. Auto-dismisses after `durationMs`.
 */
export function LoadingScreen({ durationMs = 1900 }: { durationMs?: number }) {
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const f = setTimeout(() => setFading(true), durationMs - 400);
    const g = setTimeout(() => setGone(true), durationMs);
    return () => { clearTimeout(f); clearTimeout(g); };
  }, [durationMs]);

  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#06080f] transition-opacity duration-400 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(251,146,60,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* lightning ring */}
      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="bolt" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="60%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <circle
            cx="100" cy="100" r="86"
            fill="none" stroke="url(#bolt)" strokeWidth="1.4"
            strokeDasharray="6 10" className="esa-spin"
            style={{ transformOrigin: "100px 100px" }}
          />
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(251,146,60,0.25)" strokeWidth="1" />
        </svg>

        {/* radiating bolts */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <span
            key={deg}
            className="absolute h-20 w-px origin-bottom esa-pulse"
            style={{
              transform: `rotate(${deg}deg) translateY(-72px)`,
              background: "linear-gradient(to top, transparent, #f59e0b, #fde68a)",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}

        <img
          src={logo}
          alt="Electrosoft Automation"
          className="relative z-10 h-20 w-20 object-contain drop-shadow-[0_0_18px_rgba(245,158,11,0.55)] esa-glow invert"
        />
      </div>

      <div className="mt-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.55em] text-amber-400/80">
          Electrosoft Automation
        </div>
        <div className="mt-2 text-lg font-semibold text-slate-100">
          Reactor Linearity Testing System
        </div>

        {/* energy bar */}
        <div className="mx-auto mt-5 h-1 w-56 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-amber-300 via-orange-500 to-rose-500 esa-load" />
        </div>
        <div className="mt-3 font-mono text-[10px] tracking-[0.3em] text-slate-500">
          INITIALIZING · CALIBRATING · ENERGIZING
        </div>
      </div>

      <style>{`
        @keyframes esaSpin { to { transform: rotate(360deg); } }
        .esa-spin { animation: esaSpin 6s linear infinite; }
        @keyframes esaPulse {
          0%, 100% { opacity: 0.1; transform: scaleY(0.6) rotate(var(--r,0deg)) translateY(-72px); }
          50% { opacity: 1; }
        }
        .esa-pulse { animation: esaPulse 1.4s ease-in-out infinite; }
        @keyframes esaGlow {
          0%,100% { filter: drop-shadow(0 0 12px rgba(245,158,11,.55)) invert(1); }
          50%     { filter: drop-shadow(0 0 26px rgba(253,224,71,.9))  invert(1); }
        }
        .esa-glow { animation: esaGlow 1.6s ease-in-out infinite; }
        @keyframes esaLoad {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .esa-load { animation: esaLoad 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
