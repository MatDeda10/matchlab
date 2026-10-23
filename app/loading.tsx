export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-8 w-72 max-w-full" />
        <div className="skeleton h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <div className="skeleton h-64 rounded-[20px]" />
        <div className="skeleton h-64 rounded-[20px]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-44 rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}
