import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
  accent?: boolean;
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6 md:p-8",
} as const;

export function Card({
  children,
  className,
  padding = "md",
  hoverable = false,
  accent = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
        "border border-gray-100/60",
        hoverable && "card-hover",
        accent && "border-t-2 border-t-[#1E40AF]",
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold text-[#333333] leading-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
