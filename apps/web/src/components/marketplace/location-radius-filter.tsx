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
import {
  reverseGeocodeFree,
  searchAddressFree,
} from "@/lib/openstreetmap-geocoding";

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

type SearchMatch = {
  latitude: number;
  longitude: number;
  label: string;
};

const radiusOptions = [1, 2, 5, 10, 15, 20, 40, 60, 100, 250];
const minRadius = radiusOptions[0];
const maxRadius = radiusOptions[radiusOptions.length - 1];

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

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}

export function LocationRadiusFilter({
  value,
  onApply,
}: LocationRadiusFilterProps) {
  const googleWindow =
    typeof window === "undefined"
      ? undefined
      : (window as GoogleMapsWindow);
  const canUseInteractiveMap = Boolean(googleMapsApiKey);
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
  const radiusProgressPercent =
    ((draftRadius - minRadius) / (maxRadius - minRadius)) * 100;

  useBodyScrollLock(open);

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

  async function resolveAddressSearch(address: string): Promise<SearchMatch | null> {
    const trimmed = address.trim();

    if (!trimmed) {
      return null;
    }

    const geocoder = geocoderRef.current;

    if (geocoder) {
      const googleMatch = await new Promise<SearchMatch | null>((resolve) => {
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
              resolve(null);
              return;
            }

            resolve({
              latitude: point.lat(),
              longitude: point.lng(),
              label:
                formatCompactGeocodeLabel(match) ||
                match.formatted_address ||
                trimmed,
            });
          },
        );
      });

      if (googleMatch) {
        return googleMatch;
      }
    }

    return searchAddressFree(trimmed);
  }

  async function resolveReverseGeocode(latitude: number, longitude: number) {
    const geocoder = geocoderRef.current;

    if (geocoder) {
      const googleLabel = await new Promise<string>((resolve) => {
        geocoder.geocode(
          { location: { lat: latitude, lng: longitude } },
          (
            results: Array<{
              formatted_address?: string;
              address_components?: Array<{
                long_name?: string;
                short_name?: string;
                types?: string[];
              }>;
            }> = [],
            status: string,
          ) => {
            const refinedLocation = formatCompactGeocodeLabel(results[0]);
            resolve(status === "OK" ? refinedLocation : "");
          },
        );
      });

      if (googleLabel) {
        return googleLabel;
      }
    }

    return reverseGeocodeFree(latitude, longitude);
  }

  useEffect(() => {
    if (!open || !canUseInteractiveMap) {
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
          strokeColor: "#5fa8ff",
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: "#2176ff",
          fillOpacity: 0.16,
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

          if (typeof nextLat !== "number" || typeof nextLng !== "number") {
            return;
          }

          setDraftLatitude(nextLat);
          setDraftLongitude(nextLng);
          updateCircle(map, nextLat, nextLng, draftRadius);
          setStatusMessage("Refining the pinned location...");

          void resolveReverseGeocode(nextLat, nextLng)
            .then((refinedLocation) => {
              if (cancelled) {
                return;
              }

              if (refinedLocation) {
                setDraftLocation(refinedLocation);
                setSearchAddress(refinedLocation);
                setStatusMessage("Exact location and radius updated.");
                return;
              }

              setStatusMessage("Pin updated. Address label could not be refined.");
            })
            .catch(() => {
              if (!cancelled) {
                setStatusMessage("Pin updated. Address label could not be refined.");
              }
            });
        });
      } else {
        markerRef.current.setPosition(point);
      }

      markerRef.current?.setMap(map);
      markerRef.current?.setVisible(true);
      updateCircle(map, lat, lng, draftRadius);

      if (fitRadius && circleRef.current?.getBounds?.()) {
        map.fitBounds(circleRef.current.getBounds(), 48);
        return;
      }

      if (pan) {
        map.panTo(point);
      }
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
            setStatusMessage("Refining the pinned location...");

            void resolveReverseGeocode(nextLat, nextLng)
              .then((refinedLocation) => {
                if (cancelled) {
                  return;
                }

                if (refinedLocation) {
                  setDraftLocation(refinedLocation);
                  setSearchAddress(refinedLocation);
                  setStatusMessage("Exact location and radius updated.");
                  return;
                }

                setStatusMessage("Pin updated. Address label could not be refined.");
              })
              .catch(() => {
                if (!cancelled) {
                  setStatusMessage("Pin updated. Address label could not be refined.");
                }
              });
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
            setStatusMessage("Refining the pinned location...");

            void resolveReverseGeocode(draftLatitude, draftLongitude)
              .then((refinedLocation) => {
                if (cancelled || !refinedLocation) {
                  return;
                }

                setDraftLocation(refinedLocation);
                setSearchAddress(refinedLocation);
                setStatusMessage(
                  "Adjust the pin or radius to control which listings are included.",
                );
              })
              .catch(() => {
                if (!cancelled) {
                  setStatusMessage(
                    "Adjust the pin or radius to control which listings are included.",
                  );
                }
              });
          } else {
            setStatusMessage(
              "Adjust the pin or radius to control which listings are included.",
            );
          }

          return;
        }

        if (draftLocation.trim()) {
          setStatusMessage("Searching location...");

          void resolveAddressSearch(draftLocation)
            .then((match) => {
              if (cancelled) {
                return;
              }

              if (!match) {
                setStatusMessage(
                  "Search a town, city, or neighbourhood, then adjust the radius.",
                );
                return;
              }

              setDraftLatitude(match.latitude);
              setDraftLongitude(match.longitude);
              setDraftLocation(match.label);
              setSearchAddress(match.label);
              updateMarker(mapRef.current, match.latitude, match.longitude);
              setStatusMessage(
                "Location found. Drag the pin or change the radius to fine-tune it.",
              );
            })
            .catch(() => {
              if (!cancelled) {
                setStatusMessage(
                  "Search a town, city, or neighbourhood, then adjust the radius.",
                );
              }
            });
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
    canUseInteractiveMap,
    draftLatitude,
    draftLocation,
    draftLongitude,
    draftRadius,
    googleWindow,
    open,
  ]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = searchAddress.trim();

    if (!trimmed) {
      setStatusMessage("Enter a location to search.");
      return;
    }

    setStatusMessage("Searching location...");

    void resolveAddressSearch(trimmed)
      .then((match) => {
        if (!match) {
          setStatusMessage("Location not found. Try a more specific search.");
          return;
        }

        setDraftLatitude(match.latitude);
        setDraftLongitude(match.longitude);
        setDraftLocation(match.label);
        setSearchAddress(match.label);

        if (mapRef.current) {
          mapRef.current.panTo({ lat: match.latitude, lng: match.longitude });
          mapRef.current.setZoom(12);
        }

        setStatusMessage(
          "Location found. Drag the pin or change the radius to fine-tune it.",
        );
      })
      .catch(() => {
        setStatusMessage("Location search is unavailable right now.");
      });
  }

  function handleUseCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatusMessage("Current location is not available in this browser.");
      return;
    }

    setStatusMessage("Getting your current location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;

        setDraftLatitude(nextLatitude);
        setDraftLongitude(nextLongitude);
        setStatusMessage("Current location loaded. Refining the address now.");

        if (mapRef.current) {
          mapRef.current.panTo({ lat: nextLatitude, lng: nextLongitude });
          mapRef.current.setZoom(12);
        }

        void resolveReverseGeocode(nextLatitude, nextLongitude)
          .then((refinedLocation) => {
            if (refinedLocation) {
              setDraftLocation(refinedLocation);
              setSearchAddress(refinedLocation);
              setStatusMessage(
                "Current location loaded. Adjust the radius if needed.",
              );
              return;
            }

            setStatusMessage(
              "Current location loaded. Address details could not be refined.",
            );
          })
          .catch(() => {
            setStatusMessage(
              "Current location loaded. Address details could not be refined.",
            );
          });
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
    markerRef.current?.setVisible?.(false);
    circleRef.current?.setMap?.(null);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.58)] p-3 sm:p-4">
          <div className="relative flex max-h-[92vh] w-full max-w-[40rem] flex-col overflow-hidden rounded-[1.7rem] border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] shadow-[0_40px_120px_rgba(15,23,42,0.18)]">
            <div className="border-b border-[var(--line)] bg-[radial-gradient(circle_at_top_left,rgba(109,70,255,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))] px-5 py-5">
              <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[var(--muted)]">
                Search by area
              </p>
              <h2 className="mt-2 text-[1.8rem] font-black tracking-[-0.03em] text-[var(--foreground)]">
                Change location
              </h2>
              <p className="mt-2 max-w-[32rem] text-sm text-[var(--muted)]">
                Pick a place, drop a pin, and choose a search radius. Listings
                inside that circle will be included.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 rounded-full border border-[var(--line)] bg-white/90 p-3 text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
              aria-label="Close location filter"
            >
              <XIcon />
            </button>

            <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4">
              <form onSubmit={handleSearchSubmit} className="grid gap-3">
                <label className="grid gap-2 text-sm text-[var(--muted)]">
                  <span>Search by town, city, neighbourhood or postal code.</span>
                  <div className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center gap-3">
                      <MapPinIcon className="h-5 w-5 text-[var(--muted)]" />
                      <input
                        value={searchAddress}
                        onChange={(event) => setSearchAddress(event.target.value)}
                        placeholder="Search location"
                        className="w-full border-0 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                      />
                    </div>
                  </div>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(109,70,255,0.24)]">
                    <SearchIcon />
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  >
                    <LocateIcon />
                    Use my location
                  </button>
                </div>
              </form>

              <div className="grid gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      Search radius
                    </span>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Drag to widen or narrow the nearby listing area.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-black text-white shadow-[0_10px_24px_rgba(109,70,255,0.22)]">
                    {draftRadius} km
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--line)]" />
                  <div
                    className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,var(--brand),#8ab4ff)]"
                    style={{ width: `${radiusProgressPercent}%` }}
                  />
                  <input
                    type="range"
                    min={minRadius}
                    max={maxRadius}
                    step={1}
                    value={draftRadius}
                    onChange={(event) => setDraftRadius(Number(event.target.value))}
                    className="relative h-6 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_4px_14px_rgba(109,70,255,0.35)] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[var(--line)] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_4px_14px_rgba(109,70,255,0.35)]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
                  <span>{minRadius} km</span>
                  <span>{maxRadius} km</span>
                </div>
              </div>

              {canUseInteractiveMap ? (
                <div className="overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
                        Map selection
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                        {formatDisplayLocation({
                          location: draftLocation,
                          latitude: draftLatitude,
                          longitude: draftLongitude,
                          fallbackLabel: "Search a place or click the map to drop a pin.",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="shrink-0 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                    >
                      Clear
                    </button>
                  </div>
                  <div
                    ref={mapContainerRef}
                    className="h-[21rem] w-full bg-[linear-gradient(135deg,#203442,#0c4a6e)] sm:h-[24rem]"
                  />
                  <div className="grid gap-2 border-t border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
                    {statusMessage ? <p>{statusMessage}</p> : null}
                    {!googleMapsApiKey ? (
                      <p>
                        Google Maps preview is off, so this picker is using the text
                        search fallback for location matching.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-[var(--line)] bg-[var(--surface-strong)] px-5 py-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        Map preview is unavailable
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        You can still search by place name, use your current location,
                        and apply a radius filter. Add
                        ` NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ` later if you want the live
                        map preview here.
                      </p>
                      {statusMessage ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          {statusMessage}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="shrink-0 rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-[var(--line)] bg-[var(--surface)] px-5 py-4">
              <button
                type="button"
                onClick={handleApply}
                className="rounded-xl bg-[var(--brand)] px-5 py-3 text-sm font-black text-white shadow-[0_16px_30px_rgba(109,70,255,0.24)]"
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
