export default function GithubAccountSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-white">Github Account</h2>

      <div className="app-frame-item rounded-xl p-5">
        <p className="text-sm leading-relaxed text-neutral-300">
          Link your Versor account to your Github account to manage repositories for group projects.
        </p>
      </div>

      <button
        type="button"
        className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/90 cursor-pointer"
      >
        Link Github Account
      </button>
    </div>
  );
}
