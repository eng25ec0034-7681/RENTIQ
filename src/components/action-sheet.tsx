"use client";

import Link from "next/link";
import { X, KeyRound, Printer, Truck, PlusCircle, Package, Heart } from "lucide-react";

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActionSheet({ isOpen, onClose }: ActionSheetProps) {
  if (!isOpen) return null;

  const actions = [
    {
      title: "Rent Something",
      subtitle: "Browse calculators, books, sports & tech",
      href: "/rent",
      icon: KeyRound,
      color: "bg-teal-500/10 text-brand-teal border-teal-500/30",
    },
    {
      title: "Give Something to Rent",
      subtitle: "Earn money by listing your unused items",
      href: "/give",
      icon: PlusCircle,
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    {
      title: "My Listings",
      subtitle: "Manage and track your active rental items",
      href: "/my-listings",
      icon: Package,
      color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    {
      title: "My Favorites",
      subtitle: "View items you saved for later",
      href: "/favorites",
      icon: Heart,
      color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
    {
      title: "Print / Xerox",
      subtitle: "Fast document printing & campus delivery",
      href: "/print",
      icon: Printer,
      color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    {
      title: "Request Delivery",
      subtitle: "Get anything picked up and delivered on campus",
      href: "/delivery",
      icon: Truck,
      color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Content */}
      <div className="relative w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">What would you like to do?</h3>
            <p className="text-xs text-slate-400">Select an action to proceed</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close action sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={onClose}
                className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-brand-teal/50 hover:bg-slate-800/50 transition duration-150 min-h-[64px]"
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${action.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-base">{action.title}</h4>
                  <p className="text-xs text-slate-400">{action.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
