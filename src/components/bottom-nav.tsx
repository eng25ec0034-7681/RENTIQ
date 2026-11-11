"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, ShoppingBag, KeyRound, User } from "lucide-react";
import { ActionSheet } from "./action-sheet";

export function BottomNav() {
  const pathname = usePathname();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const hideOnPaths = ["/login", "/signup", "/reset-password"];
  if (hideOnPaths.includes(pathname)) {
    return null;
  }

  // Action sits at index 2 so the + lands exactly in the middle of the bar.
  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Orders", href: "/orders", icon: ShoppingBag },
    { label: "Action", href: "#action", icon: Plus, isAction: true },
    { label: "Partner", href: "/partner", icon: KeyRound },
    { label: "Profile", href: "/profile", icon: User },
  ];

  return (
    <>
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-md mx-auto px-4 text-center pb-1">
          <Link
            href="/terms"
            className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Terms
          </Link>
        </div>

        <div className="max-w-md mx-auto px-2 h-16 grid grid-cols-5 place-items-center">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.isAction) {
              return (
                <button
                  key="action-button"
                  onClick={() => setIsSheetOpen(true)}
                  aria-label="Create request or rental"
                  className="justify-self-center w-12 h-12 rounded-full bg-brand-teal text-slate-950 flex items-center justify-center shadow-lg shadow-brand-teal/20 hover:scale-105 transition-transform min-h-[44px] min-w-[44px] -mt-4 border-2 border-slate-950"
                >
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </button>
              );
            }

            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] w-full px-1 transition-colors ${isActive
                  ? "text-brand-teal font-medium"
                  : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                <span className="text-[10px] mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ActionSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
    </>
  );
}
