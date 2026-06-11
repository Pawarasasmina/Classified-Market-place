"use client";

import { useEffect, useId, useState } from "react";
import { deleteAllListingsAction } from "@/app/(main)/actions";
import { AdminSubmitButton } from "@/components/marketplace/admin-form-feedback";

const confirmationText = "DELETE ALL LISTINGS";

export function DeleteAllListingsDialog({ returnTo }: { returnTo: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const titleId = useId();
  const matchesConfirmation = confirmation.trim() === confirmationText;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <section className="panel grid gap-4 border border-[#e7b6a9] bg-[#fff8f5]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[#9f321e]">
            Danger zone
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            Delete all listings
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            This permanently removes every listing from the database. Use this
            only when you need to fully reset marketplace inventory before a
            clean re-import.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-[#e7b6a9] bg-[#9f321e] px-4 py-3 text-sm font-bold text-white hover:bg-[#842716]"
          >
            Delete all listings
          </button>
          <p className="text-xs font-semibold text-[var(--muted)]">
            A confirmation popup will ask you to type the exact phrase before
            continuing.
          </p>
        </div>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(5,10,24,0.72)] p-4 backdrop-blur-sm sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            className="w-full max-w-3xl overflow-hidden rounded-[1.4rem] border border-[rgba(159,50,30,0.22)] bg-[linear-gradient(180deg,rgba(255,252,250,0.99)_0%,rgba(255,247,243,0.98)_100%)] text-[var(--foreground)] shadow-[0_32px_90px_rgba(0,0,0,0.42)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(159,50,30,0.14)] px-5 py-5 sm:px-6">
              <div>
                <span className="inline-flex items-center rounded-full border border-[rgba(159,50,30,0.16)] bg-white/70 px-3 py-1 text-[0.72rem] font-black uppercase tracking-[0.18em] text-[#9f321e]">
                  Danger zone
                </span>
                <h2
                  id={titleId}
                  className="mt-3 text-2xl font-black tracking-[-0.02em] text-[var(--foreground)]"
                >
                  Confirm bulk deletion
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Type <strong>{confirmationText}</strong> to mark every
                  listing for permanent deletion.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[rgba(159,50,30,0.14)] bg-white px-4 text-sm font-bold text-[var(--foreground)] hover:border-[#9f321e] hover:text-[#9f321e]"
                aria-label="Close delete listings dialog"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <form
              action={deleteAllListingsAction}
              className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6"
            >
              <input type="hidden" name="returnTo" value={returnTo} />

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.8fr)]">
                <div className="grid gap-4">
                  <div className="grid gap-3 rounded-2xl border border-[rgba(159,50,30,0.12)] bg-white/80 p-4 shadow-[0_10px_30px_rgba(159,50,30,0.08)]">
                    <h3 className="m-0 text-base font-extrabold text-[var(--foreground)]">
                      Before you continue
                    </h3>
                    <p className="m-0 text-sm leading-6 text-[var(--muted)]">
                      This action affects the whole marketplace inventory. You can
                      re-import listings afterward, but current listings and their
                      linked listing data will be permanently removed immediately.
                    </p>
                  </div>

                  <label className="grid gap-2 rounded-2xl border border-[rgba(159,50,30,0.12)] bg-white/80 p-4 shadow-[0_10px_30px_rgba(159,50,30,0.08)]">
                    <span className="text-sm font-extrabold text-[var(--foreground)]">
                      Type the confirmation phrase
                    </span>
                    <input
                      name="confirmation"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      className="surface-input border-[rgba(159,50,30,0.18)] bg-white"
                      placeholder={confirmationText}
                      autoComplete="off"
                    />
                  </label>
                </div>

                <aside className="grid gap-4">
                  <div className="grid gap-3 rounded-2xl border border-[rgba(159,50,30,0.12)] bg-[#fff2ed] p-4 shadow-[0_10px_30px_rgba(159,50,30,0.08)]">
                    <p className="text-[0.72rem] font-black uppercase tracking-[0.16em] text-[#9f321e]">
                      Action summary
                    </p>
                    <div className="grid gap-3">
                      <div className="grid gap-1">
                        <span className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                          Action
                        </span>
                        <strong className="text-sm font-extrabold text-[var(--foreground)]">
                          Delete all listings
                        </strong>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                          Scope
                        </span>
                        <strong className="text-sm font-extrabold text-[var(--foreground)]">
                          All listings
                        </strong>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                          Mode
                        </span>
                        <strong className="text-sm font-extrabold text-[var(--foreground)]">
                          Permanent delete
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[rgba(159,50,30,0.12)] bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]">
                    This action affects the whole marketplace inventory. You can
                    re-import listings afterward, but current listings and their
                    linked listing data will be permanently removed immediately.
                  </div>
                </aside>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(159,50,30,0.14)] pt-5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(159,50,30,0.14)] bg-white px-5 text-sm font-bold text-[var(--foreground)] hover:border-[#9f321e] hover:text-[#9f321e]"
                >
                  Cancel
                </button>
                <AdminSubmitButton
                  disabled={!matchesConfirmation}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#b54d35] bg-[#9f321e] px-5 text-sm font-black text-white hover:bg-[#842716] disabled:cursor-not-allowed disabled:opacity-60"
                  pendingText="Deleting listings..."
                >
                  Confirm delete all
                </AdminSubmitButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
