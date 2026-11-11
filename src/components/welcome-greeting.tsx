"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Sticker from "@/components/Sticker";

const PUNCHLINES = [
  "Rent smart. Spend less.",
  "Your campus already has what you need.",
  "Why buy it when a batchmate can lend it?",
  "Print, parcel and rentals — all in one place.",
  "Save the money. Keep the marks.",
];

export default function WelcomeGreeting({ name }: { name: string }) {
  const [visible, setVisible] = useState(false);
  const [line, setLine] = useState(0);

  useEffect(() => {
    // Show once per browser session, not on every navigation home.
    const key = "rentit_welcomed";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setVisible(true);

    const hide = setTimeout(() => setVisible(false), 9000);
    const rotate = setInterval(() => setLine((i) => (i + 1) % PUNCHLINES.length), 3000);

    return () => {
      clearTimeout(hide);
      clearInterval(rotate);
    };
  }, []);

  if (!visible) return null;

  const firstName = name.trim().split(" ")[0] || "there";

  return (
    <div className="rq-fade-up relative mb-5 overflow-hidden rounded-2xl border border-brand-teal/30 bg-slate-900 p-5 pr-12">
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Dismiss welcome"
        className="absolute right-2 top-2 p-2 text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3">
        <Sticker kind="sparkle" motion="wiggle" className="w-12 h-12 shrink-0" />
        <div>
          <p className="text-lg font-bold text-white leading-tight">
            Welcome, {firstName}
          </p>
          <p key={line} className="rq-fade-up text-sm font-medium text-brand-teal mt-1">
            {PUNCHLINES[line]}
          </p>
        </div>
      </div>
    </div>
  );
}

