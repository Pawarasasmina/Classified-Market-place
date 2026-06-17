const coordinatePattern =
  /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;

type FormatDisplayLocationInput = {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fallbackLabel?: string;
};

export function isCoordinateOnlyLocation(location: string | null | undefined) {
  return Boolean(location?.trim() && coordinatePattern.test(location.trim()));
}

export function formatDisplayLocation({
  location,
  latitude,
  longitude,
  fallbackLabel = "Pinned map location",
}: FormatDisplayLocationInput) {
  const trimmed = location?.trim() ?? "";

  if (trimmed && !isCoordinateOnlyLocation(trimmed)) {
    return trimmed;
  }

  if (latitude != null && longitude != null) {
    return fallbackLabel;
  }

  return trimmed || fallbackLabel;
}
