export function readTrimmedString(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

export function readNullableString(formData: FormData, key: string) {
  const value = readTrimmedString(formData, key);
  return value === '' ? null : value;
}

export function readOptionalUrl(formData: FormData, key: string) {
  const value = readNullableString(formData, key);

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function isValidOptionalUrl(value: string | null) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function readCheckboxBoolean(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

export function readNumber(formData: FormData, key: string, fallback = 0) {
  const rawValue = readTrimmedString(formData, key);

  if (rawValue === '') {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}
