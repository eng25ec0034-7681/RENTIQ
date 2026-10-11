import ListingForm from "@/components/ListingForm";

export default function GivePage() {
  return (
    <div className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Give Something to Rent</h1>
        <p className="text-sm text-slate-400 mt-1">
          List your items for rent and earn money from fellow students on campus.
        </p>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <ListingForm />
      </div>
    </div>
  );
}
