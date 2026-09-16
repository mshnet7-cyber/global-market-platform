import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LANGUAGE_PATTERN = /^[a-z]{2,3}$/i;
const COUNTRY_PATTERN = /^[A-Z]{2}$/i;

function localeHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  const language = request.nextUrl.searchParams.get("language")?.trim().toLowerCase();
  const country = request.nextUrl.searchParams.get("country")?.trim().toUpperCase();
  if (language && LANGUAGE_PATTERN.test(language)) headers.set("x-gmp-language", language);
  if (country && COUNTRY_PATTERN.test(country)) headers.set("x-gmp-country", country);
  return headers;
}

export async function proxy(request: NextRequest) {
  const requestHeaders = localeHeaders(request);
  const pathname = request.nextUrl.pathname;
  const needsAuthRefresh =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/display") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/connect");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!needsAuthRefresh || !url || !publishableKey) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value, options));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
