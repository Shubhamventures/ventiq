import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Runtime error capture works with only the DSN. Build-time source-map
  // upload can be enabled later with SENTRY_AUTH_TOKEN / org / project.
  silent: true,
});
