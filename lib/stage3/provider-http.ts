const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;

export async function readBoundedText(response: Response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("invalid_response_limit");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error("provider_response_too_large");
  if (!response.body) {
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > maxBytes) throw new Error("provider_response_too_large");
    return raw;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("provider_response_too_large");
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

export async function readBoundedJson<T = unknown>(response: Response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES): Promise<T> {
  const raw = await readBoundedText(response, maxBytes);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("provider_response_invalid_json");
  }
}
