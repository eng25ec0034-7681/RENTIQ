"use client";

import { Minus, Plus } from "lucide-react";

export interface StationeryItem {
  code: string;
  name: string;
  price: number;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  WRITING: "Writing",
  PAPER: "Paper",
  FILES: "Files & covers",
  DESK: "Desk tools",
  BINDING: "Binding extras",
  OTHER: "Other",
};

const CATEGORY_ORDER = ["WRITING", "PAPER", "FILES", "DESK", "BINDING", "OTHER"];

export default function StationeryPicker({
  items,
  value,
  onChange,
}: {
  items: StationeryItem[];
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
}) {
  const setQty = (code: string, qty: number) => {
    const next = { ...value };
    if (qty <= 0) delete next[code];
    else next[code] = Math.min(qty, 20);
    onChange(next);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat] ?? cat,
    list: items.filter((i) => i.category === cat),
  })).filter((g) => g.list.length > 0);

  const count = Object.values(value).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-300">
          Stationery <span className="text-slate-500">(optional)</span>
        </p>
        {count > 0 && (
          <span className="text-xs font-semibold text-brand-teal">
            {count} item{count === 1 ? "" : "s"} added
          </span>
        )}
      </div>

      {grouped.map((group) => (
        <div key={group.cat}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {group.label}
          </p>
          <div className="flex flex-col gap-2">
            {group.list.map((item) => {
              const qty = value[item.code] ?? 0;
              return (
                <div
                  key={item.code}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 min-h-[52px] transition rq-stat-row${
                    qty > 0 ? " rq-stat-on" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">₹{item.price} each</p>
                  </div>

                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => setQty(item.code, 1)}
                      aria-label={`Add ${item.name}`}
                      className="shrink-0 min-h-[36px] px-3 rounded-lg text-sm font-semibold rq-press"
                    >
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(item.code, qty - 1)}
                        aria-label={`Remove one ${item.name}`}
                        className="w-9 h-9 rounded-lg flex items-center justify-center rq-press"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-white">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(item.code, qty + 1)}
                        aria-label={`Add one more ${item.name}`}
                        className="w-9 h-9 rounded-lg bg-brand-teal text-slate-950 flex items-center justify-center rq-press"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

