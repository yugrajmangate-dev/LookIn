import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { CheckCircle2, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({
  status,
}: StatusBadgeProps): React.JSX.Element {
  const normalizedStatus = status.toLowerCase();

  const isPresent = normalizedStatus === "present";
  const isAbsent = normalizedStatus === "absent";

  const colorClasses = isPresent
    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
    : isAbsent
      ? "bg-red-50 text-red-700 ring-red-600/20"
      : "bg-gray-50 text-gray-700 ring-gray-600/20";

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset capitalize",
          colorClasses
        )
      )}
    >
      {isPresent && <CheckCircle2 className="h-3 w-3" />}
      {isAbsent && <XCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}
