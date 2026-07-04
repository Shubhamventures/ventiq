import pptxgen from "pptxgenjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DeckChartItem = {
  label: string;
  value: number;
  displayValue: string;
};

type DeckChart = {
  title: string;
  unit: string;
  items: DeckChartItem[];
};

type DeckSection = {
  title: string;
  subtitle: string;
  highlights: string[];
  narrative: string;
  includeHighlights?: boolean;
  includeNarrative?: boolean;
  includeChart?: boolean;
  chart?: DeckChart | null;
};

type DeckRequestBody = {
  deckScopeName: string;
  themeKey?: string;
  layoutKey?: string;
  includeExecutiveSummary?: boolean;
  generatedAt?: string;
  sections: DeckSection[];
};

type DeckTheme = {
  label: string;
  background: string;
  card: string;
  cardAlt: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  border: string;
};

const shapeType = {
  rect: "rect",
  roundRect: "roundRect",
} as const;

const themes: Record<string, DeckTheme> = {
  ventiq_blue: {
    label: "VENTIQ Blue",
    background: "020617",
    card: "0F172A",
    cardAlt: "020817",
    accent: "2563EB",
    accent2: "60A5FA",
    text: "F8FAFC",
    muted: "CBD5E1",
    border: "334155",
  },
  premium_black: {
    label: "Premium Black",
    background: "050505",
    card: "111111",
    cardAlt: "1A1A1A",
    accent: "D4AF37",
    accent2: "FACC15",
    text: "FFFFFF",
    muted: "D1D5DB",
    border: "3F3F46",
  },
  institutional_white: {
    label: "Institutional White",
    background: "F8FAFC",
    card: "FFFFFF",
    cardAlt: "EEF2FF",
    accent: "1D4ED8",
    accent2: "2563EB",
    text: "0F172A",
    muted: "475569",
    border: "CBD5E1",
  },
  emerald_growth: {
    label: "Emerald Growth",
    background: "022C22",
    card: "064E3B",
    cardAlt: "052E2B",
    accent: "10B981",
    accent2: "34D399",
    text: "ECFDF5",
    muted: "BBF7D0",
    border: "047857",
  },
  burgundy_pe: {
    label: "Burgundy PE",
    background: "2A0612",
    card: "450A1A",
    cardAlt: "1F0710",
    accent: "BE123C",
    accent2: "FB7185",
    text: "FFF1F2",
    muted: "FECDD3",
    border: "881337",
  },
};

function safeText(value: unknown, fallback = "-") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function safeHighlights(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function safeChart(value: unknown): DeckChart | null {
  if (!value || typeof value !== "object") return null;

  const chart = value as DeckChart;

  if (!Array.isArray(chart.items) || chart.items.length === 0) return null;

  return {
    title: safeText(chart.title, "Chart"),
    unit: safeText(chart.unit, ""),
    items: chart.items
      .map((item) => ({
        label: safeText(item.label, "Metric"),
        value:
          typeof item.value === "number" && Number.isFinite(item.value)
            ? item.value
            : 0,
        displayValue: safeText(item.displayValue, String(item.value ?? "-")),
      }))
      .filter((item) => item.label)
      .slice(0, 6),
  };
}

function getTheme(themeKey: string | undefined) {
  return themes[themeKey ?? ""] ?? themes.ventiq_blue;
}

function getLayout(layoutKey: string | undefined) {
  if (
    layoutKey === "chart_heavy" ||
    layoutKey === "narrative_heavy" ||
    layoutKey === "metric_dashboard"
  ) {
    return layoutKey;
  }

  return "balanced";
}

function addBackground(slide: pptxgen.Slide, theme: DeckTheme) {
  slide.background = { color: theme.background };

  slide.addShape(shapeType.rect as any, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    fill: { color: theme.background },
    line: { color: theme.background },
  });

  slide.addShape(shapeType.rect as any, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.12,
    fill: { color: theme.accent },
    line: { color: theme.accent },
  });
}

function addFooter(slide: pptxgen.Slide, slideNumber: number, theme: DeckTheme) {
  slide.addText("VENTIQ", {
    x: 0.45,
    y: 7.05,
    w: 1.1,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: theme.accent2,
  });

  slide.addText(`Slide ${slideNumber}`, {
    x: 11.7,
    y: 7.05,
    w: 1.0,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 8,
    color: theme.muted,
    align: "right",
  });
}

