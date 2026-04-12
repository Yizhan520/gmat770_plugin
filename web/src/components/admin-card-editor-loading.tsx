export function AdminCardEditorLoading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="paper-card rounded-[38px] p-7 sm:p-10">
        <div className="h-5 w-24 animate-pulse rounded-full bg-[rgba(69,45,23,0.08)]" />
        <div className="mt-4 h-14 w-72 animate-pulse rounded-[20px] bg-[rgba(69,45,23,0.08)]" />
        <div className="mt-4 h-5 w-2/3 animate-pulse rounded-full bg-[rgba(69,45,23,0.08)]" />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="paper-card h-[960px] animate-pulse rounded-[32px] p-6 sm:p-8" />
        <div className="space-y-6">
          <div className="paper-card h-64 animate-pulse rounded-[32px] p-6 sm:p-8" />
          <div className="paper-card h-[720px] animate-pulse rounded-[32px] p-6 sm:p-8" />
        </div>
      </section>
    </div>
  );
}
