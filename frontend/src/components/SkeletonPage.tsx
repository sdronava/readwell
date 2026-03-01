export function SkeletonPage() {
  return (
    <div className="animate-pulse space-y-4 mt-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-10/12" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-9/12" />
      </div>
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-4" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-10/12" />
      </div>
    </div>
  );
}
