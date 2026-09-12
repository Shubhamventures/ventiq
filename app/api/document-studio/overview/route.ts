import { NextRequest, NextResponse } from "next/server";
import { GET as getBatch } from "../batch/route";
import { GET as getPreview } from "../preview/route";
import { GET as getTemplates } from "../templates/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Envelope = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeText(value: string | null, max = 500) {
  return (value || "").trim().slice(0, max);
}

function readRequest(parent: NextRequest, pathname: string) {
  const url = new URL(pathname, parent.url);
  const headers = new Headers(parent.headers);
  headers.delete("content-length");
  return new NextRequest(url, { method: "GET", headers });
}

async function settle(factory: () => Promise<Response>): Promise<Envelope> {
  try {
    const response = await factory();
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: {
        error:
          error instanceof Error
            ? error.message
            : "Document Studio read dependency failed.",
      },
    };
  }
}

export async function GET(request: NextRequest) {
  const fundName = safeText(request.nextUrl.searchParams.get("fund_name"), 240);
  const batchId = safeText(request.nextUrl.searchParams.get("batch_id"), 160);

  if (!fundName) {
    return json({ error: "Fund name is required." }, 400);
  }

  const encodedFund = encodeURIComponent(fundName);
  const batchQuery = new URLSearchParams({ fund_name: fundName });
  if (batchId) batchQuery.set("batch_id", batchId);

  const [templates, investors, batch] = await Promise.all([
    settle(() =>
      getTemplates(
        readRequest(
          request,
          `/api/document-studio/templates?fund_name=${encodedFund}`
        )
      )
    ),
    settle(() =>
      getPreview(
        readRequest(
          request,
          `/api/document-studio/preview?fund_name=${encodedFund}`
        )
      )
    ),
    settle(() =>
      getBatch(
        readRequest(request, `/api/document-studio/batch?${batchQuery.toString()}`)
      )
    ),
  ]);

  return json({ templates, investors, batch });
}