function addCard(
  slide: pptxgen.Slide,
  theme: DeckTheme,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor = theme.card
) {
  slide.addShape(shapeType.roundRect as any, {
    x,
    y,
    w,
    h,
    rectRadius: 0.12,
    fill: { color: fillColor, transparency: 5 },
    line: { color: theme.border, transparency: 15 },
  });
}

function addTitleSlide(
  pptx: pptxgen,
  theme: DeckTheme,
  deckScopeName: string,
  sectionCount: number,
  layoutLabel: string
) {
  const slide = pptx.addSlide();

  addBackground(slide, theme);

  slide.addText("VENTIQ", {
    x: 0.7,
    y: 0.55,
    w: 2.2,
    h: 0.35,
    fontFace: "Aptos",
    fontSize: 16,
    bold: true,
    color: theme.accent2,
  });

  slide.addText(`${deckScopeName} Investor Presentation`, {
    x: 0.7,
    y: 1.65,
    w: 11.8,
    h: 0.9,
    fontFace: "Aptos Display",
    fontSize: 34,
    bold: true,
    color: theme.text,
    fit: "shrink",
  });

  slide.addText(
    "Generated from live fund performance, portfolio intelligence, repayment schedules, regulatory alerts and investor communication data.",
    {
      x: 0.75,
      y: 2.85,
      w: 10.8,
      h: 0.8,
      fontFace: "Aptos",
      fontSize: 15,
      color: theme.muted,
      fit: "shrink",
    }
  );

  addCard(slide, theme, 0.75, 4.2, 2.7, 0.72);

  slide.addText(`${sectionCount}`, {
    x: 0.95,
    y: 4.35,
    w: 0.6,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 18,
    bold: true,
    color: theme.text,
  });

  slide.addText("Sections included", {
    x: 1.55,
    y: 4.39,
    w: 1.6,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 11,
    color: theme.muted,
  });

  addCard(slide, theme, 3.65, 4.2, 3.25, 0.72);

  slide.addText(theme.label, {
    x: 3.88,
    y: 4.38,
    w: 2.8,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    color: theme.text,
  });

  addCard(slide, theme, 7.1, 4.2, 3.25, 0.72);

  slide.addText(layoutLabel, {
    x: 7.33,
    y: 4.38,
    w: 2.8,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 12,
    bold: true,
    color: theme.text,
  });

  slide.addText("Prepared for LP / investor discussion", {
    x: 0.75,
    y: 5.65,
    w: 5.5,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 12,
    color: theme.accent2,
    bold: true,
  });

  addFooter(slide, 1, theme);
}

function addHighlights(
  slide: pptxgen.Slide,
  theme: DeckTheme,
  highlights: string[],
  x: number,
  y: number,
  w: number,
  h: number
) {
  addCard(slide, theme, x, y, w, h);

  slide.addText("Key Highlights", {
    x: x + 0.28,
    y: y + 0.24,
    w: 2.6,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    bold: true,
    color: theme.text,
  });

  highlights.slice(0, 6).forEach((highlight, index) => {
    slide.addText(`• ${highlight}`, {
      x: x + 0.32,
      y: y + 0.78 + index * 0.46,
      w: w - 0.6,
      h: 0.28,
      fontFace: "Aptos",
      fontSize: 11.4,
      color: theme.muted,
      fit: "shrink",
    });
  });
}

function addNarrative(
  slide: pptxgen.Slide,
  theme: DeckTheme,
  narrative: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  addCard(slide, theme, x, y, w, h, theme.cardAlt);

  slide.addText("Narrative", {
    x: x + 0.28,
    y: y + 0.24,
    w: 2.3,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    bold: true,
    color: theme.text,
  });

  slide.addText(narrative || "Narrative intentionally excluded.", {
    x: x + 0.28,
    y: y + 0.72,
    w: w - 0.56,
    h: h - 1.0,
    fontFace: "Aptos",
    fontSize: 12,
    color: theme.muted,
    fit: "shrink",
    valign: "top",
  });
}

