import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type InviteRequestBody = {
  stakeholderId?: string;
  email?: string;
  fullName?: string;
  roleKey?: string;
  roleLabel?: string;
  dashboardPath?: string;
  fundId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InviteRequestBody;

    const stakeholderId = body.stakeholderId?.trim();
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim() || "VENTIQ User";
    const roleKey = body.roleKey?.trim() || "stakeholder";
    const roleLabel = body.roleLabel?.trim() || "Stakeholder";
    const dashboardPath = body.dashboardPath?.trim() || "/fund-onboarding";
    const fundId = body.fundId?.trim() || "";

    if (!stakeholderId) {
      return NextResponse.json(
        { ok: false, message: "stakeholderId is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, message: "Email is required." },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_VERCEL_URL ||
      "http://localhost:3000";

    const redirectTo = `${siteUrl}/auth/welcome?next=${encodeURIComponent(
      dashboardPath
    )}`;

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
          role_key: roleKey,
          role_label: roleLabel,
          dashboard_path: dashboardPath,
          fund_id: fundId,
        },
        redirectTo,
      }
    );

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: stakeholderUpdateError } = await supabaseAdmin
      .from("ventiq_stakeholders")
      .update({
        invite_status: "Invite Sent",
        invited_at: now,
      })
      .eq("id", stakeholderId);

    if (stakeholderUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          message: stakeholderUpdateError.message,
        },
        { status: 400 }
      );
    }

    await supabaseAdmin.from("ventiq_access_audit_logs").insert({
      fund_id: fundId || null,
      stakeholder_id: stakeholderId,
      event_type: "Secure Invite Sent",
      event_title: "Stakeholder secure invite sent",
      event_description: `${fullName} was invited as ${roleLabel}. User will set their own password.`,
      actor_name: "VENTIQ Admin",
      actor_email: "admin@useventiq.com",
    });

    return NextResponse.json({
      ok: true,
      message: "Secure invite sent successfully.",
      userId: data.user?.id || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to send invite.",
      },
      { status: 500 }
    );
  }
}