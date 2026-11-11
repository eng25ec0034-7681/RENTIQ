import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Use - RENTIT",
  description: "Rules for using the RENTIT app.",
};

export default function TermsPage() {
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
          RENTIT: Rules for Using the App
        </h1>
      </header>

      <div className="space-y-8 text-base text-slate-300 leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            1. Who can use RENTIT
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              You must be a real person and give your true details.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Keep your password to yourself. You are responsible for anything done from your account.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Only one account per person.
            </li>
          </ul>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            2. What you can do here
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Rent items from other students for a fixed number of days.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Print documents through a student Partner.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Send a parcel from a pickup point to a drop point, carried by a student Partner.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              RENTIT only connects you. The students who rent, print or carry are the ones providing the service.
            </li>
          </ul>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            3. Things you must NOT send, carry or rent
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Alcohol, tobacco, or drugs.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Cash, jewellery, or other valuables.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Weapons, explosives, or dangerous items.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Anything illegal, or anything that belongs to someone else without permission.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Medicines, unless they are in sealed original packaging and you are responsible for them being legal.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Parcels heavier than 5 kg, or anything that does not fit in a backpack.
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            4. Be honest and respectful
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Do not give false information or pretend to be someone else.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Do not threaten, insult or harass anyone.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Do not try to cheat the payments, the fee, or the handover code.
            </li>
          </ul>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            5. Rentals
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Look after the item as if it were yours.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Return it on or before the end date, in the same condition.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Take photos at pickup and at return. Both sides must confirm the condition in the app.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              If you damage or lose the item, you may need to pay for the repair or replacement, unless the photos show the damage was already there.
            </li>
          </ul>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            6. Print and parcel orders
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Upload only documents you are allowed to print or send.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Your file is deleted 48 hours after the order is completed or cancelled.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              The job is finished only when you give your 4-digit code to the Partner and the Partner enters it.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Check your pickup point and drop point carefully before you confirm.
            </li>
          </ul>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            7. Payments and fees
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              All prices are in Indian rupees, and you see the total before you pay.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              The platform fee is shown on every order.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              You pay online through a secure payment provider. RENTIT does not store your card or bank details.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Your order is confirmed only after payment succeeds.
            </li>
          </ul>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            8. Cancelling
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              You can cancel an order for a full refund before a Partner accepts it.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              After a Partner accepts, cancellation may be reviewed. Cancelling often or without a good reason may lead to a suspension.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Partners who cancel without good reason may also be suspended.
            </li>
          </ul>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            9. Problems and reports
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              If something goes wrong, use the Report button in the app.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Photos and evidence from handover and return cannot be edited later, so they can be used to settle disputes.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We may pause an account or order while a report is checked.
            </li>
          </ul>
        </section>

        {/* 10 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            10. Suspension
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We may suspend or close an account if someone breaks these rules, commits fraud, or puts others at risk.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              You can close your own account at any time.
            </li>
          </ul>
        </section>

        {/* 11 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            11. What RENTIT is not responsible for
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We do not guarantee that a rental, print or delivery will happen or be perfect.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              RENTIT is not responsible for losses that come from what users do to each other.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Our total responsibility is limited to the platform fee on the order in question.
            </li>
          </ul>
        </section>

        {/* 12 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            12. Your privacy
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Your personal details are handled as described in our Privacy Policy.
            </li>
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              Your phone number is shared only when the owner has chosen to share it, and only after the rules in the app are met.
            </li>
          </ul>
        </section>

        {/* 13 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            13. Changes
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              We may update these rules. You will see the new version in the app. If you keep using RENTIT after an update, you accept the new rules.
            </li>
          </ul>
        </section>

        {/* 14 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            14. Which law applies
          </h2>
          <ul className="space-y-2 pl-4">
            <li className="relative before:content-['-'] before:absolute before:-left-4 before:text-slate-500">
              These rules follow the laws of India.
            </li>
          </ul>
        </section>

        {/* 15 */}
        <section>
          <h2 className="text-base font-bold text-white mb-3">
            15. Need help?
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
