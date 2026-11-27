import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "vermilion" | "cobalt";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer rounded-xl";
    
    const sizeClasses = {
      sm: "px-3.5 py-1.5 text-xs",
      md: "px-5 py-2.5 text-sm",
      lg: "px-7 py-3 text-base font-semibold",
    };

    const variantClasses = {
      primary: "bg-[#C5412B] text-white hover:bg-[#A83220] active:scale-[0.98] shadow-sm shadow-[#C5412B]/20 focus-visible:ring-[#C5412B]",
      vermilion: "bg-[#C5412B] text-white hover:bg-[#A83220] active:scale-[0.98] shadow-sm shadow-[#C5412B]/25 focus-visible:ring-[#C5412B]",
      cobalt: "bg-[#315BFF] text-white hover:bg-[#2348D8] active:scale-[0.98] shadow-sm shadow-[#315BFF]/25 focus-visible:ring-[#315BFF]",
      secondary: "bg-[#FCEDE8] text-[#C5412B] hover:bg-[#F8DDD4] active:scale-[0.98]",
      outline: "border border-neutral-300/80 bg-white/80 text-[#1D1F23] hover:bg-neutral-50 hover:border-neutral-400 active:scale-[0.98]",
      ghost: "text-[#1D1F23] hover:bg-neutral-100/70 hover:text-[#C5412B]",
    };

    return (
      <button
        ref={ref}
        data-liquid-skip="true"
        className={twMerge(clsx(base, sizeClasses[size], variantClasses[variant], className))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
