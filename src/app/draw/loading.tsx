export default function DrawLoading() {
  return (
    <section aria-busy="true">
      <h1 className="text-2xl font-bold">당첨번호 조회</h1>
      <div
        aria-hidden="true"
        className="bg-muted my-6 h-36 rounded-lg motion-safe:animate-pulse"
      />
      <p role="status" className="text-muted-foreground text-sm">
        당첨번호를 불러오고 있어요.
      </p>
    </section>
  );
}
