const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export function requestContentLengthExceeds(request: Request, maxBytes: number): boolean {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("invalid_request_limit");
  const raw = request.headers.get("content-length");
  if (raw === null) return false;
  const contentLength = Number(raw);
  return !Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes;
}

export async function readBoundedRequestBytes(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<Uint8Array> {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new Error("invalid_request_limit");
  if (requestContentLengthExceeds(request, maxBytes)) throw new Error("request_body_too_large");
  if (!request.body) {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > maxBytes) throw new Error("request_body_too_large");
    return bytes;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("request_body_too_large");
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedRequestText(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<string> {
  const bytes = await readBoundedRequestBytes(request, maxBytes);
  return new TextDecoder().decode(bytes);
}

export async function readBoundedRequestJson<T = unknown>(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<T> {
  const raw = await readBoundedRequestText(request, maxBytes);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("invalid_json");
  }
}

export async function readBoundedRequestFormData(request: Request, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<FormData> {
  const bytes = await readBoundedRequestBytes(request, maxBytes);
  const replayable = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bytes,
  });
  return replayable.formData();
}
