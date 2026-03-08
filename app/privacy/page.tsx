const LAST_UPDATED = "March 8, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-neutral-200">
      <h1 className="text-3xl font-semibold text-white">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: {LAST_UPDATED}</p>

      <div className="mt-8 space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
        <section>
          <h2 className="text-xl font-semibold text-white">Overview</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            VERSOR.AI helps users plan projects using AI-powered workflows. This Privacy Policy explains what information we collect,
            how we use it, and your choices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Information We Collect</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>Account information such as name, email, and profile data from your login provider.</li>
            <li>Project, task, and team profile content that you create or upload.</li>
            <li>Technical information such as browser type, device, and basic usage logs for reliability and security.</li>
            <li>Session identifiers needed to keep you signed in and protect your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">How We Use Information</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>Provide core product functionality, including project planning and task generation.</li>
            <li>Authenticate users, secure accounts, and prevent abuse.</li>
            <li>Maintain and improve performance, stability, and user experience.</li>
            <li>Comply with legal obligations and enforce our Terms.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Data Sharing</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            We do not sell personal information. We may share data with service providers who help operate the app (for example,
            authentication, hosting, and infrastructure), and when required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Data Retention</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            We keep data for as long as needed to provide the service and comply with legal obligations. Guest-mode project data may
            be temporary and can be lost when a guest session ends.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Your Choices</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>You can sign out at any time.</li>
            <li>You can request deletion of your account-related data by contacting us.</li>
            <li>You can control cookies through your browser settings.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            For privacy questions or requests, contact: versorrrai@gmail.com
          </p>
        </section>
      </div>
    </main>
  );
}
