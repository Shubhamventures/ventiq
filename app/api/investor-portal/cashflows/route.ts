import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_KEY = "investor_cashflows_portal";

type DataRow = Record<string, unknown>;

const INTERNAL_VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investor_relations",
  "maker",
  "checker",
]);

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return 0;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function isFutureOrNoExpiry(value: unknown) {
  const text = normalizeText(value, 100);
  if (!text) return true;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function jsonResponse(body: DataRow, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(error: string, status: number, code?: string) {
  return jsonResponse(
    {
      error,
      ...(code ? { code } : {}),
    },
    status
  );
}

function unavailable(
  fundName: string,
  investorCode: string,
  reason: string,
  message: string
) {
  return jsonResponse({
    available: false,
    fund_name: fundName,
    investor_code: investorCode,
    reason,
    message,
  });
}

function isReleasedStatus(value: unknown) {
  const status = normalizeText(value, 80).toLowerCase();

  if (!status) return true;

  return ![
    "draft",
    "cancelled",
    "canceled",
    "void",
    "voided",
    "rejected",
    "reversed",
  ].includes(status);
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonError(
        "Please sign in before opening investor cashflows.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const requestedInvestorCode = normalizeText(
      request.nextUrl.searchParams.get("investorCode"),
      160
    );

    if (!fundName) {
      return jsonError("Fund name is required.", 400, "FUND_NAME_REQUIRED");
    }

    const { data: userResult, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);

    const user = userResult?.user;

    if (userError || !user) {
      return jsonError(
        "Your session is no longer valid.",
        401,
        "INVALID_SESSION"
      );
    }

    const { data: rawProfile, error: profileError } = await supabaseAdmin
      .from("ventiq_user_profiles")
      .select(
        "user_id,email,full_name,default_role,active_organisation_id,investor_id,status"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
    }

    const profile = rawProfile as unknown as DataRow | null;

    if (
      !profile ||
      normalizeText(profile.status, 40).toLowerCase() !== "active"
    ) {
      return jsonError(
        "Your VENTIQ profile is not active.",
        403,
        "PROFILE_NOT_ACTIVE"
      );
    }

    const { data: rawFundAccess, error: fundAccessError } = await supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("organisation_id,role,can_view,investor_id,status")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify governed fund access: ${fundAccessError.message}`
      );
    }

    const fundAccess = rawFundAccess as unknown as DataRow | null;

    if (!fundAccess || !Boolean(fundAccess.can_view)) {
      return jsonError(
        "The requested investor cashflow history was not found.",
        404,
        "INVESTOR_CASHFLOWS_NOT_FOUND"
      );
    }

    const organisationId = normalizeText(fundAccess.organisation_id, 80);
    const activeOrganisationId = normalizeText(
      profile.active_organisation_id,
      80
    );

    if (
      activeOrganisationId &&
      organisationId &&
      activeOrganisationId !== organisationId
    ) {
      return jsonError(
        "The requested investor cashflow history was not found.",
        404,
        "INVESTOR_CASHFLOWS_NOT_FOUND"
      );
    }

    const governedRole =
      normalizeText(fundAccess.role, 80).toLowerCase() ||
      normalizeText(profile.default_role, 80).toLowerCase();

    if (
      governedRole !== "investor" &&
      !INTERNAL_VIEW_ROLES.has(governedRole)
    ) {
      return jsonError(
        "You do not have access to investor cashflow history.",
        403,
        "ROLE_NOT_ALLOWED"
      );
    }

    const [moduleResult, fullFundResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_module_activation_status")
        .select("status,readiness_score,readiness_evidence")
        .eq("organisation_id", organisationId)
        .ilike("fund_name", fundName)
        .eq("module_key", MODULE_KEY)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("fund_activation_status")
        .select("status")
        .ilike("fund_name", fundName)
        .limit(1)
        .maybeSingle(),
    ]);

    if (moduleResult.error) {
      throw new Error(
        `Unable to verify Investor Cashflows activation: ${moduleResult.error.message}`
      );
    }

    if (fullFundResult.error) {
      throw new Error(
        `Unable to verify full-fund activation: ${fullFundResult.error.message}`
      );
    }

    const moduleActive =
      normalizeText(
        (moduleResult.data as unknown as DataRow | null)?.status,
        80
      ).toLowerCase() === "active";

    const fullFundActive =
      normalizeText(
        (fullFundResult.data as unknown as DataRow | null)?.status,
        80
      ).toLowerCase() === "active";

    if (!moduleActive && !fullFundActive) {
      return unavailable(
        fundName,
        "",
        "CASHFLOWS_NOT_ACTIVE",
        "Investor capital-call and distribution history is not available for this fund yet."
      );
    }

    let investorCode = "";
    let entitlementBasis = `ventiq_user_fund_access:${governedRole}`;

    if (governedRole === "investor") {
      const { data: entitlementData, error: entitlementError } =
        await supabaseAdmin
          .from("ventiq_user_investor_access")
          .select(
            "investor_code,status,expires_at,can_view_financials"
          )
          .eq("user_id", user.id)
          .eq("status", "Active")
          .ilike("fund_name", fundName);

      if (entitlementError) {
        throw new Error(
          `Unable to verify investor cashflow entitlement: ${entitlementError.message}`
        );
      }

      const eligibleEntitlements = (
        (entitlementData ?? []) as unknown as DataRow[]
      ).filter(
        (row) =>
          isFutureOrNoExpiry(row.expires_at) &&
          Boolean(row.can_view_financials) &&
          Boolean(normalizeText(row.investor_code, 160))
      );

      const entitlementCodes = Array.from(
        new Set(
          eligibleEntitlements
            .map((row) => normalizeText(row.investor_code, 160))
            .filter(Boolean)
        )
      );

      if (entitlementCodes.length === 0) {
        return jsonError(
          "The requested investor cashflow history was not found.",
          404,
          "INVESTOR_CASHFLOWS_NOT_FOUND"
        );
      }

      // Investor-role query-string investorCode is deliberately ignored.
      const preferredCodes = [
        normalizeText(profile.investor_id, 160),
        normalizeText(fundAccess.investor_id, 160),
      ].filter(Boolean);

      investorCode =
        preferredCodes.find((code) =>
          entitlementCodes.some(
            (entitledCode) =>
              entitledCode.toLowerCase() === code.toLowerCase()
          )
        ) ||
        (entitlementCodes.length === 1 ? entitlementCodes[0] : "");

      if (!investorCode) {
        return unavailable(
          fundName,
          "",
          "INVESTOR_CONTEXT_AMBIGUOUS",
          "Your investor account context could not be resolved."
        );
      }

      entitlementBasis =
        `ventiq_user_investor_access:${investorCode}:financials`;
    } else {
      investorCode = requestedInvestorCode;

      if (!investorCode) {
        return jsonError(
          "Investor code is required for internal support view.",
          400,
          "INVESTOR_CODE_REQUIRED"
        );
      }
    }

    const { data: rawInvestor, error: investorError } = await supabaseAdmin
      .from("investor_master")
      .select("id,investor_code,investor_name,fund_name")
      .ilike("fund_name", fundName)
      .ilike("investor_code", investorCode)
      .limit(1)
      .maybeSingle();

    if (investorError) {
      throw new Error(
        `Unable to verify governed investor: ${investorError.message}`
      );
    }

    const investorRecord = rawInvestor as unknown as DataRow | null;

    if (!investorRecord) {
      return jsonError(
        "The requested investor cashflow history was not found.",
        404,
        "INVESTOR_CASHFLOWS_NOT_FOUND"
      );
    }

    // Load investor-scoped canonical rows using the server client.
    const [allocationsResult, receiptsResult, distributionAllocationsResult] =
      await Promise.all([
        supabaseAdmin
          .from("capital_call_allocations")
          .select(
            "id,allocation_code,capital_call_id,capital_call_code,investor_code,investor_name,class_name,commitment_amount,call_percentage,called_amount,equalisation_interest,fee_amount,tax_amount,other_amount,total_due,allocation_basis,due_date,currency,status,source_batch_id,migration_status"
          )
          .ilike("fund_name", fundName)
          .ilike("investor_code", investorCode)
          .order("due_date", { ascending: false }),
        supabaseAdmin
          .from("capital_call_receipts")
          .select(
            "id,receipt_code,capital_call_id,capital_call_code,allocation_code,investor_code,investor_name,class_name,receipt_date,amount_received,contribution_amount,equalisation_interest_received,fee_received,tax_withheld,other_amount,net_contribution,currency,bank_reference,payment_method,receipt_status,days_late,reversal_of_receipt_code,source_batch_id,migration_status"
          )
          .ilike("fund_name", fundName)
          .ilike("investor_code", investorCode)
          .order("receipt_date", { ascending: false }),
        supabaseAdmin
          .from("distribution_allocations")
          .select(
            "id,distribution_allocation_code,distribution_id,distribution_code,investor_code,investor_name,class_name,declaration_date,record_date,payment_date,allocation_percentage,units_or_ratio,gross_distribution,return_of_capital,income_distribution,interest_distribution,dividend_distribution,capital_gain_distribution,fee_rebate,tax_withheld,other_deductions,net_distribution,currency,bank_reference,payment_status,source_batch_id,migration_status"
          )
          .ilike("fund_name", fundName)
          .ilike("investor_code", investorCode)
          .order("payment_date", { ascending: false }),
      ]);

    if (allocationsResult.error) {
      throw new Error(
        `Unable to load investor capital-call allocations: ${allocationsResult.error.message}`
      );
    }

    if (receiptsResult.error) {
      throw new Error(
        `Unable to load investor capital-call receipts: ${receiptsResult.error.message}`
      );
    }

    if (distributionAllocationsResult.error) {
      throw new Error(
        `Unable to load investor distribution allocations: ${distributionAllocationsResult.error.message}`
      );
    }

    const allocations = (
      (allocationsResult.data ?? []) as unknown as DataRow[]
    ).filter(
      (row) =>
        normalizeText(row.migration_status, 80).toLowerCase() === "ready" &&
        isReleasedStatus(row.status)
    );

    const receipts = (
      (receiptsResult.data ?? []) as unknown as DataRow[]
    ).filter(
      (row) =>
        normalizeText(row.migration_status, 80).toLowerCase() === "ready" &&
        isReleasedStatus(row.receipt_status) &&
        !normalizeText(row.reversal_of_receipt_code, 160)
    );

    const distributionAllocations = (
      (distributionAllocationsResult.data ?? []) as unknown as DataRow[]
    ).filter(
      (row) =>
        normalizeText(row.migration_status, 80).toLowerCase() === "ready" &&
        isReleasedStatus(row.payment_status)
    );

    const capitalCallCodes = Array.from(
      new Set(
        allocations
          .map((row) => normalizeText(row.capital_call_code, 160))
          .filter(Boolean)
      )
    );

    const distributionCodes = Array.from(
      new Set(
        distributionAllocations
          .map((row) => normalizeText(row.distribution_code, 160))
          .filter(Boolean)
      )
    );

    let callEvents: DataRow[] = [];
    let distributionEvents: DataRow[] = [];

    if (capitalCallCodes.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("migration_capital_call_events")
        .select(
          "id,capital_call_code,call_name,call_date,due_date,call_percentage,base_call_amount,equalisation_interest,fee_amount,tax_amount,other_amount,total_call_amount,currency,purpose,allocation_method,status,source_batch_id,migration_status"
        )
        .ilike("fund_name", fundName)
        .in("capital_call_code", capitalCallCodes);

      if (error) {
        throw new Error(
          `Unable to load capital-call event context: ${error.message}`
        );
      }

      callEvents = ((data ?? []) as unknown as DataRow[]).filter(
        (row) =>
          normalizeText(row.migration_status, 80).toLowerCase() === "ready" &&
          isReleasedStatus(row.status)
      );
    }

    if (distributionCodes.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("distributions")
        .select(
          "id,distribution_code,distribution_name,declaration_date,record_date,distribution_date,payment_date,distribution_amount,distribution_type,waterfall_method,currency,status,source_batch_id"
        )
        .ilike("fund_name", fundName)
        .in("distribution_code", distributionCodes);

      if (error) {
        throw new Error(
          `Unable to load distribution event context: ${error.message}`
        );
      }

      distributionEvents = ((data ?? []) as unknown as DataRow[]).filter(
        (row) => isReleasedStatus(row.status)
      );
    }

    const eventByCode = new Map(
      callEvents.map((row) => [
        normalizeText(row.capital_call_code, 160).toLowerCase(),
        row,
      ])
    );

    const receiptsByAllocation = new Map<string, DataRow[]>();

    for (const receipt of receipts) {
      const allocationCode = normalizeText(
        receipt.allocation_code,
        160
      ).toLowerCase();

      if (!allocationCode) continue;

      const existing = receiptsByAllocation.get(allocationCode) ?? [];
      existing.push(receipt);
      receiptsByAllocation.set(allocationCode, existing);
    }

    const capitalCalls = allocations.map((allocation) => {
      const allocationCode = normalizeText(allocation.allocation_code, 160);
      const callCode = normalizeText(allocation.capital_call_code, 160);
      const event = eventByCode.get(callCode.toLowerCase()) ?? {};
      const linkedReceipts =
        receiptsByAllocation.get(allocationCode.toLowerCase()) ?? [];

      const amountReceived = linkedReceipts.reduce(
        (sum, row) => sum + toNumber(row.amount_received),
        0
      );
      const netContribution = linkedReceipts.reduce(
        (sum, row) => sum + toNumber(row.net_contribution),
        0
      );
      const totalDue = toNumber(allocation.total_due);
      const outstandingAmount = Math.max(0, totalDue - amountReceived);

      const latestReceipt = [...linkedReceipts].sort((a, b) =>
        normalizeText(b.receipt_date, 40).localeCompare(
          normalizeText(a.receipt_date, 40)
        )
      )[0];

      return {
        capital_call_code: callCode,
        call_name:
          normalizeText(event.call_name, 240) ||
          `Capital Call ${callCode}`,
        call_date: normalizeText(event.call_date, 40) || null,
        due_date:
          normalizeText(allocation.due_date, 40) ||
          normalizeText(event.due_date, 40) ||
          null,
        purpose: normalizeText(event.purpose, 500) || null,
        allocation_code: allocationCode,
        commitment_amount: toNumber(allocation.commitment_amount),
        call_percentage:
          allocation.call_percentage === null ||
          allocation.call_percentage === undefined
            ? null
            : toNumber(allocation.call_percentage),
        called_amount: toNumber(allocation.called_amount),
        equalisation_interest: toNumber(allocation.equalisation_interest),
        fee_amount: toNumber(allocation.fee_amount),
        tax_amount: toNumber(allocation.tax_amount),
        other_amount: toNumber(allocation.other_amount),
        total_due: totalDue,
        amount_received: amountReceived,
        net_contribution: netContribution,
        outstanding_amount: outstandingAmount,
        allocation_status:
          normalizeText(allocation.status, 80) || null,
        receipt_status:
          normalizeText(latestReceipt?.receipt_status, 80) || null,
        receipt_date:
          normalizeText(latestReceipt?.receipt_date, 40) || null,
        bank_reference:
          normalizeText(latestReceipt?.bank_reference, 240) || null,
        payment_method:
          normalizeText(latestReceipt?.payment_method, 120) || null,
        days_late:
          latestReceipt?.days_late === null ||
          latestReceipt?.days_late === undefined
            ? null
            : toNumber(latestReceipt.days_late),
        currency:
          normalizeText(allocation.currency, 20) ||
          normalizeText(event.currency, 20) ||
          "INR",
      };
    });

    const distributionEventByCode = new Map(
      distributionEvents.map((row) => [
        normalizeText(row.distribution_code, 160).toLowerCase(),
        row,
      ])
    );

    const distributions = distributionAllocations.map((allocation) => {
      const distributionCode = normalizeText(
        allocation.distribution_code,
        160
      );
      const event =
        distributionEventByCode.get(distributionCode.toLowerCase()) ?? {};

      return {
        distribution_code: distributionCode,
        distribution_name:
          normalizeText(event.distribution_name, 240) ||
          `Distribution ${distributionCode}`,
        distribution_type:
          normalizeText(event.distribution_type, 120) || null,
        declaration_date:
          normalizeText(allocation.declaration_date, 40) ||
          normalizeText(event.declaration_date, 40) ||
          null,
        record_date:
          normalizeText(allocation.record_date, 40) ||
          normalizeText(event.record_date, 40) ||
          null,
        payment_date:
          normalizeText(allocation.payment_date, 40) ||
          normalizeText(event.payment_date, 40) ||
          null,
        gross_distribution: toNumber(allocation.gross_distribution),
        return_of_capital: toNumber(allocation.return_of_capital),
        income_distribution: toNumber(allocation.income_distribution),
        interest_distribution: toNumber(allocation.interest_distribution),
        dividend_distribution: toNumber(allocation.dividend_distribution),
        capital_gain_distribution: toNumber(
          allocation.capital_gain_distribution
        ),
        fee_rebate: toNumber(allocation.fee_rebate),
        tax_withheld: toNumber(allocation.tax_withheld),
        other_deductions: toNumber(allocation.other_deductions),
        net_distribution: toNumber(allocation.net_distribution),
        payment_status:
          normalizeText(allocation.payment_status, 80) || null,
        bank_reference:
          normalizeText(allocation.bank_reference, 240) || null,
        currency:
          normalizeText(allocation.currency, 20) ||
          normalizeText(event.currency, 20) ||
          "INR",
      };
    });

    const totalCalled = capitalCalls.reduce(
      (sum, row) => sum + row.called_amount,
      0
    );
    const totalDue = capitalCalls.reduce(
      (sum, row) => sum + row.total_due,
      0
    );
    const totalReceived = capitalCalls.reduce(
      (sum, row) => sum + row.amount_received,
      0
    );
    const totalOutstanding = capitalCalls.reduce(
      (sum, row) => sum + row.outstanding_amount,
      0
    );
    const totalDistributed = distributions.reduce(
      (sum, row) => sum + row.net_distribution,
      0
    );

    // Audit before releasing investor cashflow history.
    const { error: auditError } = await supabaseAdmin
      .from("ventiq_investor_cashflow_access_events")
      .insert({
        organisation_id: organisationId,
        fund_name: fundName,
        investor_code: investorCode,
        actor_user_id: user.id,
        actor_email:
          normalizeText(profile.email, 320) ||
          normalizeText(user.email, 320) ||
          null,
        actor_name: normalizeText(profile.full_name, 240) || null,
        actor_role: governedRole,
        entitlement_basis: entitlementBasis,
        capital_call_count: capitalCalls.length,
        receipt_count: receipts.length,
        distribution_count: distributions.length,
      });

    if (auditError) {
      throw new Error(
        `Investor cashflow data was not released because audit evidence could not be recorded: ${auditError.message}`
      );
    }

    return jsonResponse({
      available: true,
      fund_name: fundName,
      investor_code: investorCode,
      investor_name: normalizeText(investorRecord.investor_name, 240),
      summary: {
        capital_call_count: capitalCalls.length,
        receipt_count: receipts.length,
        distribution_count: distributions.length,
        total_called: totalCalled,
        total_due: totalDue,
        total_received: totalReceived,
        total_outstanding: totalOutstanding,
        total_distributed: totalDistributed,
      },
      capital_calls: capitalCalls,
      distributions,
    });
  } catch (error) {
    console.error("Investor Portal cashflow access failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load governed investor cashflow history.",
      500,
      "INVESTOR_CASHFLOWS_LOAD_FAILED"
    );
  }
}
