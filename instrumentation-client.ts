import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;

      if (event.request.headers) {
        for (const key of Object.keys(event.request.headers)) {
          const normalized = key.toLowerCase();
          if (
            normalized === "authorization" ||
            normalized === "cookie" ||
            normalized === "set-cookie" ||
            normalized === "x-forwarded-for"
          ) {
            delete event.request.headers[key];
          }
        }
      }
    }

    if (event.user) {
      const id = event.user.id;
      event.user = id ? { id } : undefined;
    }

    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) {
      for (const key of Object.keys(breadcrumb.data)) {
        const normalized = key.toLowerCase();
        if (
          normalized.includes("body") ||
          normalized.includes("payload") ||
          normalized.includes("authorization") ||
          normalized.includes("cookie") ||
          normalized.includes("token")
        ) {
          delete breadcrumb.data[key];
        }
      }
    }

    return breadcrumb;
  },
});

// Required by @sentry/nextjs for client-side navigation tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
