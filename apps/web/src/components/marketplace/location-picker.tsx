"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  defaultMapCenter,
  googleMapsApiKey,
  loadGoogleMapsScript,
  type GoogleMapsWindow,
} from "@/components/marketplace/google-maps-loader";
import { formatDisplayLocation } from "@/lib/location-display";
import {
  reverseGeocodeFree,
  searchAddressFree,
} from "@/lib/openstreetmap-geocoding";

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

function SearchIcon() {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
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
      : (window as GoogleMapsWindow);
  const [open, setOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [searchAddress, setSearchAddress] = useState(location);
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftLatitude, setDraftLatitude] = useState<number | null>(latitude);
  const [draftLongitude, setDraftLongitude] = useState<number | null>(longitude);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

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
      setStatusMessage("Refining the pinned location...");

      void reverseGeocodeFree(lat, lng)
        .then((refinedLocation) => {
          if (cancelled) {
            return;
          }

          if (refinedLocation) {
            setDraftLocation(refinedLocation);
            setSearchAddress(refinedLocation);
            setStatusMessage("Exact map location selected.");
            return;
          }

          setStatusMessage("Pin updated. Address label could not be refined.");
        })
        .catch(() => {
          if (!cancelled) {
            setStatusMessage("Pin updated. Address label could not be refined.");
          }
        });
    };

    const runAddressSearch = (map: any, address: string) => {
      const trimmed = address.trim();

      if (!trimmed) {
        setStatusMessage("Enter an address to search.");
        return;
      }

      setStatusMessage("Searching address...");

      void searchAddressFree(trimmed)
        .then((match) => {
          if (cancelled) {
            return;
          }

          if (!match) {
            setStatusMessage("Address not found. Try a more precise search.");
            return;
          }

          const nextLat = match.latitude;
          const nextLng = match.longitude;
          const refinedLocation = match.label || trimmed;
          updateMarker(map, nextLat, nextLng);
          setDraftLatitude(nextLat);
          setDraftLongitude(nextLng);
          setDraftLocation(refinedLocation);
          setSearchAddress(refinedLocation);
          setStatusMessage("Address found. Drag the pin if you need to fine-tune it.");
        })
        .catch(() => {
          if (!cancelled) {
            setStatusMessage("Address search is unavailable right now.");
          }
        });
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

    if (!mapRef.current) {
      setStatusMessage("Google Maps is still loading.");
      return;
    }

    const trimmed = searchAddress.trim();

    if (!trimmed) {
      setStatusMessage("Enter an address to search.");
      return;
    }

    setStatusMessage("Searching address...");

    void searchAddressFree(trimmed)
      .then((match) => {
        if (!match) {
          setStatusMessage("Address not found. Try a more precise search.");
          return;
        }

        const nextLat = match.latitude;
        const nextLng = match.longitude;
        const refinedLocation = match.label || trimmed;
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
        setDraftLocation(refinedLocation);
        setSearchAddress(refinedLocation);
        setStatusMessage("Address found. Drag the pin if you need to fine-tune it.");
      })
      .catch(() => {
        setStatusMessage("Address search is unavailable right now.");
      });
  }

  function handleConfirm() {
    onChange({
      location:
        draftLocation.trim() ||
        searchAddress.trim() ||
        formatDisplayLocation({
          latitude: draftLatitude,
          longitude: draftLongitude,
        }),
      latitude: draftLatitude,
      longitude: draftLongitude,
    });
    setOpen(false);
  }

  const selectedAddressLabel =
    formatDisplayLocation({
      location,
      latitude,
      longitude,
      fallbackLabel: "No location selected yet",
    });

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
          {latitude != null && longitude != null
            ? "Map pin selected"
            : "No exact map pin selected yet"}
        </p>
        {!googleMapsApiKey ? (
          <p className="text-xs text-[var(--brand-strong)]">
            Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable the Google Maps picker.
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[1.9rem] border border-[var(--line)] bg-white shadow-[0_40px_100px_rgba(15,23,42,0.18)]">
            <div className="border-b border-[var(--line)] bg-[radial-gradient(circle_at_top_left,rgba(109,70,255,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,1))] px-5 py-5">
              <div>
                <p className="section-eyebrow">Location picker</p>
                <h3 className="mt-1 text-[1.45rem] font-black text-[var(--foreground)]">
                  Pick the exact listing location
                </h3>
                <p className="mt-2 max-w-[34rem] text-sm text-[var(--muted)]">
                  Search an address, click on the map, or drag the pin to the exact spot.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 rounded-full border border-[var(--line)] bg-white/90 p-3 text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
              aria-label="Close location picker"
            >
              <XIcon />
            </button>

            <div className="grid gap-4 px-5 py-4 lg:grid-cols-[320px,minmax(0,1fr)]">
              <div className="grid gap-4">
                <form onSubmit={handleSearchSubmit} className="grid gap-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold">Search address</span>
                    <div className="flex items-center gap-3 rounded-[1.1rem] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                      <SearchIcon />
                      <input
                        value={searchAddress}
                        onChange={(event) => setSearchAddress(event.target.value)}
                        placeholder="Search by address or area"
                        className="w-full border-0 bg-transparent text-sm outline-none"
                      />
                    </div>
                  </label>
                  <button className="action-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold">
                    <SearchIcon />
                    Search address
                  </button>
                </form>

                <div className="grid gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
                  <div>
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      Selected address
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {draftLocation.trim() || "No address chosen yet."}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3">
                      <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                        Latitude
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                        {draftLatitude != null ? draftLatitude.toFixed(5) : "Not set"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-3">
                      <p className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-[var(--muted)]">
                        Longitude
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                        {draftLongitude != null ? draftLongitude.toFixed(5) : "Not set"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--foreground)]">
                    {draftLatitude != null && draftLongitude != null
                      ? "Exact map pin selected"
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

              <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
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
