const { createClient } = require("@supabase/supabase-js");
const crypto = require("node:crypto");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("FAIL - Missing Supabase server environment variables.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const ORGANISATION_ID = "2febaacd-ef58-4444-8715-9bbd0d38238d";
const FUND_NAME = "VENTIQ Access Test Fund";
const INVESTOR_CODE = "A3TEST001";
const INVESTOR_NAME = "A3 Fund Memory Test Investor";
const SOURCE_BATCH_ID = "293e683d-dde0-4c56-a534-697e8405fe37";

const STORAGE_BUCKET = "ventiq-data-room";
const DOCUMENT_NAME = "A7 QA Fund Overview - A3TEST001";
const FILE_NAME = "A7_QA_Fund_Overview_A3TEST001.txt";
const DETECTED_TYPE = "Fund Overview";
const SUGGESTED_FOLDER = "Fund Overview";
const ACCESS_LEVEL = "Restricted LP Access";
const DDQ_IMPACT = "Supports A7-5 QA entitlement and DDQ workflow validation";

function pass(message) {
  console.log(`PASS - ${message}`);
}

function fail(message, detail = "") {
  console.error(`FAIL - ${message}`);
  if (detail) console.error(detail);
  throw new Error(message);
}

function safePathSegment(value, fallback) {
  const safe = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return safe || fallback;
}

async function main() {
  console.log("");
  console.log("VENTIQ A7-5B Data Room QA Baseline");
  console.log("===================================");
  console.log(`Fund: ${FUND_NAME}`);
  console.log(`Investor: ${INVESTOR_CODE}`);
  console.log(`Source batch: ${SOURCE_BATCH_ID}`);
  console.log("");

  // ----------------------------------------------------------
  // 1. Canonical source-batch precondition
  // ----------------------------------------------------------

  const { data: batch, error: batchError } = await admin
    .from("migration_intake_batches")
    .select(
      "id,fund_name,batch_name,processing_status,intake_mode,total_rows,processed_at"
    )
    .eq("id", SOURCE_BATCH_ID)
    .eq("fund_name", FUND_NAME)
    .maybeSingle();

  if (
    batchError ||
    !batch ||
    batch.processing_status !== "Completed" ||
    String(batch.intake_mode || "").toLowerCase() !== "canonical" ||
    Number(batch.total_rows || 0) <= 0
  ) {
    fail(
      "canonical source-batch precondition",
      batchError?.message || JSON.stringify(batch, null, 2)
    );
  }

  pass("canonical Completed source batch verified");

  // ----------------------------------------------------------
  // 2. Governed investor precondition
  // ----------------------------------------------------------

  const { data: investor, error: investorError } = await admin
    .from("investor_master")
    .select("id,investor_code,investor_name,fund_name")
    .eq("fund_name", FUND_NAME)
    .eq("investor_code", INVESTOR_CODE)
    .maybeSingle();

  if (investorError || !investor) {
    fail(
      "A3TEST001 investor precondition",
      investorError?.message
    );
  }

  pass("A3TEST001 governed investor verified");

  // ----------------------------------------------------------
  // 3. Ensure private Data Room storage bucket
  // ----------------------------------------------------------

  const { data: bucket, error: bucketLookupError } =
    await admin.storage.getBucket(STORAGE_BUCKET);

  if (bucketLookupError || !bucket) {
    const { error: createBucketError } =
      await admin.storage.createBucket(STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
      });

    if (createBucketError) {
      fail(
        "private ventiq-data-room bucket creation",
        createBucketError.message
      );
    }

    pass("private ventiq-data-room bucket created");
  } else {
    if (bucket.public === true) {
      const { error: updateBucketError } =
        await admin.storage.updateBucket(STORAGE_BUCKET, {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
        });

      if (updateBucketError) {
        fail(
          "ventiq-data-room bucket privacy hardening",
          updateBucketError.message
        );
      }
    }

    pass("private ventiq-data-room bucket verified");
  }

  // ----------------------------------------------------------
  // 4. Reuse existing A7-5 QA document if already present
  // ----------------------------------------------------------

  const { data: existingDocument, error: existingDocumentError } =
    await admin
      .from("data_room_documents")
      .select(
        "id,fund_name,source_batch_id,investor_code,investor_name,document_name,file_name,detected_type,suggested_folder,access_level,storage_bucket,storage_path,file_size,mime_type,document_status,ddq_impact,imported_at"
      )
      .eq("fund_name", FUND_NAME)
      .eq("source_batch_id", SOURCE_BATCH_ID)
      .eq("investor_code", INVESTOR_CODE)
      .eq("document_name", DOCUMENT_NAME)
      .limit(1)
      .maybeSingle();

  if (existingDocumentError) {
    fail(
      "existing QA Data Room document lookup",
      existingDocumentError.message
    );
  }

  let document = existingDocument || null;

  if (!document) {
    // --------------------------------------------------------
    // 5. Upload actual private QA object
    // --------------------------------------------------------

    const safeFund = safePathSegment(FUND_NAME, "fund");
    const safeFolder = safePathSegment(SUGGESTED_FOLDER, "general");
    const storagePath =
      `${safeFund}/${SOURCE_BATCH_ID}/${safeFolder}/` +
      `A7-5B-${crypto.randomUUID()}-${FILE_NAME}`;

    const fileBody = [
      "VENTIQ A7-5 QA FUND OVERVIEW",
      "",
      "This file is controlled QA evidence for Investor Data Room entitlement testing.",
      `Fund: ${FUND_NAME}`,
      `Investor: ${INVESTOR_NAME} (${INVESTOR_CODE})`,
      `Canonical source batch: ${SOURCE_BATCH_ID}`,
      "",
      "Purpose:",
      "- validate Restricted LP Access",
      "- validate private signed-document access",
      "- validate LP engagement logging",
      "- validate DDQ question submission and investor isolation",
      "",
      "This QA file is not a legal, investment, performance, tax or regulatory representation.",
      "",
    ].join("\n");

    const buffer = Buffer.from(fileBody, "utf8");
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "text/plain",
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) {
      fail("private QA Data Room file upload", uploadError.message);
    }

    pass("private QA Data Room file uploaded");

    // --------------------------------------------------------
    // 6. Insert canonical Data Room metadata
    // --------------------------------------------------------

    const now = new Date().toISOString();

    const { data: insertedDocument, error: insertError } = await admin
      .from("data_room_documents")
      .insert({
        fund_name: FUND_NAME,
        source_batch_id: SOURCE_BATCH_ID,
        investor_code: INVESTOR_CODE,
        investor_name: INVESTOR_NAME,
        document_name: DOCUMENT_NAME,
        file_name: FILE_NAME,
        detected_type: DETECTED_TYPE,
        suggested_folder: SUGGESTED_FOLDER,
        access_level: ACCESS_LEVEL,
        storage_bucket: STORAGE_BUCKET,
        storage_path: storagePath,
        storage_url: null,
        file_size: buffer.length,
        mime_type: "text/plain",
        document_status: "Imported",
        ddq_impact: DDQ_IMPACT,
        metadata: {
          qa_only: true,
          qa_stage: "A7-5B",
          sha256,
          purpose:
            "Investor Data Room entitlement, private access and DDQ workflow validation",
          source_batch_name: batch.batch_name || null,
        },
        uploaded_by: null,
        created_by_email: "system@ventiq.local",
        imported_at: now,
        updated_at: now,
      })
      .select(
        "id,fund_name,source_batch_id,investor_code,investor_name,document_name,file_name,detected_type,suggested_folder,access_level,storage_bucket,storage_path,file_size,mime_type,document_status,ddq_impact,imported_at"
      )
      .single();

    if (insertError || !insertedDocument) {
      await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);

      fail(
        "QA Data Room metadata insert",
        insertError?.message || "No inserted row returned"
      );
    }

    document = insertedDocument;
    pass("Restricted LP Access metadata row inserted");
  } else {
    pass("existing A7-5B QA Data Room document reused");
  }

  // ----------------------------------------------------------
  // 7. Verify private object can produce a short-lived URL
  // ----------------------------------------------------------

  if (!document?.storage_path) {
    fail("QA Data Room document has no private storage path");
  }

  const { data: signedData, error: signedError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(document.storage_path, 60);

  if (signedError || !signedData?.signedUrl) {
    fail(
      "private QA Data Room signed-URL verification",
      signedError?.message
    );
  }

  pass("private storage object verified with short-lived signed URL");

  // ----------------------------------------------------------
  // 8. Activate only the scoped Investor Data Room module
  // ----------------------------------------------------------

  const readinessEvidence = {
    verification_type: "a7_5_restricted_lp_data_room_baseline",
    investor_code: INVESTOR_CODE,
    source_batch_id: SOURCE_BATCH_ID,
    data_room_document_id: document.id,
    document_name: DOCUMENT_NAME,
    access_level: ACCESS_LEVEL,
    private_storage: true,
    signed_url_verified: true,
    qa_only: true,
  };

  const { error: activationError } = await admin
    .from("ventiq_module_activation_status")
    .upsert(
      {
        organisation_id: ORGANISATION_ID,
        fund_name: FUND_NAME,
        module_key: "investor_data_room_portal",
        module_name: "Investor Data Room & DDQ",
        status: "Active",
        readiness_score: 100,
        readiness_evidence: readinessEvidence,
        activated_at: new Date().toISOString(),
        activated_by_email: "system@ventiq.local",
        activated_by_name: "VENTIQ A7-5 Data Room Activation",
      },
      {
        onConflict: "organisation_id,fund_name,module_key",
      }
    );

  if (activationError) {
    fail(
      "Investor Data Room scoped-module activation",
      activationError.message
    );
  }

  pass("investor_data_room_portal activated at 100% readiness");

  // ----------------------------------------------------------
  // 9. Final verification
  // ----------------------------------------------------------

  const { data: verificationDocument, error: verificationDocumentError } =
    await admin
      .from("data_room_documents")
      .select(
        "id,fund_name,source_batch_id,investor_code,document_name,file_name,suggested_folder,access_level,document_status,mime_type,storage_bucket,storage_path"
      )
      .eq("id", document.id)
      .single();

  if (verificationDocumentError || !verificationDocument) {
    fail(
      "final Data Room document verification",
      verificationDocumentError?.message
    );
  }

  const { data: activation, error: activationLookupError } = await admin
    .from("ventiq_module_activation_status")
    .select(
      "organisation_id,fund_name,module_key,module_name,status,readiness_score,readiness_evidence,activated_at"
    )
    .eq("organisation_id", ORGANISATION_ID)
    .eq("fund_name", FUND_NAME)
    .eq("module_key", "investor_data_room_portal")
    .maybeSingle();

  if (
    activationLookupError ||
    !activation ||
    activation.status !== "Active" ||
    Number(activation.readiness_score) !== 100
  ) {
    fail(
      "final Investor Data Room activation verification",
      activationLookupError?.message || JSON.stringify(activation, null, 2)
    );
  }

  console.log("");
  console.log("PASS - A7-5B DATA ROOM QA BASELINE READY");
  console.log("==========================================");
  console.log(`Document ID: ${verificationDocument.id}`);
  console.log(`Document: ${verificationDocument.document_name}`);
  console.log(`Folder: ${verificationDocument.suggested_folder}`);
  console.log(`Access: ${verificationDocument.access_level}`);
  console.log(`Investor: ${verificationDocument.investor_code}`);
  console.log(`Status: ${verificationDocument.document_status}`);
  console.log(`MIME: ${verificationDocument.mime_type}`);
  console.log("Storage: private object verified");
  console.log("Module: investor_data_room_portal = Active / 100");
  console.log("");
  console.log("No DDQ question was fabricated.");
  console.log("The DDQ question will be created through the real Investor workflow in A7-5.");
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
