import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type SourceMonitorRecord = {
  id: string;
  authority: string;
  source_name: string;
  source_url: string;
  source_type: string;
  tracked_keywords: string[];
  excluded_keywords: string[];
  impact_areas: string[];
};

type ExtractedLink = {
  title: string;
  url: string;
  excerpt: string;
};

type ScoredLink = ExtractedLink & {
  matchedKeywords: string[];
  hasExcludedKeyword: boolean;
  relevanceScore: number;
};

const genericTitleBlocklist = [
  "video gallery",
  "photo gallery",
  "media gallery",
  "career",
  "careers",
  "act",
  "regulation",
  "circular",
  "notification",
  "public notice",
  "swit portal",
  "chief vigilance officer (cvo)",
  "independent external monitors (iems)",
  "contact us",
  "about us",
  "sitemap",
  "login",
  "home",
  "faq",
  "faqs",
];

const genericUrlBlocklist = [
  "career",
  "careers",
  "gallery",
  "tender",
  "recruitment",
  "contact",
  "about",
  "sitemap",
  "login",
  "video",
  "media",
];

const strongSignalWords = [
  "aif",
  "alternative investment fund",
  "category i",
  "category ii",
  "category iii",
  "fund management entity",
  "fme",
  "fund management",
  "investment fund",
  "scheme",
  "circular",
  "master circular",
  "notification",
  "guideline",
  "guidelines",
  "regulation",
  "regulations",
  "framework",
  "reporting",
  "compliance",
  "valuation",
  "nav",
  "investor reporting",
  "capital call",
  "distribution",
  "form 64c",
  "form 64d",
  "capital gains",
  "unlisted securities",
  "fema",
  "fcra",
  "foreign contribution",
  "private placement",
  "debenture",
  "beneficial ownership",
];

