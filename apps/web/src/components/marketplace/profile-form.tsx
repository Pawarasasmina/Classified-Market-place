"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { updateProfileAction } from "@/app/(main)/actions";
import { type FormActionState, type SessionUser } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ProfileForm({ user }: { user: SessionUser }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState
  );
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }

    setAvatarUrl(await readFileAsDataUrl(file));
    event.target.value = "";
  }

  return (
    <form action={formAction} className="panel grid gap-5">
      <input type="hidden" name="avatarUrl" value={avatarUrl} readOnly />

      <div>
        <p className="section-eyebrow">Public seller profile</p>
        <h2 className="mt-2 text-2xl font-black">Keep buyer-facing details current.</h2>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-white text-xl font-black">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            user.displayName.charAt(0).toUpperCase()
          )}
        </div>
        <label className="action-secondary cursor-pointer px-4 py-2 text-sm font-bold">
          Upload avatar
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void handleAvatarChange(event)}
            className="hidden"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-bold">Display name</span>
        <input
          name="displayName"
          defaultValue={user.displayName}
          className="surface-input w-full text-sm"
        />
        {state.fieldErrors?.displayName ? (
          <p className="text-sm text-red-700">{state.fieldErrors.displayName}</p>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-bold">Phone</span>
          <input
            name="phone"
            defaultValue={user.phone ?? ""}
            placeholder="+971551234567"
            className="surface-input w-full text-sm"
          />
          {state.fieldErrors?.phone ? (
            <p className="text-sm text-red-700">{state.fieldErrors.phone}</p>
          ) : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-bold">Location</span>
          <input
            name="location"
            defaultValue={user.location ?? ""}
            placeholder="Dubai"
            className="surface-input w-full text-sm"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-bold">Bio</span>
        <textarea
          name="bio"
          defaultValue={user.bio ?? ""}
          className="surface-input min-h-28 w-full text-sm"
          placeholder="Short public seller bio"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="action-primary px-5 py-3 text-sm font-bold disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save profile"}
        </button>
        {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
      </div>
    </form>
  );
}
