import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  children,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs text-gray-500 sm:mt-1.5 sm:text-sm max-w-xl">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0 sm:gap-3">{children}</div>}
    </div>
  );
}