function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  return [];
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function getAbsoluteUrl(href: string, baseUrl: string) {
  try {
    const url = new URL(href, baseUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function extractLinksFromHtml(html: string, baseUrl: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seenUrls = new Set<string>();

  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const rawTitle = match[2];

    const absoluteUrl = getAbsoluteUrl(href, baseUrl);
    const title = stripHtml(rawTitle);

    if (!absoluteUrl || !title || seenUrls.has(absoluteUrl)) {
      continue;
    }

    seenUrls.add(absoluteUrl);

    links.push({
      title,
      url: absoluteUrl,
      excerpt: title,
    });
  }

  return links.slice(0, 300);
}

function getMatchedKeywords(text: string, keywords: string[]) {
  const lowerText = text.toLowerCase();

  return keywords.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

function hasExcludedKeyword(text: string, excludedKeywords: string[]) {
  const lowerText = text.toLowerCase();

  return excludedKeywords.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

function isGenericTitle(title: string) {
  const lowerTitle = title.toLowerCase().trim();

  return genericTitleBlocklist.some(
    (blockedTitle) => lowerTitle === blockedTitle
  );
}

function hasGenericUrl(url: string) {
  const lowerUrl = url.toLowerCase();

  return genericUrlBlocklist.some((blockedPart) =>
    lowerUrl.includes(blockedPart)
  );
}

function hasStrongSignal(text: string) {
  const lowerText = text.toLowerCase();

  return strongSignalWords.some((signal) => lowerText.includes(signal));
}

function getRelevanceScore(text: string, matchedKeywords: string[]) {
  let score = matchedKeywords.length;

  if (hasStrongSignal(text)) {
    score += 3;
  }

  const lowerText = text.toLowerCase();

  if (lowerText.includes("circular")) score += 2;
  if (lowerText.includes("notification")) score += 2;
  if (lowerText.includes("guideline")) score += 2;
  if (lowerText.includes("regulation")) score += 2;
  if (lowerText.includes("fund")) score += 2;
  if (lowerText.includes("fme")) score += 2;
  if (lowerText.includes("aif")) score += 2;
  if (lowerText.includes("compliance")) score += 1;
  if (lowerText.includes("reporting")) score += 1;

  return score;
}

function isOnlyWeakIfscMatch(matchedKeywords: string[]) {
  const normalizedKeywords = matchedKeywords.map((keyword) =>
    keyword.toLowerCase()
  );

  return (
    normalizedKeywords.length > 0 &&
    normalizedKeywords.every(
      (keyword) => keyword === "ifsc" || keyword === "ifsca"
    )
  );
}

function shouldKeepMatch(link: ScoredLink) {
  const searchableText = `${link.title} ${link.url} ${link.excerpt}`;

  if (isGenericTitle(link.title)) {
    return false;
  }

  if (hasGenericUrl(link.url)) {
    return false;
  }

  if (link.hasExcludedKeyword) {
    return false;
  }

  if (link.matchedKeywords.length === 0) {
    return false;
  }

  if (isOnlyWeakIfscMatch(link.matchedKeywords) && !hasStrongSignal(searchableText)) {
    return false;
  }

  return link.relevanceScore >= 3;
}

function inferImpactArea(matchedKeywords: string[], impactAreas: string[]) {
  if (impactAreas.length === 0) {
    return "Regulatory Update";
  }

  const keywordText = matchedKeywords.join(" ").toLowerCase();

  const matchedImpactArea = impactAreas.find((impactArea) =>
    keywordText.includes(impactArea.toLowerCase().split(" ")[0])
  );

  return matchedImpactArea ?? impactAreas[0];
}

function getFriendlyScanError(errorText: string) {
  const lowerError = errorText.toLowerCase();

  if (lowerError.includes("http 403")) {
    return "Direct scan blocked by source website. Special connector required.";
  }

  if (lowerError.includes("fetch failed")) {
    return "Direct scan failed. Source may block server fetch. Special connector required.";
  }

  if (lowerError.includes("aborted") || lowerError.includes("timeout")) {
    return "Direct scan timed out. Source may require slower or special connector handling.";
  }

  return errorText;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; VENTIQ-Regulatory-Monitor/1.0; +https://useventiq.com)",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let monitorId = "";

  try {
    const body = await request.json();
    monitorId = String(body.monitorId ?? "");

    if (!monitorId) {
      return NextResponse.json(
        { error: "monitorId is required." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    const { data: monitorData, error: monitorError } = await supabase
      .from("regulatory_source_monitors")
      .select(
        "id, authority, source_name, source_url, source_type, tracked_keywords, excluded_keywords, impact_areas"
      )
      .eq("id", monitorId)
      .single();

    if (monitorError || !monitorData) {
      throw new Error(monitorError?.message ?? "Source monitor not found.");
    }

    const monitor: SourceMonitorRecord = {
      id: monitorData.id,
      authority: monitorData.authority,
      source_name: monitorData.source_name,
      source_url: monitorData.source_url,
      source_type: monitorData.source_type,
      tracked_keywords: asStringArray(monitorData.tracked_keywords),
      excluded_keywords: asStringArray(monitorData.excluded_keywords),
      impact_areas: asStringArray(monitorData.impact_areas),
    };

    const html = await fetchHtml(monitor.source_url);
    const extractedLinks = extractLinksFromHtml(html, monitor.source_url);

    const scoredMatches = extractedLinks.map((link) => {
      const searchableText = `${link.title} ${link.url} ${link.excerpt}`;
      const matchedKeywords = getMatchedKeywords(
        searchableText,
        monitor.tracked_keywords
      );

      return {
        ...link,
        matchedKeywords,
        hasExcludedKeyword: hasExcludedKeyword(
          searchableText,
          monitor.excluded_keywords
        ),
        relevanceScore: getRelevanceScore(searchableText, matchedKeywords),
      };
    });

    const relevantMatches = scoredMatches
      .filter((match) => shouldKeepMatch(match))
      .sort((first, second) => second.relevanceScore - first.relevanceScore)
      .slice(0, 20);

    const { data: existingRows } = await supabase
      .from("regulatory_source_matches")
      .select("matched_url")
      .eq("monitor_id", monitor.id);

    const existingUrls = new Set(
      (existingRows ?? [])
        .map((row) => String(row.matched_url ?? ""))
        .filter(Boolean)
    );

    const newMatches = relevantMatches.filter(
      (match) => !existingUrls.has(match.url)
    );

    if (newMatches.length > 0) {
      const rowsToInsert = newMatches.map((match) => ({
        monitor_id: monitor.id,
        authority: monitor.authority,
        matched_title: match.title,
        matched_url: match.url,
        published_date: null,
        matched_keywords: match.matchedKeywords,
        impact_area: inferImpactArea(
          match.matchedKeywords,
          monitor.impact_areas
        ),
        relevance: "needs_review",
        raw_excerpt: match.excerpt,
        ai_summary: null,
        status: "needs_review",
        updated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from("regulatory_source_matches")
        .insert(rowsToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    const checkedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("regulatory_source_monitors")
      .update({
        last_checked_at: checkedAt,
        last_found_count: newMatches.length,
        last_error: null,
        updated_at: checkedAt,
      })
      .eq("id", monitor.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      monitorId: monitor.id,
      sourceName: monitor.source_name,
      scannedLinks: extractedLinks.length,
      totalMatches: relevantMatches.length,
      newMatches: newMatches.length,
    });
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : "Unknown scanning error.";

    const friendlyErrorText = getFriendlyScanError(errorText);

    if (monitorId) {
      try {
        const supabase = createSupabaseServerClient();

        await supabase
          .from("regulatory_source_monitors")
          .update({
            last_checked_at: new Date().toISOString(),
            last_error: friendlyErrorText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", monitorId);
      } catch {
        // Ignore secondary logging error.
      }
    }

    return NextResponse.json({ error: friendlyErrorText }, { status: 500 });
  }
}