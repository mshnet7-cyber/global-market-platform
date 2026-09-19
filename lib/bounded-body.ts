const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export async function readBoundedRequestText(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<string> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("invalid_request_limit");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error("request_body_too_large");
  if (!request.body) {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new Error("request_body_too_large");
    return raw;
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("request_body_too_large");
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return raw;
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  } finally {
    reader.releaseLock();
  }
}
