export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8 md:p-12">
      <div className="w-full max-w-xl text-center space-y-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Child Safety Evaluations
        </h1>
        <p className="text-[var(--muted)] text-lg leading-relaxed">
          Benchmark tooling and scenario review for child-safety evaluations. Sign in from the top
          bar to run pipelines against your gateway credentials and explore results.
        </p>
        <p className="text-xs text-[var(--muted)] pt-2">
          The benchmark runner and related APIs require authentication.
        </p>
      </div>
    </div>
  );
}
