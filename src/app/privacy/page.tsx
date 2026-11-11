import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - RENTIT",
  description: "Privacy Policy for the RENTIT app.",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full" style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Page heading */}
      <header className="mb-8">
        <h1 className="text-2xl font-black text-white tracking-tight">
          RENTIT: Privacy Policy
        </h1>
      </header>

      <div className="space-y-8 text-base text-slate-300 leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            1. What we collect
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Name, student email, and mobile number.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              PAN and bank details for partners (sent to our payment provider, not stored by us).
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Order, listing and chat details needed to run the service.
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            2. How we use it
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              To run rentals, print and parcel orders, payments and payouts, support, and safety.
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            3. Who we share it with
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              The other user only where needed for an order (for example the handover code and pickup point), and payment providers for payments and payouts.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We do not sell personal data.
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            4. Phone numbers
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Shown only when the owner chooses to share, and only after the rules in the app are met.
            </li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            5. Print files
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Stored privately, visible only to the customer and the assigned Partner, and deleted 48 hours after the order is completed or cancelled.
            </li>
          </ul>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            6. Photos and evidence
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Handover and return photos are kept and cannot be edited, so they can settle disputes.
            </li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            7. Partner payment details
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Entered by the partner, sent directly to the payment provider.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We keep only the provider's account reference and status.
            </li>
          </ul>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            8. How long we keep data
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              While your account is active, and for a limited time after, as needed for disputes, legal or accounting duties.
            </li>
          </ul>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            9. Your rights
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Ask to see, correct or delete your data.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Some records must be kept for legal reasons.
            </li>
          </ul>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            10. Security
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We use encryption in transit and access controls, but no system is perfect.
            </li>
          </ul>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            11. Children
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              The service is for users who can agree to these terms (see the Terms).
            </li>
          </ul>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            12. Changes
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We will show updated versions in the app.
            </li>
          </ul>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            13. Contact
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Contact us at [support email]. We will reply within [number] days.
            </li>
          </ul>
        </section>

      </div>
    </div>
  );
}
