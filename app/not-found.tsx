import Link from "next/link";

export default function NotFound() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="mx-auto flex max-w-xl flex-col items-center px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-neutral-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Page not found</h1>
        <p className="mt-3 text-neutral-400">The page you are looking for does not exist or was moved.</p>
        <Link
          href="/"
          className="mt-8 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-neutral-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
