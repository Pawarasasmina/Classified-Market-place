"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type LocationPickerValue = {
  location: string;
  latitude: number | null;
  longitude: number | null;
};

type LocationPickerProps = {
  location: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (value: LocationPickerValue) => void;
  triggerClassName?: string;
  rootClassName?: string;
};

declare global {
  interface Window {
    __googleMapsApiPromise?: Promise<void>;
  }
}

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const defaultMapCenter = { lat: 25.2048, lng: 55.2708 };

function MapPinIcon({ className = "h-4 w-4" }: { className?: string }) {
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

function formatCoordinateLocation(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) {
    return "";
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function loadGoogleMapsScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps only loads in the browser."));
  }

  const googleWindow = window as Window & {
    google?: { maps?: any };
  };

  if (!googleMapsApiKey) {
    return Promise.reject(
      new Error("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the map picker."),
    );
  }

  if (googleWindow.google?.maps) {
    return Promise.resolve();
  }

  if (googleWindow.__googleMapsApiPromise) {
    return googleWindow.__googleMapsApiPromise;
  }

  googleWindow.__googleMapsApiPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-loader="true"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Maps could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      googleMapsApiKey,
    )}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google Maps could not be loaded."));
    document.head.appendChild(script);
  });

  return googleWindow.__googleMapsApiPromise;
}

