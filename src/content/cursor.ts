export interface ContentCursor {
  publishedAt: string;
  id: string;
}

export function encodeCursor(cursor: {
  publishedAt: Date | null;
  id: string;
}): string | null {
  if (!cursor.publishedAt) {
    return null;
  }

  const payload: ContentCursor = {
    publishedAt: cursor.publishedAt.toISOString(),
    id: cursor.id,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(raw: string): ContentCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as ContentCursor;

    if (
      typeof parsed.publishedAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      Number.isNaN(Date.parse(parsed.publishedAt))
    ) {
      throw new Error('Invalid cursor');
    }

    return parsed;
  } catch {
    throw new Error('Invalid cursor');
  }
}
