export function getSafeNextPath(
  input: FormDataEntryValue | string | null | undefined,
  fallback = "/"
) {
  if (typeof input !== "string") {
    return fallback;
  }

  if (!input.startsWith("/") || input.startsWith("//")) {
    return fallback;
  }

  return input;
}

export function appendNextParam(path: string, nextPath: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(nextPath)}`;
}
