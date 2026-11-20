import { bindings, defineConfig, defineWorker } from "cf/config";

function requiredPreviewValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Cloudflare preview requires ${name}.`);
  }
  return value;
}

const productionBindings = {
  SUPABASE_SERVICE_ROLE_KEY: bindings.secret(),
  DISCOVERY_CURSOR_SECRET: bindings.secret(),
  DEEPSEEK_API_KEY: bindings.secret(),
  GEMINI_API_KEY: bindings.secret(),
  DASHSCOPE_API_KEY: bindings.secret(),
  GEMINI_MODEL: bindings.text(process.env.GEMINI_MODEL ?? ""),
  GEMINI_IMAGE_MODEL: bindings.text(process.env.GEMINI_IMAGE_MODEL ?? ""),
  DASHSCOPE_BASE_URL: bindings.text(process.env.DASHSCOPE_BASE_URL ?? ""),
  BAILIAN_WORKSPACE_ID: bindings.text(process.env.BAILIAN_WORKSPACE_ID ?? ""),
  SITE_DATA_ORIGIN: bindings.text(process.env.SITE_DATA_ORIGIN ?? ""),
};

export default defineConfig(({ isPreview }) => ({
  worker: defineWorker({
    name: "omnilink",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-18",
    observability: isPreview
      ? {
          enabled: true,
          redactQueryString: true,
          logs: {
            enabled: true,
            invocationLogs: true,
            persist: true,
            headSamplingRate: 1,
          },
          traces: {
            enabled: true,
            persist: true,
            headSamplingRate: 1,
          },
        }
      : undefined,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text(
        isPreview
          ? requiredPreviewValue("OMNILINK_PREVIEW_SUPABASE_URL")
          : process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      ),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: bindings.text(
        isPreview
          ? requiredPreviewValue("OMNILINK_PREVIEW_SUPABASE_ANON_KEY")
          : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      ),
      ...(isPreview ? {} : productionBindings),
    },
  }),
}));
