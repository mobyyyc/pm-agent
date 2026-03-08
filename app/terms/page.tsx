const LAST_UPDATED = "March 8, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-neutral-200">
      <h1 className="text-3xl font-semibold text-white">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: {LAST_UPDATED}</p>

      <div className="mt-8 space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
        <section>
          <h2 className="text-xl font-semibold text-white">Acceptance of Terms</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            By accessing or using VERSOR.AI, you agree to these Terms of Service. If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Accounts and Access</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>You are responsible for maintaining the security of your account.</li>
            <li>You must provide accurate information and keep it up to date.</li>
            <li>Guest mode is provided as-is and may not preserve data between sessions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Acceptable Use</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>Do not misuse, disrupt, or attempt unauthorized access to the service.</li>
            <li>Do not upload content that violates laws or third-party rights.</li>
            <li>Do not use the service to distribute malware, spam, or abusive content.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Your Content</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            You retain ownership of content you provide. You grant us a limited license to process and store that content solely to
            provide and improve the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Service Availability</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            We may update, modify, suspend, or discontinue features at any time. We do not guarantee uninterrupted availability.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Disclaimers and Limitation of Liability</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            The service is provided on an "as is" and "as available" basis to the maximum extent permitted by law. We are not liable
            for indirect, incidental, special, consequential, or punitive damages.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Changes to These Terms</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            We may update these Terms from time to time. Continued use after updates means you accept the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p className="mt-2 leading-7 text-neutral-300">For legal questions, contact: versorrrai@gmail.com</p>
        </section>
      </div>
    </main>
  );
}
