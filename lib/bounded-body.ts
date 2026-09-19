const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export function requestContentLengthExceeds(request: Request, maxBytes: number): boolean {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("invalid_request_limit");
  const raw = request.headers.get("content-length");
  if (raw === null) return false;
  const contentLength = Number(raw);
  return !Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes;
}

export async function readBoundedRequestText(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<string> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("invalid_request_limit");
  if (requestContentLengthExceeds(request, maxBytes)) throw new Error("request_body_too_large");
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

export async function readBoundedRequestJson<T = unknown>(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<T> {
  const raw = await readBoundedRequestText(request, maxBytes);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("invalid_json");
  }
}
