const coordinatePattern =
  /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;

const genericPinnedLocationLabels = new Set([
  "pinned map location",
  "map pin selected",
  "exact map pin selected",
  "exact map location selected",
  "exact location selected",
]);

type FormatDisplayLocationInput = {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fallbackLabel?: string;
};

export function isCoordinateOnlyLocation(location: string | null | undefined) {
  return Boolean(location?.trim() && coordinatePattern.test(location.trim()));
}

export function isGenericPinnedLocation(location: string | null | undefined) {
  const normalized = location?.trim().toLowerCase() ?? "";
  return genericPinnedLocationLabels.has(normalized);
}

export function formatDisplayLocation({
  location,
  latitude,
  longitude,
  fallbackLabel = "Pinned map location",
}: FormatDisplayLocationInput) {
  const trimmed = location?.trim() ?? "";

  if (
    trimmed &&
    !isCoordinateOnlyLocation(trimmed) &&
    !isGenericPinnedLocation(trimmed)
  ) {
    return trimmed;
  }

  if (latitude != null && longitude != null) {
    return fallbackLabel;
  }

  return trimmed || fallbackLabel;
}