function addChart(
  slide: pptxgen.Slide,
  theme: DeckTheme,
  chart: DeckChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  addCard(slide, theme, x, y, w, h);

  slide.addText(chart.title, {
    x: x + 0.28,
    y: y + 0.22,
    w: w - 0.56,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    bold: true,
    color: theme.text,
    fit: "shrink",
  });

  slide.addText(chart.unit, {
    x: x + 0.28,
    y: y + 0.55,
    w: w - 0.56,
    h: 0.22,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: theme.accent2,
  });

  const maxValue = Math.max(...chart.items.map((item) => item.value), 1);
  const startY = y + 1.05;
  const rowGap = Math.min(0.5, (h - 1.35) / Math.max(chart.items.length, 1));
  const barX = x + 1.55;
  const barW = w - 2.75;

  chart.items.slice(0, 6).forEach((item, index) => {
    const rowY = startY + index * rowGap;
    const barWidth = Math.max((item.value / maxValue) * barW, 0.08);

    slide.addText(item.label, {
      x: x + 0.28,
      y: rowY - 0.03,
      w: 1.15,
      h: 0.24,
      fontFace: "Aptos",
      fontSize: 9,
      color: theme.muted,
      fit: "shrink",
    });

    slide.addShape(shapeType.roundRect as any, {
      x: barX,
      y: rowY,
      w: barW,
      h: 0.13,
      rectRadius: 0.05,
      fill: { color: theme.cardAlt },
      line: { color: theme.cardAlt },
    });

    slide.addShape(shapeType.roundRect as any, {
      x: barX,
      y: rowY,
      w: barWidth,
      h: 0.13,
      rectRadius: 0.05,
      fill: { color: theme.accent2 },
      line: { color: theme.accent2 },
    });

    slide.addText(item.displayValue, {
      x: barX + barW + 0.12,
      y: rowY - 0.05,
      w: 0.95,
      h: 0.24,
      fontFace: "Aptos",
      fontSize: 9,
      bold: true,
      color: theme.accent2,
      align: "right",
      fit: "shrink",
    });
  });
}

function addMetricDashboard(
  slide: pptxgen.Slide,
  theme: DeckTheme,
  chart: DeckChart,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const items = chart.items.slice(0, 4);
  const cardW = (w - 0.3) / 2;
  const cardH = (h - 0.3) / 2;

  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cardX = x + col * (cardW + 0.3);
    const cardY = y + row * (cardH + 0.3);

    addCard(slide, theme, cardX, cardY, cardW, cardH);

    slide.addText(item.displayValue, {
      x: cardX + 0.22,
      y: cardY + 0.32,
      w: cardW - 0.44,
      h: 0.45,
      fontFace: "Aptos Display",
      fontSize: 24,
      bold: true,
      color: theme.accent2,
      fit: "shrink",
    });

    slide.addText(item.label, {
      x: cardX + 0.22,
      y: cardY + 0.95,
      w: cardW - 0.44,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 12,
      bold: true,
      color: theme.text,
      fit: "shrink",
    });
  });
}
function findHighlight(sections: DeckSection[], title: string, keyword: string) {
  const section = sections.find((item) => item.title === title);
  const highlight = section?.highlights.find((item) =>
    item.toLowerCase().includes(keyword.toLowerCase())
  );

  return highlight ?? "-";
}

