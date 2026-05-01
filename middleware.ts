import { NextRequest, NextResponse } from "next/server";

function securityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Les vraies permissions admin sont validées :
  // - côté client via Supabase Auth + user_profiles ;
  // - côté serveur via requireStaff() sur les routes API sensibles.
  // Le middleware ajoute une barrière légère et des headers de sécurité.
  if (pathname.startsWith("/admin") && process.env.ADMIN_ACCESS_ENABLED === "false") {
    return securityHeaders(
      NextResponse.redirect(new URL("/", request.url))
    );
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/reservation/:path*",
    "/cartes-cadeaux/:path*"
  ]
};
