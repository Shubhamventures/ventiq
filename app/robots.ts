import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/database-test"],
    },
    sitemap: "https://useventiq.com/sitemap.xml",
    host: "https://useventiq.com",
  };
}