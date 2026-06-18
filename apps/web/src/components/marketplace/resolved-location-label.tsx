"use client";

import { useEffect, useState } from "react";
import {
  formatCompactGeocodeLabel,
  loadGoogleMapsScript,
  type GoogleMapsWindow,
} from "@/components/marketplace/google-maps-loader";
import {
  formatDisplayLocation,
  isGenericPinnedLocation,
} from "@/lib/location-display";

type ResolvedLocationLabelProps = {
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  fallbackLabel?: string;
  compact?: boolean;
};

const resolvedLocationCache = new Map<string, string>();
const pendingLocationCache = new Map<string, Promise<string>>();

function buildCacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function toCompactLabel(label: string) {
  return label.split(",")[0]?.trim() || label;
}

async function resolveLocationLabel(
  latitude: number,
  longitude: number,
): Promise<string> {
  const cacheKey = buildCacheKey(latitude, longitude);
  const cached = resolvedLocationCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const pending = pendingLocationCache.get(cacheKey);

  if (pending) {
    return pending;
  }

  const nextRequest = loadGoogleMapsScript()
    .then(
      () =>
        new Promise<string>((resolve) => {
          const googleWindow = window as GoogleMapsWindow;
          const google = googleWindow.google;

          if (!google?.maps?.Geocoder) {
            resolve("");
            return;
          }

          const geocoder = new google.maps.Geocoder();
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (
              results: Array<{ formatted_address?: string }> = [],
              status: string,
            ) => {
              if (status !== "OK") {
                resolve("");
                return;
              }

              resolve(formatCompactGeocodeLabel(results[0]));
            },
          );
        }),
    )
    .then((label) => {
      if (label) {
        resolvedLocationCache.set(cacheKey, label);
      }

      pendingLocationCache.delete(cacheKey);
      return label;
    })
    .catch(() => {
      pendingLocationCache.delete(cacheKey);
      return "";
    });

  pendingLocationCache.set(cacheKey, nextRequest);

  return nextRequest;
}

export function useResolvedLocationLabel({
  location,
  latitude,
  longitude,
  fallbackLabel = "Pinned map location",
  compact = false,
}: ResolvedLocationLabelProps) {
  const baseLabel = formatDisplayLocation({
    location,
    latitude,
    longitude,
    fallbackLabel,
  });
  const [resolvedLabel, setResolvedLabel] = useState(baseLabel);

  useEffect(() => {
    const nextBaseLabel = formatDisplayLocation({
      location,
      latitude,
      longitude,
      fallbackLabel,
    });

    setResolvedLabel(nextBaseLabel);

    if (
      latitude == null ||
      longitude == null ||
      !isGenericPinnedLocation(nextBaseLabel)
    ) {
      return;
    }

    let cancelled = false;

    void resolveLocationLabel(latitude, longitude).then((nextLabel) => {
      if (!cancelled && nextLabel) {
        setResolvedLabel(nextLabel);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fallbackLabel, latitude, location, longitude]);

  return compact ? toCompactLabel(resolvedLabel) : resolvedLabel;
}

export function ResolvedLocationLabel(props: ResolvedLocationLabelProps) {
  return <>{useResolvedLocationLabel(props)}</>;
}
