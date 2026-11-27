import React, { useActionState, useEffect, useState } from "react";
import { resendSignupConfirmationAction, signupAction, type AuthState } from "@/app/actions/auth";
import { cn } from "@/components/login-package/lib/utils";
import { Button } from "@/components/login-package/components/ui/button";
import { Input } from "@/components/login-package/components/ui/input";
import Shuffle from "@/components/login-package/components/Shuffle";

export interface SignupFormProps extends React.ComponentProps<"div"> {
  onSwitchToLogin: () => void;
  variant?: "dark" | "light";
  hideTitle?: boolean;
  redirectTo?: string;
  idPrefix?: string;
}

export function SignupForm({
  className,
  onSwitchToLogin,
  variant = "dark",
  hideTitle = false,
  redirectTo,
  idPrefix = "signup",
  ...props
}: SignupFormProps) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signupAction, null);
  const [resendState, resendAction, resending] = useActionState<AuthState, FormData>(resendSignupConfirmationAction, null);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [name, setName] = useState("");
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
              text="创建账户"
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
        className="flex flex-col gap-4"
        onSubmit={() => { setSubmittedEmail(email.trim()); }}
      >
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
        {(state?.message || state?.error) && (
          <div
            role={state.error ? "alert" : "status"}
            className={cn(
              "rounded-xl border px-3.5 py-2.5 text-xs font-medium",
              state.error
                ? isLight
                  ? "bg-black/[0.035] border-black/20 text-[#0B0C0E]"
                  : "bg-white/[0.08] border-white/25 text-white"
                : isLight
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            )}
          >
            {state.error || state.message}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-name`}
            className={cn(
              "text-xs font-medium tracking-wide",
              isLight ? "text-neutral-700" : "text-neutral-300"
            )}
          >
            用户名
          </label>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            placeholder="你的用户名"
            autoComplete="nickname"
            required
            maxLength={40}
            className={cn(
              "h-11 rounded-xl transition-all",
              isLight
                ? "bg-black/[0.035] border-black/15 text-[#0B0C0E] placeholder:text-neutral-400 focus-visible:ring-[#315BFF] focus-visible:border-[#315BFF]"
                : "bg-white/[0.06] border-white/15 text-white placeholder:text-neutral-500 focus-visible:ring-white focus-visible:border-white"
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-email`}
            className={cn(
              "text-xs font-medium tracking-wide",
              isLight ? "text-neutral-700" : "text-neutral-300"
            )}
          >
            邮箱
          </label>
          <Input
            id={`${idPrefix}-email`}
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
                : "bg-white/[0.06] border-white/15 text-white placeholder:text-neutral-500 focus-visible:ring-white focus-visible:border-white"
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-password`}
            className={cn(
              "text-xs font-medium tracking-wide",
              isLight ? "text-neutral-700" : "text-neutral-300"
            )}
          >
            密码
          </label>
          <Input
            id={`${idPrefix}-password`}
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={6}
            required
            className={cn(
              "h-11 rounded-xl transition-all",
              isLight
                ? "bg-black/[0.035] border-black/15 text-[#0B0C0E] focus-visible:ring-[#315BFF] focus-visible:border-[#315BFF]"
                : "bg-white/[0.06] border-white/15 text-white focus-visible:ring-white focus-visible:border-white"
            )}
          />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button
            type="submit"
            disabled={pending}
            className="w-full h-11 rounded-xl bg-[#008F83] text-white hover:bg-[#007F75] font-semibold text-sm cursor-pointer transition-all active:scale-[0.99]"
          >
            <Shuffle
              text={pending ? "请稍候" : "注册"}
              tag="span"
              duration={0.3}
              shuffleTimes={2}
              triggerOnHover={true}
              animationMode="evenodd"
            />
          </Button>

          <div
            className={cn(
              "text-center text-xs pt-1",
              isLight ? "text-neutral-500" : "text-neutral-400"
            )}
          >
            已有账户？{" "}
            <button
              type="button"
              data-liquid-skip="true"
              onClick={onSwitchToLogin}
              className={cn(
                "underline underline-offset-4 font-semibold cursor-pointer transition-colors",
                isLight ? "text-[#315BFF] hover:text-[#1d3fca]" : "text-[#5E81FF] hover:text-white"
              )}
            >
              立即登录
            </button>
          </div>
        </div>
      </form>

      {state?.canResendConfirmation && (
        <form action={resendAction} className="flex flex-col items-center gap-2 text-center">
          <input type="hidden" name="email" value={submittedEmail} />
          <button
            type="submit"
            data-liquid-skip="true"
            disabled={resending}
            className={cn("min-h-11 whitespace-nowrap text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2", isLight ? "text-neutral-700 focus-visible:outline-[#315BFF]" : "text-neutral-200 focus-visible:outline-white")}
          >
            {resending ? "发送中…" : "重发确认邮件"}
          </button>
          {(resendState?.error || resendState?.message) && (
            <p role={resendState.error ? "alert" : "status"} className={cn("text-xs", isLight ? "text-neutral-700" : "text-neutral-200")}>
              {resendState.error || resendState.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
