"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  defaultMapCenter,
  formatCompactGeocodeLabel,
  googleMapsApiKey,
  loadGoogleMapsScript,
  type GoogleMapsWindow,
} from "@/components/marketplace/google-maps-loader";
import { useResolvedLocationLabel } from "@/components/marketplace/resolved-location-label";
import { formatDisplayLocation } from "@/lib/location-display";

export type LocationRadiusValue = {
  location: string;
  latitude: number | null;
  longitude: number | null;
  radiusKilometers: number | null;
};

type LocationRadiusFilterProps = {
  value: LocationRadiusValue;
  onApply: (value: LocationRadiusValue) => void;
};

const radiusOptions = [1, 2, 5, 10, 15, 20, 40, 60, 100, 250];

function MapPinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function formatLocationSummary(value: LocationRadiusValue) {
  if (value.location.trim() && value.radiusKilometers) {
    return `${value.location.trim()} · ${value.radiusKilometers} km`;
  }

  if (value.location.trim()) {
    return value.location.trim();
  }

  return "Anywhere";
}

export function LocationRadiusFilter({
  value,
  onApply,
}: LocationRadiusFilterProps) {
  const googleWindow =
    typeof window === "undefined"
      ? undefined
      : (window as GoogleMapsWindow);
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchAddress, setSearchAddress] = useState(value.location);
  const [draftLocation, setDraftLocation] = useState(value.location);
  const [draftLatitude, setDraftLatitude] = useState<number | null>(
    value.latitude,
  );
  const [draftLongitude, setDraftLongitude] = useState<number | null>(
    value.longitude,
  );
  const [draftRadius, setDraftRadius] = useState<number>(
    value.radiusKilometers ?? 15,
  );
  const resolvedButtonLocation = useResolvedLocationLabel({
    location: value.location,
    latitude: value.latitude,
    longitude: value.longitude,
    fallbackLabel: "Anywhere",
    compact: true,
  });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    if (!open) {
      markerRef.current?.setMap?.(null);
      circleRef.current?.setMap?.(null);
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    setSearchAddress(value.location);
    setDraftLocation(value.location);
    setDraftLatitude(value.latitude);
    setDraftLongitude(value.longitude);
    setDraftRadius(value.radiusKilometers ?? 15);
    setStatusMessage(null);
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const updateCircle = (map: any, lat: number, lng: number, radiusKm: number) => {
      const GoogleCircle = googleWindow?.google?.maps?.Circle;

      if (!GoogleCircle) {
        return;
      }

      if (!circleRef.current) {
        circleRef.current = new GoogleCircle({
          map,
          strokeColor: "#7c3aed",
          strokeOpacity: 0.55,
          strokeWeight: 1.5,
          fillColor: "#7c3aed",
          fillOpacity: 0.12,
        });
      }

      circleRef.current.setCenter({ lat, lng });
      circleRef.current.setRadius(radiusKm * 1000);
      circleRef.current.setMap(map);
    };

    const updateMarker = (
      map: any,
      lat: number,
      lng: number,
      pan = true,
      fitRadius = true,
    ) => {
      const point = { lat, lng };
      const GoogleMarker = googleWindow?.google?.maps?.Marker;

      if (!markerRef.current && GoogleMarker) {
        markerRef.current = new GoogleMarker({
          map,
          position: point,
          draggable: true,
          animation: googleWindow?.google?.maps?.Animation?.DROP,
        });

        markerRef.current.addListener("dragend", (event: any) => {
          const nextLat = event.latLng?.lat?.();
          const nextLng = event.latLng?.lng?.();

          if (typeof nextLat === "number" && typeof nextLng === "number") {
            setDraftLatitude(nextLat);
            setDraftLongitude(nextLng);
            updateCircle(map, nextLat, nextLng, draftRadius);
            reverseGeocode(nextLat, nextLng);
          }
        });
      } else {
        markerRef.current.setPosition(point);
      }

      markerRef.current.setMap(map);
      markerRef.current.setVisible(true);
      updateCircle(map, lat, lng, draftRadius);

      if (fitRadius && circleRef.current?.getBounds?.()) {
        map.fitBounds(circleRef.current.getBounds(), 48);
        return;
      }

      if (pan) {
        map.panTo(point);
      }
    };

    const reverseGeocode = (lat: number, lng: number) => {
      const geocoder = geocoderRef.current;

      if (!geocoder) {
        return;
      }

      geocoder.geocode(
        { location: { lat, lng } },
        (results: Array<{ formatted_address?: string }> = [], status: string) => {
          if (cancelled) {
            return;
          }

          const refinedLocation = formatCompactGeocodeLabel(results[0]);

          if (status === "OK" && refinedLocation) {
            setDraftLocation(refinedLocation);
            setSearchAddress(refinedLocation);
            setStatusMessage("Exact location and radius updated.");
            return;
          }

          setStatusMessage("Pin updated. Address label could not be refined.");
        },
      );
    };

    const searchAddressOnMap = (address: string) => {
      const geocoder = geocoderRef.current;
      const map = mapRef.current;
      const trimmed = address.trim();

      if (!trimmed || !geocoder || !map) {
        setStatusMessage("Enter a location to search.");
        return;
      }

      setStatusMessage("Searching location...");

      geocoder.geocode(
        { address: trimmed },
        (
          results: Array<{
            formatted_address?: string;
            geometry?: { location?: { lat: () => number; lng: () => number } };
          }> = [],
          status: string,
        ) => {
          if (cancelled) {
            return;
          }

          const match = results[0];
          const point = match?.geometry?.location;

          if (status !== "OK" || !match || !point) {
            setStatusMessage("Location not found. Try a more specific search.");
            return;
          }

          const nextLat = point.lat();
          const nextLng = point.lng();
          const refinedLocation =
            formatCompactGeocodeLabel(match) || match.formatted_address || trimmed;
          setDraftLatitude(nextLat);
          setDraftLongitude(nextLng);
          setDraftLocation(refinedLocation);
          setSearchAddress(refinedLocation);
          updateMarker(map, nextLat, nextLng);
          setStatusMessage(
            "Location found. Drag the pin or change the radius to fine-tune it.",
          );
        },
      );
    };

    void loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const google = googleWindow?.google;

        if (!google?.maps) {
          setStatusMessage("Google Maps is not available yet.");
          return;
        }

        geocoderRef.current ??= new google.maps.Geocoder();

        const center =
          draftLatitude != null && draftLongitude != null
            ? { lat: draftLatitude, lng: draftLongitude }
            : defaultMapCenter;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapContainerRef.current, {
            center,
            zoom: draftLatitude != null && draftLongitude != null ? 12 : 9,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            clickableIcons: false,
            gestureHandling: "greedy",
          });

          mapRef.current.addListener("click", (event: any) => {
            const nextLat = event.latLng?.lat?.();
            const nextLng = event.latLng?.lng?.();

            if (typeof nextLat !== "number" || typeof nextLng !== "number") {
              return;
            }

            setDraftLatitude(nextLat);
            setDraftLongitude(nextLng);
            updateMarker(mapRef.current, nextLat, nextLng, false);
            reverseGeocode(nextLat, nextLng);
          });
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(
            draftLatitude != null && draftLongitude != null ? 12 : 9,
          );
        }

        if (draftLatitude != null && draftLongitude != null) {
          updateMarker(mapRef.current, draftLatitude, draftLongitude);
          if (!draftLocation.trim()) {
            reverseGeocode(draftLatitude, draftLongitude);
          }
          setStatusMessage(
            "Adjust the pin or radius to control which listings are included.",
          );
          return;
        }

        if (draftLocation.trim()) {
          searchAddressOnMap(draftLocation);
        } else {
          setStatusMessage(
            "Search a town, city, or neighbourhood, then adjust the radius.",
          );
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setStatusMessage(error.message);
        }
      });

    return () => {
      cancelled = true;
      markerRef.current?.setMap?.(null);
      circleRef.current?.setMap?.(null);
    };
  }, [
    draftLatitude,
    draftLongitude,
    draftLocation,
    draftRadius,
    googleWindow,
    open,
  ]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mapRef.current || !geocoderRef.current) {
      setStatusMessage("Google Maps is still loading.");
      return;
    }

    const trimmed = searchAddress.trim();

    if (!trimmed) {
      setStatusMessage("Enter a location to search.");
      return;
    }

    setStatusMessage("Searching location...");

    geocoderRef.current.geocode(
      { address: trimmed },
      (
        results: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat: () => number; lng: () => number } };
        }> = [],
        status: string,
      ) => {
        const match = results[0];
        const point = match?.geometry?.location;

        if (status !== "OK" || !match || !point) {
          setStatusMessage("Location not found. Try a more specific search.");
          return;
        }

        const nextLat = point.lat();
        const nextLng = point.lng();
        const refinedLocation =
          formatCompactGeocodeLabel(match) || match.formatted_address || trimmed;
        setDraftLatitude(nextLat);
        setDraftLongitude(nextLng);
        setDraftLocation(refinedLocation);
        setSearchAddress(refinedLocation);
        setStatusMessage(
          "Location found. Drag the pin or change the radius to fine-tune it.",
        );
      },
    );
  }

  function handleUseCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatusMessage("Current location is not available in this browser.");
      return;
    }

    setStatusMessage("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraftLatitude(position.coords.latitude);
        setDraftLongitude(position.coords.longitude);
        setStatusMessage(
          "Current location loaded. We’re refining the address now.",
        );
      },
      () => {
        setStatusMessage("Could not access your current location.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function handleApply() {
    onApply({
      location:
        draftLocation.trim() ||
        searchAddress.trim() ||
        formatDisplayLocation({
          latitude: draftLatitude,
          longitude: draftLongitude,
        }),
      latitude: draftLatitude,
      longitude: draftLongitude,
      radiusKilometers:
        draftLatitude != null && draftLongitude != null ? draftRadius : null,
    });
    setOpen(false);
  }

  function handleClear() {
    setSearchAddress("");
    setDraftLocation("");
    setDraftLatitude(null);
    setDraftLongitude(null);
    setDraftRadius(15);
    markerRef.current?.setVisible(false);
    circleRef.current?.setMap(null);
    setStatusMessage("Location radius filter cleared.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[0.98rem] font-medium text-[var(--foreground)]">
            {resolvedButtonLocation || "Anywhere"}
          </span>
          {value.radiusKilometers != null ? (
            <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-2 py-0.5 text-[0.72rem] font-bold text-[var(--muted)]">
              {value.radiusKilometers} km
            </span>
          ) : null}
        </span>
        <span className="text-lg leading-none text-[var(--foreground)]">⌄</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-4">
          <div className="w-full max-w-[42rem] overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[#1e1f22] text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-center text-[1.8rem] font-black tracking-[-0.03em] text-white">
                Change location
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 p-3 text-white transition hover:bg-white/18"
                aria-label="Close location filter"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 px-5 py-4">
              <form onSubmit={handleSearchSubmit} className="grid gap-3">
                <label className="grid gap-2 text-sm text-white/78">
                  <span>Search by town, city, neighbourhood or postal code.</span>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <MapPinIcon className="h-5 w-5 text-white/70" />
                      <input
                        value={searchAddress}
                        onChange={(event) => setSearchAddress(event.target.value)}
                        placeholder="Search location"
                        className="w-full border-0 bg-transparent text-base text-white outline-none placeholder:text-white/42"
                      />
                    </div>
                  </div>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#1e1f22]">
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <LocateIcon />
                    Use my location
                  </button>
                </div>
              </form>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-white/78">Radius</span>
                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3">
                  <select
                    value={draftRadius}
                    onChange={(event) => setDraftRadius(Number(event.target.value))}
                    className="w-full bg-transparent text-lg font-semibold text-white outline-none"
                  >
                    {radiusOptions.map((radiusKm) => (
                      <option
                        key={radiusKm}
                        value={radiusKm}
                        className="bg-[#1e1f22] text-white"
                      >
                        {radiusKm} kilometres
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <div className="overflow-hidden rounded-[1.2rem] border border-white/10 bg-[#111214]">
                <div
                  ref={mapContainerRef}
                  className="h-[20rem] w-full bg-[linear-gradient(135deg,#203442,#0c4a6e)]"
                />
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3 text-sm text-white/72">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">
                    {formatDisplayLocation({
                      location: draftLocation,
                      latitude: draftLatitude,
                      longitude: draftLongitude,
                      fallbackLabel: "No exact location selected yet.",
                    })}
                  </p>
                  <p className="mt-1">
                    {draftLatitude != null && draftLongitude != null
                      ? "Exact map pin selected"
                      : "Search a place or click the map to drop a pin."}
                  </p>
                  {statusMessage ? <p className="mt-2">{statusMessage}</p> : null}
                  {!googleMapsApiKey ? (
                    <p className="mt-2 text-rose-300">
                      Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable this feature.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-xl border border-white/12 bg-white/6 px-4 py-2 font-semibold text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={handleApply}
                className="rounded-xl bg-[#2176ff] px-5 py-3 text-sm font-black text-white shadow-[0_16px_30px_rgba(33,118,255,0.35)]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
