export function isJsonContentType(value: string | null) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

export async function readUtf8BodyWithLimit(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false as const, reason: 'too_large' as const };
  }

  if (!request.body) return { ok: true as const, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return { ok: false as const, reason: 'too_large' as const };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true as const, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false as const, reason: 'invalid_utf8' as const };
  }
}
