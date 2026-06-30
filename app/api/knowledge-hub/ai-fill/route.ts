import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type AiCircularResult = {
  authority: string;
  circular_number: string;
  title: string;
  saved_as: string;
  topic: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  effective_date: string;
  summary: string;
  what_changed: string;
  affected_workflows: string[];
  impacted_funds: string[];
  recommended_actions: string[];
  checklist: string[];
  related_circulars: string[];
  aliases: string[];
  owner: string;
  internal_note: string;
  linked_sop: string;
};

function extractJsonFromText(text: string) {
  const cleanedText = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON.");
  }

  return JSON.parse(jsonMatch[0]);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeImpact(value: unknown): "HIGH" | "MEDIUM" | "LOW" {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }

  return "MEDIUM";
}

function normalizeAuthority(value: unknown) {
  const authority = asString(value);

  if (
    authority === "SEBI" ||
    authority === "IFSCA" ||
    authority === "Income Tax" ||
    authority === "RBI" ||
    authority === "MCA"
  ) {
    return authority;
  }

  return "SEBI";
}

function normalizeResult(rawResult: Record<string, unknown>): AiCircularResult {
  return {
    authority: normalizeAuthority(rawResult.authority),
    circular_number: asString(rawResult.circular_number),
    title: asString(rawResult.title),
    saved_as: asString(rawResult.saved_as),
    topic: asString(rawResult.topic),
    impact: normalizeImpact(rawResult.impact),
    effective_date: asString(rawResult.effective_date),
    summary: asString(rawResult.summary),
    what_changed: asString(rawResult.what_changed),
    affected_workflows: asStringArray(rawResult.affected_workflows),
    impacted_funds: asStringArray(rawResult.impacted_funds),
    recommended_actions: asStringArray(rawResult.recommended_actions),
    checklist: asStringArray(rawResult.checklist),
    related_circulars: asStringArray(rawResult.related_circulars),
    aliases: asStringArray(rawResult.aliases),
    owner: asString(rawResult.owner),
    internal_note: asString(rawResult.internal_note),
    linked_sop: asString(rawResult.linked_sop),
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing in environment variables." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a PDF file." },
        { status: 400 }
      );
    }

    if (uploadedFile.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    const maxFileSize = 12 * 1024 * 1024;

    if (uploadedFile.size > maxFileSize) {
      return NextResponse.json(
        { error: "PDF is too large. Please upload a file below 12 MB." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const base64Pdf = fileBuffer.toString("base64");

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const model = process.env.OPENAI_MODEL || "gpt-5.5";

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: uploadedFile.name,
              file_data: `data:application/pdf;base64,${base64Pdf}`,
            },
            {
              type: "input_text",
              text: `
You are VENTIQ AI, a regulatory intelligence assistant for private capital funds, AIFs, VC funds, PE funds, debt funds, GIFT City funds, and fund managers.

Read the uploaded regulatory circular / notification / guideline PDF.

Extract structured information for a Knowledge Hub record.

Focus on:
- SEBI Category I, Category II, Category III AIFs
- Venture capital funds
- Private equity funds
- Debt funds
- Angel funds
- GIFT City / IFSC funds
- FCRA impact on funds or foreign contribution structures
- Income tax changes impacting capital gains on unlisted securities
- Pass-through taxation
- Form 64C / 64D
- Investor reporting
- Valuation / NAV
- Capital calls
- Distributions
- Compliance workflows
- RBI / FEMA impact
- MCA impact on private capital transactions

Return ONLY valid JSON. Do not return markdown.

Use this exact JSON structure:

{
  "authority": "SEBI or IFSCA or Income Tax or RBI or MCA",
  "circular_number": "official circular number or reference",
  "title": "official title or clear title",
  "saved_as": "short internal name",
  "topic": "main topic",
  "impact": "HIGH or MEDIUM or LOW",
  "effective_date": "YYYY-MM-DD or empty string",
  "summary": "short business summary",
  "what_changed": "what changed and why it matters",
  "affected_workflows": ["workflow 1", "workflow 2"],
  "impacted_funds": ["fund type 1", "fund type 2"],
  "recommended_actions": ["action 1", "action 2"],
  "checklist": ["checklist item 1", "checklist item 2"],
  "related_circulars": ["related circular 1", "related circular 2"],
  "aliases": ["alias 1", "alias 2"],
  "owner": "suggested internal owner",
  "internal_note": "short internal note",
  "linked_sop": "suggested SOP name"
}

Rules:
- If exact date is not available, keep effective_date as empty string.
- If circular is not directly relevant to private capital, still summarize it but set impact as LOW.
- Do not invent official circular numbers. If not available, use "Not clearly available in PDF".
- Keep arrays practical and useful for fund operations teams.
              `,
            },
          ],
        },
      ],
    });

    const outputText = response.output_text;

    if (!outputText) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 500 }
      );
    }

    const rawResult = extractJsonFromText(outputText);
    const result = normalizeResult(rawResult);

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown AI extraction error.",
      },
      { status: 500 }
    );
  }
}