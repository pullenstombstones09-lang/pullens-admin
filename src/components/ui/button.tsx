"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  pulse?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1E40AF] text-white hover:bg-[#1E3A8A] active:bg-[#1e3480] shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_6px_rgba(30,64,175,0.25)]",
  secondary:
    "bg-[#1A1A2E] text-white hover:bg-[#2a2a4e] active:bg-[#0e0e1a] shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_6px_rgba(26,26,46,0.2)]",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_6px_rgba(220,38,38,0.2)]",
  ghost:
    "bg-transparent text-[#333333] hover:bg-black/5 active:bg-black/10",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5 min-h-[48px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      pulse = false,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6]",
          "disabled:opacity-50 disabled:pointer-events-none",
          "select-none whitespace-nowrap",
          "min-w-[48px]",
          variantStyles[variant],
          sizeStyles[size],
          pulse && "animate-pulse-blue",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);
