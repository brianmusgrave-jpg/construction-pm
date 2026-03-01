/**
 * @file src/middleware.ts
 * @description NextAuth edge middleware for route protection.
 *
 * Route rules:
 * - Public: /login, /register, /api/auth, /invite, /signup, /client/*
 * - /system-admin/* — SYSTEM_ADMIN only
 * - /contractor/* — CONTRACTOR only
 * - /dashboard/* — all non-contractor authenticated users
 * - Org status check: SUSPENDED/CANCELLED orgs get read-only banner (handled in layout)
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes — no auth required
  const publicPaths = ["/login", "/register", "/signup", "/api/auth", "/api/stripe/webhook", "/invite", "/client"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // Redirect logged-in users away from login page
    if (isLoggedIn && pathname === "/login") {
      const role = (req.auth?.user as { role?: string })?.role;
      if (role === "SYSTEM_ADMIN") {
        return NextResponse.redirect(new URL("/system-admin", req.url));
      }
      const dest = role === "CONTRACTOR" ? "/contractor" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // Landing page is public
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Protect dashboard and all app routes
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing
  const role = (req.auth?.user as { role?: string })?.role;

  // System Admin routes — SYSTEM_ADMIN only
  if (pathname.startsWith("/system-admin")) {
    if (role !== "SYSTEM_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // SYSTEM_ADMIN trying to access /dashboard gets redirected to /system-admin
  if (role === "SYSTEM_ADMIN" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/system-admin", req.url));
  }

  // Contractors trying to access /dashboard get redirected to /contractor
  if (role === "CONTRACTOR" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/contractor", req.url));
  }

  // Non-contractors trying to access /contractor get redirected to /dashboard
  if (role !== "CONTRACTOR" && pathname.startsWith("/contractor")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
