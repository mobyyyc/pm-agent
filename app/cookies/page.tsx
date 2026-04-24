const LAST_UPDATED = "March 8, 2026";

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-4xl px-3 py-6 text-neutral-200 sm:px-4 sm:py-8 md:px-6 md:py-10">
      <h1 className="text-3xl font-semibold text-white">Cookie Policy</h1>
      <p className="mt-2 text-sm text-neutral-400">Last updated: {LAST_UPDATED}</p>

      <div className="app-frame mt-8 space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
        <section>
          <h2 className="text-xl font-semibold text-white">What Are Cookies</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            Cookies are small text files stored in your browser. They help websites remember your session and preferences.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">How We Use Cookies</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>Essential cookies to keep you signed in and secure your session.</li>
            <li>Functional cookies to remember basic settings and improve usability.</li>
            <li>Operational cookies/logs to maintain reliability and detect abuse.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Types of Cookies</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 leading-7 text-neutral-300">
            <li>Session cookies: temporary and removed when you close your browser.</li>
            <li>Persistent cookies: remain for a defined period unless deleted earlier.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Third-Party Services</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            Some cookies may be set by trusted providers used for authentication or infrastructure. Their use is governed by their
            own privacy and cookie policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Managing Cookies</h2>
          <p className="mt-2 leading-7 text-neutral-300">
            You can control or delete cookies in your browser settings. Blocking essential cookies may prevent login and other core
            features from working correctly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p className="mt-2 leading-7 text-neutral-300">For cookie-related questions, contact: versorrrai@gmail.com</p>
        </section>
      </div>
    </main>
  );
}
