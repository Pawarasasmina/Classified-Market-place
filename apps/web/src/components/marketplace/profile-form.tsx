"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import {
  changePasswordAction,
  deactivateAccountAction,
  resendEmailVerificationAction,
  updateProfileAction,
} from "@/app/(main)/actions";
import { PasswordField } from "@/components/marketplace/password-field";
import { PasswordStrengthMeter } from "@/components/marketplace/password-strength-meter";
import { type FormActionState, type SessionUser } from "@/lib/marketplace";

const initialState: FormActionState = {
  message: null,
};

function VerificationBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`rounded-md px-3 py-1.5 text-xs font-black ${
        verified
          ? "bg-[rgba(31,107,90,0.12)] text-[var(--success)]"
          : "bg-[#fff3ef] text-[#9f321e]"
      }`}
    >
      {verified ? "Verified" : "Not verified"}
    </span>
  );
}

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
  const nameParts = user.displayName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const displayName = `${firstName} ${lastName}`.trim();

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
    <form action={formAction} className="profile-settings-form">
      <input type="hidden" name="avatarUrl" value={avatarUrl} readOnly />
      <input type="hidden" name="displayName" value={displayName} readOnly />

      <section className="profile-settings-card profile-settings-identity-card">
        <div className="profile-settings-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="profile-settings-identity-copy">
          <h2>{displayName || user.displayName}</h2>
          <p>Joined marketplace account</p>
          <label className="profile-settings-avatar-button">
            Edit photo
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void handleAvatarChange(event)}
              className="hidden"
            />
          </label>
        </div>
      </section>

      <section className="profile-settings-section">
        <div className="profile-settings-section-copy">
          <h3>Profile Name</h3>
          <p>This is displayed on your profile.</p>
        </div>
        <div className="profile-settings-fields">
          <label className="profile-settings-field">
            <span>First Name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="surface-input"
            />
          </label>
          <label className="profile-settings-field">
            <span>Last Name</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="surface-input"
            />
          </label>
          {state.fieldErrors?.displayName ? (
            <p className="profile-settings-error">
              {state.fieldErrors.displayName}
            </p>
          ) : null}
        </div>
      </section>

      <section className="profile-settings-section">
        <div className="profile-settings-section-copy">
          <h3>Account details</h3>
          <p>This is not visible to other users.</p>
        </div>
        <div className="profile-settings-fields">
          <label className="profile-settings-field">
            <span className="profile-settings-label-row">
              Email address
              <VerificationBadge verified={user.emailVerified} />
            </span>
            <input
              value={user.email}
              readOnly
              aria-readonly="true"
              className="surface-input profile-settings-readonly"
            />
            <em>Email is used for login and cannot be changed here.</em>
          </label>

          <label className="profile-settings-field">
            <span className="profile-settings-label-row">
            Mobile number
            <VerificationBadge verified={user.phoneVerified} />
          </span>
          <input
            name="phone"
            defaultValue={user.phone ?? ""}
            placeholder="+971551234567"
              className="surface-input"
          />
            <em>Use international format. Example: +971551234567.</em>
          {state.fieldErrors?.phone ? (
              <p className="profile-settings-error">{state.fieldErrors.phone}</p>
          ) : null}
        </label>

          <label className="profile-settings-field">
            <span>Location</span>
          <input
            name="location"
            defaultValue={user.location ?? ""}
            placeholder="Dubai"
              className="surface-input"
          />
        </label>
        </div>
      </section>

      <section className="profile-settings-section">
        <div className="profile-settings-section-copy">
          <h3>Public profile</h3>
          <p>This helps buyers understand who they are contacting.</p>
        </div>
        <div className="profile-settings-fields">
          <label className="profile-settings-field">
            <span>Bio</span>
            <textarea
              name="bio"
              defaultValue={user.bio ?? ""}
              className="surface-input"
              placeholder="Short public marketplace bio"
            />
          </label>
        </div>
      </section>

      <div className="profile-settings-save-row">
        <button
          type="submit"
          disabled={pending}
          className="profile-settings-save-button disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save Changes"}
        </button>
        {state.message ? (
          <p className="profile-settings-form-message">{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}

export function PhoneVerificationPanel({
  phone,
  verified,
}: {
  phone: string | null;
  verified: boolean;
}) {
  return (
    <div className="panel grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">Mobile verification</p>
          <h2 className="mt-2 text-2xl font-black">
            {verified ? "Mobile number verified" : "Verify your mobile number"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {phone
              ? `Current mobile number: ${phone}`
              : "Add a mobile number in your profile first."}
          </p>
        </div>
        <VerificationBadge verified={verified} />
      </div>

      {!verified ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/verify?next=/profile"
            className={`action-primary px-5 py-3 text-sm font-bold ${
              phone ? "" : "pointer-events-none opacity-50"
            }`}
            aria-disabled={!phone}
          >
            Verify mobile number
          </Link>
          <p className="text-sm text-[var(--muted)]">
            You need a verified mobile number before posting listings or messaging
            sellers.
          </p>
        </div>
      ) : (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          This number is verified. If you change it, verification will be required
          again.
        </p>
      )}
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState
  );
  const [newPassword, setNewPassword] = useState("");

  return (
    <form action={formAction} className="panel grid gap-5">
      <div>
        <p className="section-eyebrow">Account security</p>
        <h2 className="mt-2 text-2xl font-black">Change password</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Google-only accounts can set a password here. Password accounts must
          enter the current password first.
        </p>
      </div>

      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        placeholder="Required if you already use a password"
        error={state.fieldErrors?.currentPassword}
      />

      <div className="grid gap-2">
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          placeholder="Choose a new password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={state.fieldErrors?.newPassword}
        />
        <PasswordStrengthMeter password={newPassword} />
      </div>

      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="Confirm your new password"
        error={state.fieldErrors?.confirmPassword}
      />

      {state.message ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="action-primary w-fit px-5 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

export function EmailVerificationPanel({ verified }: { verified: boolean }) {
  const [state, formAction, pending] = useActionState(
    resendEmailVerificationAction,
    initialState
  );

  return (
    <form action={formAction} className="panel grid gap-4">
      <div>
        <p className="section-eyebrow">Email verification</p>
        <h2 className="mt-2 text-2xl font-black">
          {verified ? "Email verified" : "Verify your email"}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {verified
            ? "Your email address is verified."
            : "We will send a verification link to your email. Dev mode also shows the link directly."}
        </p>
      </div>

      {!verified ? (
        <button
          type="submit"
          disabled={pending}
          className="action-secondary w-fit px-5 py-3 text-sm font-bold disabled:opacity-60"
        >
          {pending ? "Sending..." : "Resend verification email"}
        </button>
      ) : null}

      {state.message ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function PublicEmailVerificationPanel({
  email,
}: {
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    resendEmailVerificationAction,
    initialState
  );

  return (
    <form action={formAction} className="panel grid gap-4">
      <input type="hidden" name="email" value={email} />
      <div>
        <p className="section-eyebrow">Email verification</p>
        <h2 className="mt-2 text-2xl font-black">Need a new verification link?</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          We can resend a fresh verification email
          {email ? ` to ${email}` : ""}. Dev mode also shows the link directly.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="action-secondary w-fit px-5 py-3 text-sm font-bold disabled:opacity-60"
      >
        {pending ? "Sending..." : "Resend verification email"}
      </button>

      {state.message ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function DeactivateAccountForm() {
  return (
    <form action={deactivateAccountAction} className="panel grid gap-4">
      <div>
        <p className="section-eyebrow">Account status</p>
        <h2 className="mt-2 text-2xl font-black">Deactivate account</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This signs you out, disables future logins, and keeps existing marketplace
          records for audit and conversation history.
        </p>
      </div>
      <button
        type="submit"
        className="profile-settings-danger-button"
      >
        Deactivate my account
      </button>
    </form>
  );
}