function addExecutiveSummarySlide(
  pptx: pptxgen,
  theme: DeckTheme,
  deckScopeName: string,
  sections: DeckSection[],
  slideNumber: number
) {
  const slide = pptx.addSlide();

  addBackground(slide, theme);

  slide.addText("Executive Summary", {
    x: 0.65,
    y: 0.65,
    w: 8.8,
    h: 0.55,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: theme.text,
    fit: "shrink",
  });

  slide.addText(`${deckScopeName} • Investor update overview`, {
    x: 0.65,
    y: 1.25,
    w: 8.8,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 14,
    bold: true,
    color: theme.accent2,
  });

  const kpis = [
    { label: "Gross IRR", value: findHighlight(sections, "Fund Performance", "Gross IRR") },
    { label: "Net IRR", value: findHighlight(sections, "Fund Performance", "Net IRR") },
    { label: "TVPI", value: findHighlight(sections, "Fund Performance", "TVPI") },
    { label: "Current NAV", value: findHighlight(sections, "Fund Overview", "current NAV") },
  ];

  kpis.forEach((kpi, index) => {
    const x = 0.65 + index * 3.05;
    addCard(slide, theme, x, 2.0, 2.75, 1.15);

    slide.addText(kpi.value, {
      x: x + 0.22,
      y: 2.28,
      w: 2.3,
      h: 0.35,
      fontFace: "Aptos Display",
      fontSize: 18,
      bold: true,
      color: theme.accent2,
      fit: "shrink",
    });

    slide.addText(kpi.label, {
      x: x + 0.22,
      y: 2.72,
      w: 2.3,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 10,
      bold: true,
      color: theme.muted,
    });
  });

  addNarrative(
    slide,
    theme,
    "The fund platform continues to demonstrate strong portfolio visibility, disciplined capital deployment, active value creation and institutional-grade investor reporting readiness.",
    0.65,
    3.65,
    5.9,
    2.25
  );

  addHighlights(
    slide,
    theme,
    [
      findHighlight(sections, "Deployment & Dry Powder", "dry powder"),
      findHighlight(sections, "Portfolio Performance", "current fair value"),
      findHighlight(sections, "Distributions", "approved distributions"),
    ].filter((item) => item !== "-"),
    6.85,
    3.65,
    5.8,
    2.25
  );

  addFooter(slide, slideNumber, theme);
}
function addSectionSlide(
  pptx: pptxgen,
  theme: DeckTheme,
  layoutKey: string,
  section: DeckSection,
  slideNumber: number
) {
  const slide = pptx.addSlide();

  addBackground(slide, theme);

  slide.addText(`Slide ${slideNumber}`, {
    x: 0.65,
    y: 0.45,
    w: 1.05,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 9,
    bold: true,
    color: theme.accent2,
    margin: 0.05,
  });

  slide.addText(section.title, {
    x: 0.65,
    y: 0.92,
    w: 8.8,
    h: 0.45,
    fontFace: "Aptos Display",
    fontSize: 25,
    bold: true,
    color: theme.text,
    fit: "shrink",
  });

  slide.addText(section.subtitle, {
    x: 0.65,
    y: 1.42,
    w: 8.5,
    h: 0.35,
    fontFace: "Aptos",
    fontSize: 14,
    bold: true,
    color: theme.accent2,
    fit: "shrink",
  });

  const includeHighlights = section.includeHighlights !== false;
  const includeNarrative = section.includeNarrative !== false;
  const includeChart = section.includeChart !== false && section.chart;

  if (layoutKey === "chart_heavy" && includeChart) {
    addChart(slide, theme, section.chart as DeckChart, 0.65, 2.0, 7.05, 3.95);

    if (includeNarrative) {
      addNarrative(slide, theme, section.narrative, 7.95, 2.0, 4.7, 3.95);
    } else if (includeHighlights) {
      addHighlights(slide, theme, section.highlights, 7.95, 2.0, 4.7, 3.95);
    }
  } else if (layoutKey === "narrative_heavy" && includeNarrative) {
    addNarrative(slide, theme, section.narrative, 0.65, 2.0, 7.05, 3.95);

    if (includeChart) {
      addChart(slide, theme, section.chart as DeckChart, 7.95, 2.0, 4.7, 3.95);
    } else if (includeHighlights) {
      addHighlights(slide, theme, section.highlights, 7.95, 2.0, 4.7, 3.95);
    }
  } else if (layoutKey === "metric_dashboard" && includeChart) {
    addMetricDashboard(
      slide,
      theme,
      section.chart as DeckChart,
      0.65,
      2.0,
      7.05,
      3.95
    );

    if (includeNarrative) {
      addNarrative(slide, theme, section.narrative, 7.95, 2.0, 4.7, 3.95);
    } else if (includeHighlights) {
      addHighlights(slide, theme, section.highlights, 7.95, 2.0, 4.7, 3.95);
    }
  } else if (includeHighlights && includeChart && includeNarrative) {
    addHighlights(slide, theme, section.highlights, 0.65, 2.0, 3.65, 3.95);
    addChart(slide, theme, section.chart as DeckChart, 4.55, 2.0, 3.75, 3.95);
    addNarrative(slide, theme, section.narrative, 8.55, 2.0, 4.1, 3.95);
  } else if (includeHighlights && includeChart && !includeNarrative) {
    addHighlights(slide, theme, section.highlights, 0.65, 2.0, 5.55, 3.95);
    addChart(slide, theme, section.chart as DeckChart, 6.45, 2.0, 6.2, 3.95);
  } else if (includeHighlights && !includeChart && includeNarrative) {
    addHighlights(slide, theme, section.highlights, 0.65, 2.0, 5.65, 3.95);
    addNarrative(slide, theme, section.narrative, 6.55, 2.0, 6.1, 3.95);
  } else if (!includeHighlights && includeChart && includeNarrative) {
    addChart(slide, theme, section.chart as DeckChart, 0.65, 2.0, 5.65, 3.95);
    addNarrative(slide, theme, section.narrative, 6.55, 2.0, 6.1, 3.95);
  } else if (includeChart && !includeHighlights && !includeNarrative) {
    addChart(slide, theme, section.chart as DeckChart, 1.2, 2.0, 10.9, 3.95);
  } else if (includeHighlights && !includeChart && !includeNarrative) {
    addHighlights(slide, theme, section.highlights, 1.2, 2.0, 10.9, 3.95);
  } else if (!includeHighlights && !includeChart && includeNarrative) {
    addNarrative(slide, theme, section.narrative, 1.2, 2.0, 10.9, 3.95);
  } else {
    addNarrative(
      slide,
      theme,
      "This slide has no selected content. Please enable highlights, chart, or narrative in VENTIQ before generating the final investor deck.",
      1.2,
      2.0,
      10.9,
      3.95
    );
  }

  addFooter(slide, slideNumber, theme);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeckRequestBody;

    const deckScopeName = safeText(body.deckScopeName, "All Funds");
    const theme = getTheme(body.themeKey);
    const layoutKey = getLayout(body.layoutKey);
    const includeExecutiveSummary = body.includeExecutiveSummary !== false;

    const layoutLabels: Record<string, string> = {
      balanced: "Balanced Layout",
      chart_heavy: "Chart Heavy Layout",
      narrative_heavy: "Narrative Heavy Layout",
      metric_dashboard: "Metric Dashboard Layout",
    };

    const sections = Array.isArray(body.sections)
      ? body.sections.map((section) => ({
          title: safeText(section.title, "Untitled Section"),
          subtitle: safeText(section.subtitle, "Investor Presentation"),
          highlights: safeHighlights(section.highlights),
          narrative: safeText(section.narrative, ""),
          includeHighlights: section.includeHighlights !== false,
          includeNarrative: section.includeNarrative !== false,
          includeChart: section.includeChart !== false,
          chart: safeChart(section.chart),
        }))
      : [];

    if (sections.length === 0) {
      return NextResponse.json(
        { error: "At least one section is required." },
        { status: 400 }
      );
    }

    const pptx = new pptxgen();

    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "VENTIQ";
    pptx.company = "VENTIQ";
    pptx.subject = `${deckScopeName} Investor Presentation`;
    pptx.title = `${deckScopeName} Investor Presentation`;
    pptx.theme = {
      headFontFace: "Aptos Display",
      bodyFontFace: "Aptos",
    };

    addTitleSlide(
      pptx,
      theme,
      deckScopeName,
      sections.length + (includeExecutiveSummary ? 1 : 0),
      layoutLabels[layoutKey]
    );

    let firstSectionSlideNumber = 2;

if (includeExecutiveSummary) {
  addExecutiveSummarySlide(pptx, theme, deckScopeName, sections, 2);
  firstSectionSlideNumber = 3;
}

sections.forEach((section, index) => {
  addSectionSlide(pptx, theme, layoutKey, section, index + firstSectionSlideNumber);
});

    const output = await pptx.write({ outputType: "arraybuffer" });
    const buffer = Buffer.from(output as ArrayBuffer);

    const fileName = `${deckScopeName
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()}-investor-presentation.pptx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown PPT generation error.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}