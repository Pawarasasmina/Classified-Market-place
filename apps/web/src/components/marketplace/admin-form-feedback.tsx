"use client";

import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  confirmMessage?: string;
  pendingText?: string;
};

export function AdminSubmitButton({
  children,
  confirmMessage,
  pendingText = "Saving...",
  className = "action-primary px-4 py-3 text-sm font-bold",
  disabled,
  onClick,
  ...props
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick?.(event);
  }

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      onClick={handleClick}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

type AdminActionFeedbackProps = {
  status?: string | null;
  message?: string | null;
  messages?: Record<string, string>;
  successStatuses?: string[];
};

export function AdminActionFeedback({
  status,
  message,
  messages = {},
  successStatuses = ["success", "created", "updated", "deleted", "saved"],
}: AdminActionFeedbackProps) {
  if (!status) {
    return null;
  }

  const isSuccess = successStatuses.includes(status);
  const fallback = isSuccess
    ? "Changes saved."
    : "Could not complete that action. Please try again.";
  const copy = message || messages[status] || fallback;

  return (
    <div
      aria-live="polite"
      className={`rounded-md border px-4 py-3 text-sm font-semibold ${
        isSuccess
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {copy}
    </div>
  );
}
