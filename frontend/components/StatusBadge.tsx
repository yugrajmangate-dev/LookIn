import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({
  status,
}: StatusBadgeProps): React.JSX.Element {
  const normalizedStatus = status.toLowerCase();

  const colorClasses =
    normalizedStatus === "present"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : normalizedStatus === "absent"
        ? "bg-red-50 text-red-700 ring-red-600/20"
        : "bg-gray-50 text-gray-700 ring-gray-600/20";

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
          colorClasses
        )
      )}
    >
      {status}
    </span>
  );
}