export function LocationPicker({
  location,
  latitude,
  longitude,
  onChange,
  triggerClassName,
  rootClassName,
}: LocationPickerProps) {
  const googleWindow =
    typeof window === "undefined"
      ? undefined
      : (window as Window & { google?: { maps?: any } });
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchAddress, setSearchAddress] = useState(location);
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftLatitude, setDraftLatitude] = useState<number | null>(latitude);
  const [draftLongitude, setDraftLongitude] = useState<number | null>(longitude);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearchAddress(location);
    setDraftLocation(location);
    setDraftLatitude(latitude);
    setDraftLongitude(longitude);
    setStatusMessage(null);
  }, [open, location, latitude, longitude]);

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

    const updateMarker = (
      map: any,
      lat: number,
      lng: number,
      pan = true,
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
            reverseGeocode(nextLat, nextLng);
          }
        });
      } else {
        markerRef.current.setPosition(point);
      }

      markerRef.current.setMap(map);
      markerRef.current.setVisible(true);

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

          if (status === "OK" && results[0]?.formatted_address) {
            setDraftLocation(results[0].formatted_address);
            setSearchAddress(results[0].formatted_address);
            setStatusMessage("Exact map location selected.");
            return;
          }

          setStatusMessage("Pin updated. Address label could not be refined.");
        },
      );
    };

    const runAddressSearch = (map: any, address: string) => {
      const geocoder = geocoderRef.current;
      const trimmed = address.trim();

      if (!trimmed || !geocoder) {
        setStatusMessage("Enter an address to search.");
        return;
      }

      setStatusMessage("Searching address...");

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
            setStatusMessage("Address not found. Try a more precise search.");
            return;
          }

          const nextLat = point.lat();
          const nextLng = point.lng();
          updateMarker(map, nextLat, nextLng);
          setDraftLatitude(nextLat);
          setDraftLongitude(nextLng);
          setDraftLocation(match.formatted_address ?? trimmed);
          setSearchAddress(match.formatted_address ?? trimmed);
          setStatusMessage("Address found. Drag the pin if you need to fine-tune it.");
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
        const center =
          draftLatitude != null && draftLongitude != null
            ? { lat: draftLatitude, lng: draftLongitude }
            : defaultMapCenter;

        geocoderRef.current ??= new google.maps.Geocoder();

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapContainerRef.current, {
            center,
            zoom:
              draftLatitude != null && draftLongitude != null
                ? 16
                : 11,
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

            updateMarker(mapRef.current, nextLat, nextLng, false);
            setDraftLatitude(nextLat);
            setDraftLongitude(nextLng);
            reverseGeocode(nextLat, nextLng);
          });
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(
            draftLatitude != null && draftLongitude != null ? 16 : 11,
          );
        }

        if (draftLatitude != null && draftLongitude != null) {
          updateMarker(mapRef.current, draftLatitude, draftLongitude, false);
          setStatusMessage("Drag the pin or search a new address to adjust the location.");
          return;
        }

        if (draftLocation.trim()) {
          runAddressSearch(mapRef.current, draftLocation);
        } else {
          setStatusMessage("Search an address or click on the map to drop a pin.");
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setStatusMessage(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, draftLatitude, draftLongitude, draftLocation]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mapRef.current || !geocoderRef.current) {
      setStatusMessage("Google Maps is still loading.");
      return;
    }

    const geocoder = geocoderRef.current;
    const trimmed = searchAddress.trim();

    if (!trimmed) {
      setStatusMessage("Enter an address to search.");
      return;
    }

    setStatusMessage("Searching address...");

    geocoder.geocode(
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
          setStatusMessage("Address not found. Try a more precise search.");
          return;
        }

        const nextLat = point.lat();
        const nextLng = point.lng();
        const GoogleMarker = googleWindow?.google?.maps?.Marker;

        if (!markerRef.current && GoogleMarker) {
          markerRef.current = new GoogleMarker({
            map: mapRef.current,
            draggable: true,
            position: { lat: nextLat, lng: nextLng },
          });
        } else {
          markerRef.current.setPosition({ lat: nextLat, lng: nextLng });
          markerRef.current.setMap(mapRef.current);
          markerRef.current.setVisible(true);
        }

        mapRef.current.panTo({ lat: nextLat, lng: nextLng });
        mapRef.current.setZoom(16);
        setDraftLatitude(nextLat);
        setDraftLongitude(nextLng);
        setDraftLocation(match.formatted_address ?? trimmed);
        setSearchAddress(match.formatted_address ?? trimmed);
        setStatusMessage("Address found. Drag the pin if you need to fine-tune it.");
      },
    );
  }

  function handleConfirm() {
    const fallbackLocation = formatCoordinateLocation(
      draftLatitude,
      draftLongitude,
    );

    onChange({
      location:
        draftLocation.trim() || searchAddress.trim() || fallbackLocation,
      latitude: draftLatitude,
      longitude: draftLongitude,
    });
    setOpen(false);
  }

  const coordinateText = formatCoordinateLocation(latitude, longitude);
  const coordinatesLabel = coordinateText || "No exact map pin selected yet";
  const selectedAddressLabel =
    location.trim() || coordinateText || "No location selected yet";

  return (
    <>
      <div className={rootClassName ?? "grid gap-2"}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerClassName ??
            "inline-flex w-fit items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
          }
        >
          <MapPinIcon />
          {location.trim() ? "Change location" : "Select location"}
        </button>
        <p className="text-sm text-[var(--foreground)]">{selectedAddressLabel}</p>
        <p className="text-xs text-[var(--muted)]">
          Map pin: {coordinatesLabel}
        </p>
        {!googleMapsApiKey ? (
          <p className="text-xs text-[var(--brand-strong)]">
            Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable the Google Maps picker.
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-[var(--line)] bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div>
                <p className="section-eyebrow">Location picker</p>
                <h3 className="mt-1 text-xl font-black text-[var(--foreground)]">
                  Pick the exact listing location
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Search an address, click on the map, or drag the pin to the exact spot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-5 py-4 lg:grid-cols-[320px,minmax(0,1fr)]">
              <div className="grid gap-4">
                <form onSubmit={handleSearchSubmit} className="grid gap-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold">Search address</span>
                    <input
                      value={searchAddress}
                      onChange={(event) => setSearchAddress(event.target.value)}
                      placeholder="Search by address or area"
                      className="surface-input w-full text-sm"
                    />
                  </label>
                  <button className="action-primary px-4 py-2 text-sm font-semibold">
                    Search address
                  </button>
                </form>

                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    Selected address
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {draftLocation.trim() || "No address chosen yet."}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Coordinates
                  </p>
                  <p className="mt-1 text-sm text-[var(--foreground)]">
                    {draftLatitude != null && draftLongitude != null
                      ? `${draftLatitude.toFixed(6)}, ${draftLongitude.toFixed(6)}`
                      : "No pin selected"}
                  </p>
                </div>

                {statusMessage ? (
                  <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                    {statusMessage}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftLatitude(null);
                      setDraftLongitude(null);
                      setDraftLocation("");
                      setSearchAddress("");
                      markerRef.current?.setVisible(false);
                      setStatusMessage("Map pin cleared. You can search again or click the map.");
                    }}
                    className="rounded-md border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                  >
                    Clear pin
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="action-primary px-4 py-2 text-sm font-semibold"
                  >
                    Use this location
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)]">
                <div
                  ref={mapContainerRef}
                  className="h-[420px] w-full bg-[linear-gradient(135deg,#f6efe6,#d7e5dd)]"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
