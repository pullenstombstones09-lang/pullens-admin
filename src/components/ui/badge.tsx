import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

type BadgeColor =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "yellow"
  | "grey";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  children: ReactNode;
}

const colorStyles: Record<BadgeColor, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  purple: "bg-purple-50 text-purple-700 ring-purple-600/20",
  yellow: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  grey: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export function Badge({
  color = "grey",
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-xs font-medium leading-5",
        "ring-1 ring-inset",
        colorStyles[color],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
