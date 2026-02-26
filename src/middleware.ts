/**
 * @file src/middleware.ts
 * @description NextAuth edge middleware for route protection. Defines a public
 * allowlist (/login, /register, /api/auth, /invite), redirects authenticated users
 * away from /login, enforces CONTRACTOR↔dashboard routing, and excludes static
 * assets from matching.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes
  const publicPaths = ["/login", "/register", "/api/auth", "/invite"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // Redirect logged-in users away from login page
    if (isLoggedIn && pathname === "/login") {
      const role = (req.auth?.user as { role?: string })?.role;
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
