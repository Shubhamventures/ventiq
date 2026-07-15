import type { MetadataRoute } from "next";

const baseUrl = "https://useventiq.com";

const routes = [
  "",
  "/managing-partner-ai",
  "/finance-head-ai",
  "/compliance-ai",
  "/investment-team-ai",
  "/fundraising-ai",
  "/investor-portal",
  "/capital-call",
  "/distribution-waterfall",
  "/repayment-notice",
  "/portfolio-intelligence",
  "/knowledge-hub",
  "/bank-reconciliation",
  "/document-engine",
  "/activity-engine",
  "/data-room",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
