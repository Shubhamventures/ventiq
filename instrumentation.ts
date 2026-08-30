import * as Sentry from "@sentry/nextjs";

function scrubEvent(event: Parameters<NonNullable<Parameters<typeof Sentry.init>[0]["beforeSend"]>>[0]) {
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
}

function scrubBreadcrumb(
  breadcrumb: Parameters<NonNullable<Parameters<typeof Sentry.init>[0]["beforeBreadcrumb"]>>[0],
) {
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
}

export async function register() {
  const dsn =
    process.env.SENTRY_DSN ||
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "";

  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: true,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

export const onRequestError = Sentry.captureRequestError;
