export function isSameOriginRequest(request: Request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin")?.trim();
  if (origin) {
    try { return new URL(origin).origin === expected; } catch { return false; }
  }
  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try { return new URL(referer).origin === expected; } catch { return false; }
  }
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  return fetchSite === "same-origin" || fetchSite === "same-site";
}
