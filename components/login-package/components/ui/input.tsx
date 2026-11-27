import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-liquid-skip="true"
        className={twMerge(
          clsx(
            "flex h-11 w-full rounded-xl border border-neutral-200 bg-white/90 px-3.5 py-2 text-sm text-[#1D1F23] ring-offset-white placeholder:text-neutral-400 focus-visible:outline-none focus-visible:border-[#C5412B] focus-visible:ring-2 focus-visible:ring-[#C5412B]/20 transition-all disabled:cursor-not-allowed disabled:opacity-50",
            className
          )
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
