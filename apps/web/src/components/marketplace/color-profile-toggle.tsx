"use client";

import { useSyncExternalStore } from "react";

type ColorProfile = "light" | "dark";
type IconProps = {
  className?: string;
};

const storageKey = "smartmarket-color-profile";
const profileChangeEvent = "smartmarket-color-profile-change";

function applyProfile(profile: ColorProfile) {
  document.documentElement.dataset.colorProfile = profile;
  document.documentElement.style.colorScheme = profile;
}

function readStoredProfile() {
  try {
    return window.localStorage.getItem(storageKey) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function getProfileSnapshot(): ColorProfile {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.dataset.colorProfile === "light"
    ? "light"
    : "dark";
}

function getServerProfileSnapshot(): ColorProfile {
  return "dark";
}

function subscribeToProfileChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const syncProfile = () => {
    applyProfile(readStoredProfile());
    onStoreChange();
  };

  window.addEventListener("storage", syncProfile);
  window.addEventListener(profileChangeEvent, syncProfile);

  return () => {
    window.removeEventListener("storage", syncProfile);
    window.removeEventListener(profileChangeEvent, syncProfile);
  };
}

function SunIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
}

export function ColorProfileToggle() {
  const profile = useSyncExternalStore(
    subscribeToProfileChanges,
    getProfileSnapshot,
    getServerProfileSnapshot,
  );
  const dark = profile === "dark";

  function updateProfile(nextProfile: ColorProfile) {
    applyProfile(nextProfile);
    try {
      window.localStorage.setItem(storageKey, nextProfile);
    } catch {
      // The visual change should still work if storage is unavailable.
    }
    window.dispatchEvent(new Event(profileChangeEvent));
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to navy dark theme"}
      onClick={() => updateProfile(dark ? "light" : "dark")}
      className={`color-profile-toggle ${
        dark ? "color-profile-toggle-dark" : "color-profile-toggle-light"
      }`}
    >
      <span className="color-profile-thumb" />
      <span className="color-profile-icon color-profile-icon-sun">
        <SunIcon />
      </span>
      <span className="color-profile-icon color-profile-icon-moon">
        <MoonIcon />
      </span>
    </button>
  );
}
