import type { MetadataRoute } from "next";

const baseUrl = "https://useventiq.com";

const publicRoutes = [
  { route: "", priority: 1, changeFrequency: "weekly" as const },
  {
    route: "/product-overview",
    priority: 0.8,
    changeFrequency: "monthly" as const,
  },
  {
    route: "/security",
    priority: 0.8,
    changeFrequency: "monthly" as const,
  },
  { route: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
  {
    route: "/privacy",
    priority: 0.5,
    changeFrequency: "yearly" as const,
  },
  {
    route: "/terms",
    priority: 0.5,
    changeFrequency: "yearly" as const,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ route, priority, changeFrequency }) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}