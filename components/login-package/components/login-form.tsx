import React, { useActionState, useEffect, useState } from "react";
import { loginAction, type AuthState } from "@/app/actions/auth";
import { cn } from "@/components/login-package/lib/utils";
import { Button } from "@/components/login-package/components/ui/button";
import { Input } from "@/components/login-package/components/ui/input";
import Shuffle from "@/components/login-package/components/Shuffle";
import Loader from "@/components/kokonutui/loader";

export interface LoginFormProps extends React.ComponentProps<"div"> {
  onSwitchToSignup: () => void;
  variant?: "dark" | "light";
  hideTitle?: boolean;
  redirectTo?: string;
}

export function LoginForm({
  className,
  onSwitchToSignup,
  variant = "dark",
  hideTitle = false,
  redirectTo,
  ...props
}: LoginFormProps) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, null);
  const [email, setEmail] = useState("");
  const isLight = variant === "light";

  useEffect(() => {
    if (state?.redirectUrl) window.location.assign(state.redirectUrl);
  }, [state]);

  return (
    <div className={cn("w-full flex flex-col gap-5", className)} {...props}>
      {!hideTitle && (
        <div className="flex flex-col gap-1">
          <h2
            className={cn(
              "text-2xl font-bold tracking-tight",
              isLight ? "text-[#0B0C0E]" : "text-white"
            )}
          >
            <Shuffle
              text="登录账户"
              tag="span"
              duration={0.35}
              shuffleTimes={2}
              triggerOnHover={true}
              animationMode="evenodd"
            />
          </h2>
        </div>
      )}

      <form
        action={action}
        className="flex-1 flex flex-col justify-between pt-2"
      >
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
        {state?.error && (
          <div
            role="alert"
            className={cn(
              "rounded-xl border px-3.5 py-2.5 text-xs font-medium mb-1",
              isLight
                ? "bg-black/[0.035] border-black/20 text-[#0B0C0E]"
                : "bg-white/[0.08] border-white/25 text-white"
            )}
          >
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className={cn(
                "text-xs font-medium tracking-wide",
                isLight ? "text-neutral-700" : "text-neutral-300"
              )}
            >
              邮箱
            </label>
            <Input
              id="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              className={cn(
                "h-11 rounded-xl transition-all",
                isLight
                  ? "bg-black/[0.035] border-black/15 text-[#0B0C0E] placeholder:text-neutral-400 focus-visible:ring-[#315BFF] focus-visible:border-[#315BFF]"
                  : "bg-white/[0.06] border-white/15 text-white placeholder:text-neutral-500 focus-visible:ring-[#315BFF] focus-visible:border-[#315BFF]"
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className={cn(
                  "text-xs font-medium tracking-wide",
                  isLight ? "text-neutral-700" : "text-neutral-300"
                )}
              >
                密码
              </label>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className={cn(
                "h-11 rounded-xl transition-all",
                isLight
                  ? "bg-black/[0.035] border-black/15 text-[#0B0C0E] focus-visible:ring-[#315BFF] focus-visible:border-[#315BFF]"
                  : "bg-white/[0.06] border-white/15 text-white focus-visible:ring-[#315BFF] focus-visible:border-[#315BFF]"
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            aria-label={pending ? "正在登录" : undefined}
            className="w-full h-11 rounded-xl bg-[#315BFF] text-white hover:bg-[#2548db] font-semibold text-sm cursor-pointer shadow-md transition-all active:scale-[0.99]"
          >
            {pending ? (
              <Loader
                size="xs"
                className="gap-0 p-0"
                indicatorClassName="text-white"
                aria-hidden="true"
              />
            ) : (
              <Shuffle
                text="登录"
                tag="span"
                duration={0.3}
                shuffleTimes={2}
                triggerOnHover={true}
                animationMode="evenodd"
              />
            )}
          </Button>

          <div
            className={cn(
              "text-center text-xs pt-1",
              isLight ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            还没有账户？{" "}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className={cn(
                "underline underline-offset-4 font-semibold cursor-pointer transition-colors",
                isLight ? "text-[#315BFF] hover:text-[#1d3fca]" : "text-[#5E81FF] hover:text-white"
              )}
            >
              注册
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
