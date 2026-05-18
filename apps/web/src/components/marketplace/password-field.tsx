"use client";

import { useState, type ChangeEvent } from "react";

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  placeholder?: string;
  error?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function PasswordField({
  label,
  name,
  autoComplete,
  placeholder,
  error,
  value,
  onChange,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="space-y-2">
      <span className="text-sm font-bold text-[var(--foreground)]">{label}</span>
      <span className="relative block">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="surface-input w-full pr-20 text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 min-w-14 -translate-y-1/2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)]"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </label>
  );
}
