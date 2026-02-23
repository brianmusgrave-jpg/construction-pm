import { NextRequest, NextResponse } from "next/server";
import { exchangeQuickBooksCode } from "@/actions/quickbooks";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?qb_error=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !realmId) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?qb_error=missing_params", req.url)
    );
  }

  const result = await exchangeQuickBooksCode(code, realmId);

  if (result.success) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?qb_connected=true", req.url)
    );
  } else {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?qb_error=${encodeURIComponent(result.error || "unknown")}`,
        req.url
      )
    );
  }
}
