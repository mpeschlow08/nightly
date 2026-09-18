function maskSecretText(value: string) {
  if (!value) {
    return "";
  }

  return "*".repeat(Math.max(value.length, 8));
}

export function maskCameraSourceUrl(streamUrl: string) {
  const raw = streamUrl.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);

    const hasUsername = parsed.username.length > 0;
    const hasPassword = parsed.password.length > 0;
    if (hasUsername || hasPassword) {
      const username = hasUsername ? decodeURIComponent(parsed.username) : "user";
      parsed.username = encodeURIComponent(username);
      parsed.password = encodeURIComponent(maskSecretText(decodeURIComponent(parsed.password || "password")));
    }

    const maskedQueryKeys = ["token", "password", "pass", "secret", "key", "auth"];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (maskedQueryKeys.some((candidate) => key.toLowerCase().includes(candidate))) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }

    return parsed.toString();
  } catch {
    const atIndex = raw.indexOf("@");
    const schemeIndex = raw.indexOf("://");
    if (schemeIndex > -1 && atIndex > schemeIndex) {
      const credentials = raw.slice(schemeIndex + 3, atIndex);
      const separatorIndex = credentials.indexOf(":");
      if (separatorIndex > -1) {
        const username = credentials.slice(0, separatorIndex);
        const rest = raw.slice(atIndex);
        return `${raw.slice(0, schemeIndex + 3)}${username}:${maskSecretText("password")}${rest}`;
      }
      return `${raw.slice(0, schemeIndex + 3)}${maskSecretText(credentials)}${raw.slice(atIndex)}`;
    }

    return raw;
  }
}
