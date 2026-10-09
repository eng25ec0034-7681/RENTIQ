import Link from "next/link";
import { ArrowLeft, Clock, Sparkles } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center text-brand-teal mb-6 shadow-lg shadow-brand-teal/10 animate-pulse">
        <Sparkles className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">{description}</p>

      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-brand-teal font-medium mb-8">
        <Clock className="w-3.5 h-3.5" />
        Coming Soon in Phase 2
      </div>

      <Link
        href="/"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-semibold text-sm transition min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>
    </div>
  );
}
