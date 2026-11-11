// src/app/page.tsx — royal blue home with hero search
import Link from "next/link";
import { Search, Printer, Truck, PlusCircle, KeyRound, BookOpen, Calculator, Trophy, Cpu, FolderGit2, Calendar, PackageCheck } from "lucide-react";
import { IPhoneInstallBanner } from "@/components/iphone-install-banner";
import WelcomeGreeting from "@/components/welcome-greeting";
import { createServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let welcomeName = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle();
    welcomeName = profile?.name ?? user.email?.split("@")[0] ?? "";
  }

  const quickActions = [
    { title: "Print", href: "/print", icon: Printer, tile: "rq-tile-blue" },
    { title: "Parcel", href: "/parcel", icon: Truck, tile: "rq-tile-orange" },
    { title: "List", href: "/give", icon: PlusCircle, tile: "rq-tile-blue" },
    { title: "Partner", href: "/partner", icon: KeyRound, tile: "rq-tile-orange" },
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
    <div className="flex-1 flex flex-col pb-6">
      <section className="rq-hero">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-white text-[#2563EB] text-[11px] font-extrabold flex items-center justify-center">
            R
          </span>
          <span className="text-sm font-extrabold tracking-tight">RENTIT</span>
          <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/20">
            Student
          </span>
        </div>

        <h1 className="text-2xl font-extrabold leading-tight tracking-tight mt-4">
          Find it. Rent it. Save it.
        </h1>
        <p className="rq-hero-sub text-sm mt-1.5">
          Everything students need, all in one place.
        </p>

        <form action="/search" method="get" className="rq-hero-search relative mt-4">
          <Search className="w-5 h-5 absolute left-4 top-3.5" />
          <input
            type="text"
            name="q"
            placeholder="Search products to rent..."
            className="w-full pl-12 pr-4 py-3 text-base min-h-[48px] focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-3 top-3.5 p-1 pointer-events-none"
          >
            <Search className="w-5 h-5 opacity-0" />
          </button>
        </form>
      </section>

      <div className="px-4 -mt-3">
        <IPhoneInstallBanner />
        {user && <WelcomeGreeting name={welcomeName} />}

        <section className="mb-6 mt-4">
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-900 border border-slate-800 min-h-[78px]"
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${action.tile}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-300">{action.title}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Explore categories
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  href={`/search?category=${cat.name.toLowerCase()}`}
                  className="flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl bg-slate-900 border border-slate-800 shrink-0 text-center"
                >
                  <span className="w-10 h-10 rounded-xl bg-brand-teal/15 text-brand-teal flex items-center justify-center mb-1.5">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-medium text-slate-300">{cat.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
