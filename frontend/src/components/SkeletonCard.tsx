export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-surface-muted-dark rounded-xl shadow-md overflow-hidden flex flex-col animate-pulse">
      <div className="bg-gray-200 dark:bg-gray-700 h-56" />
      <div className="p-4 flex flex-col gap-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/5" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mt-1" />
        <div className="mt-3 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}
