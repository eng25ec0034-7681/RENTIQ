// src/app/page.tsx - corrected to be a server component
import Link from "next/link";
import { Search, KeyRound, Printer, Truck, PlusCircle, BookOpen, Calculator, Trophy, Cpu, FolderGit2, Calendar, PackageCheck } from "lucide-react";
import { IPhoneInstallBanner } from "@/components/iphone-install-banner";
import ListingCard from "@/components/ListingCard";
import { createServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // Fetch recent active listings
  const supabase = await createServerClient();
  const { data: recentListings } = await supabase
    .from('listings')
    .select('*, listing_photos(storage_path, position)')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(8);

  const primaryActions = [
    { title: "Rent Something", href: "/rent", icon: KeyRound, color: "bg-teal-500/10 text-brand-teal border-teal-500/30" },
    { title: "Print / Xerox", href: "/print", icon: Printer, color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
    { title: "Get Delivery", href: "/delivery", icon: Truck, color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
    { title: "Give Something to Rent", href: "/give", icon: PlusCircle, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  ];

  const categories = [
    { name: "Books", icon: BookOpen },
    { name: "Calculators", icon: Calculator },
    { name: "Sports", icon: Trophy },
    { name: "Electronics", icon: Cpu },
    { name: "Projects", icon: FolderGit2 },
    { name: "Events", icon: Calendar },
    { name: "Essentials", icon: PackageCheck },
  ];

  return (
    <div className="flex-1 flex flex-col px-4 py-6">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-black text-white tracking-tight">RENTIQ</h1>
        <p className="text-sm font-semibold text-brand-teal mt-0.5">Rent Smart. Spend Less.</p>
      </header>

      <IPhoneInstallBanner />

      {/* Search Bar (UI only) */}
      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="What do you need?"
            className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white text-base placeholder-slate-400 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition min-h-[44px] shadow-sm"
          />
        </div>
      </div>

      {/* Recent Listings */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">Recent Listings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentListings?.map((l: any) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Four Primary Buttons Grid */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">Quick Services</h2>
        <div className="grid grid-cols-2 gap-3">
          {primaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-brand-teal/50 hover:bg-slate-800 transition text-center group min-h-[100px] shadow-md"
              >
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-2 group-hover:scale-105 transition-transform ${action.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">{action.title}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Categories Horizontal Scroll Row */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">Explore Categories</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.name} className="flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl bg-slate-900 border border-slate-800 shrink-0 text-center hover:border-slate-700 transition">
                <div className="w-10 h-10 rounded-xl bg-slate-800/80 text-brand-teal flex items-center justify-center mb-1.5">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium text-slate-300">{cat.name}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
