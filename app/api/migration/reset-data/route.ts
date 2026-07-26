import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type StorageItem = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function isFounderAuthorized(request: NextRequest) {
  const expectedKey = process.env.VENTIQ_FOUNDER_KEY;
  const providedKey = request.headers.get("x-founder-key");

  return Boolean(expectedKey && providedKey && providedKey === expectedKey);
}

async function deleteTableRows(supabase: any, tableName: string) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .not("id", "is", null);

  if (error) {
    return {
      tableName,
      status: "Failed",
      error: error.message,
    };
  }

  return {
    tableName,
    status: "Deleted",
    error: "",
  };
}

async function collectStoragePaths(
  supabase: any,
  bucketName: string,
  prefix = ""
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
    limit: 1000,
    sortBy: {
      column: "name",
      order: "asc",
    },
  });

  if (error || !data) {
    return [];
  }

  const paths: string[] = [];

  for (const item of data as StorageItem[]) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.id) {
      paths.push(fullPath);
    } else {
      const nestedPaths = await collectStoragePaths(
        supabase,
        bucketName,
        fullPath
      );

      paths.push(...nestedPaths);
    }
  }

  return paths;
}

async function clearStorageBucket(supabase: any, bucketName: string) {
  const paths = await collectStoragePaths(supabase, bucketName);

  if (paths.length === 0) {
    return {
      bucketName,
      deletedFiles: 0,
      status: "No files found",
    };
  }

  let deletedFiles = 0;

  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);

    const { error } = await supabase.storage.from(bucketName).remove(batch);

    if (!error) {
      deletedFiles += batch.length;
    }
  }

  return {
    bucketName,
    deletedFiles,
    status: "Deleted",
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!isFounderAuthorized(request)) {
      return NextResponse.json(
        { error: "Unauthorized founder access." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirmation = String(body.confirmation || "");

    if (confirmation !== "RESET VENTIQ DATA") {
      return NextResponse.json(
        {
          error:
            "Confirmation text is incorrect. Type RESET VENTIQ DATA to continue.",
        },
        { status: 400 }
      );
    }

    const tablesToDeleteInOrder = [
      "investor_documents",
      "pdf_intelligence_documents",
      "pdf_intelligence_batches",

      "investor_cashflows",
      "investor_financial_positions",
      "fund_commitments",
      "investor_master",
      "investor_import_batches",

      "portfolio_investments",
      "portfolio_data_migration_batches",

      "fund_master",
      "fund_data_migration_batches",

      "compliance_items",
      "compliance_data_migration_batches",

      "migration_file_uploads",
      "migration_intake_batches",
    ];

    const tableResults = [];

    for (const tableName of tablesToDeleteInOrder) {
      const result = await deleteTableRows(supabase, tableName);
      tableResults.push(result);
    }

    const storageResults = [];

    storageResults.push(
      await clearStorageBucket(supabase, "migration-intake-files")
    );

    storageResults.push(
      await clearStorageBucket(supabase, "investor-pdf-dump")
    );

    return NextResponse.json({
      message: "Prior VENTIQ migration data deleted successfully.",
      tableResults,
      storageResults,
    });
  } catch (error) {
    console.error("Reset migration data failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset migration data.",
      },
      { status: 500 }
    );
  }
}