const REDACTED_FIELD_NAMES = new Set([
  'prompt',
  'promptText',
  'originalPrompt',
  'text',
  'message',
  'snippet',
  'responseText',
]);

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (REDACTED_FIELD_NAMES.has(key) && typeof nestedValue === 'string') {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      sanitized[key] = sanitizeValue(nestedValue);
    }
    return sanitized;
  }

  return value;
}

export function sanitizeTelemetryPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeValue(payload) as Record<string, unknown>;
}
