const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function getTrustedAppOrigin(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.GMP_APP_URL?.trim();
  const vercelHost = process.env.VERCEL_URL?.trim();
  const requestOrigin = request ? new URL(request.url) : null;
  const localFallback = requestOrigin && LOCAL_HOSTS.has(requestOrigin.hostname) ? requestOrigin.origin : "";
  const candidate = configured || (vercelHost ? `https://${vercelHost}` : localFallback);
  if (!candidate) throw new Error("canonical_origin_not_configured");

  const url = new URL(candidate);
  if ((url.protocol !== "https:" && !LOCAL_HOSTS.has(url.hostname)) || url.username || url.password) {
    throw new Error("canonical_origin_invalid");
  }
  return url.origin;
}
