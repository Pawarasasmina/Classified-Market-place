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
    <form action={formAction} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5">
      <input type="hidden" name="avatarUrl" value={avatarUrl} readOnly />

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-bold">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            user.displayName.charAt(0).toUpperCase()
          )}
        </div>
        <label className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
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
        <span className="text-sm font-semibold">Display name</span>
        <input
          name="displayName"
          defaultValue={user.displayName}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.displayName ? (
          <p className="text-sm text-red-700">{state.fieldErrors.displayName}</p>
        ) : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold">Phone</span>
          <input
            name="phone"
            defaultValue={user.phone ?? ""}
            placeholder="+971551234567"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {state.fieldErrors?.phone ? (
            <p className="text-sm text-red-700">{state.fieldErrors.phone}</p>
          ) : null}
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Location</span>
          <input
            name="location"
            defaultValue={user.location ?? ""}
            placeholder="Dubai"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold">Bio</span>
        <textarea
          name="bio"
          defaultValue={user.bio ?? ""}
          className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Short public seller bio"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="action-primary px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save profile"}
        </button>
        {state.message ? <p className="text-sm text-slate-600">{state.message}</p> : null}
      </div>
    </form>
  );
}
