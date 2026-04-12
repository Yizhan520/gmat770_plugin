export function CardDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <div className="h-5 w-40 animate-pulse rounded-full bg-[rgba(69,45,23,0.08)]" />
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="paper-card rounded-[38px] p-7 sm:p-10">
          <div className="flex flex-wrap gap-3">
            <div className="h-7 w-20 animate-pulse rounded-full bg-[rgba(166,75,42,0.12)]" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-[rgba(69,45,23,0.08)]" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-[rgba(69,45,23,0.08)]" />
          </div>
          <div className="mt-6 h-14 w-2/3 animate-pulse rounded-[20px] bg-[rgba(69,45,23,0.08)]" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded-full bg-[rgba(69,45,23,0.08)]" />
          <div className="mt-8 h-40 animate-pulse rounded-[24px] bg-[rgba(69,45,23,0.08)]" />
        </div>
        <div className="space-y-6">
          <div className="paper-card h-64 animate-pulse rounded-[28px] p-6" />
          <div className="paper-card h-24 animate-pulse rounded-[28px] p-6" />
        </div>
      </section>
      <section className="paper-card h-80 animate-pulse rounded-[34px] p-6 sm:p-8" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="paper-card h-48 animate-pulse rounded-[28px] p-6" />
        <div className="paper-card h-48 animate-pulse rounded-[28px] p-6" />
        <div className="paper-card h-48 animate-pulse rounded-[28px] p-6" />
        <div className="paper-card h-48 animate-pulse rounded-[28px] p-6" />
      </div>
      <section className="paper-card h-64 animate-pulse rounded-[28px] p-6" />
    </div>
  );
}
