type GuidelineSectionProps = {
  guideline: string;
};

export function GuidelineSection({ guideline }: GuidelineSectionProps) {
  return (
    <section className="app-frame app-frame-hover rounded-2xl bg-white/5 p-4 transition-all hover:bg-white/10 sm:p-5 md:p-6">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-white">Guideline</h2>
      <p className="text-base text-neutral-300 leading-relaxed">{guideline}</p>
    </section>
  );
}
