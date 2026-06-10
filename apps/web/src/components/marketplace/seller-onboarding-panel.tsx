import {
  requestVerifiedSellerAction,
  saveSellerProfileAction,
  submitSellerDocumentAction,
  submitSellerProfileAction,
  switchToSellerAction,
} from "@/app/(main)/actions";
import { SellerFormFields } from "@/components/marketplace/seller-form-fields";
import type { ApiSellerProfileEnvelope } from "@/lib/marketplace";

function statusCopy(status: string | null | undefined) {
  switch (status) {
    case "PENDING":
      return "Your seller profile is waiting for admin review.";
    case "APPROVED":
      return "Your seller profile is approved and ready for marketplace posting.";
    case "REJECTED":
      return "Your seller profile needs updates before it can be approved again.";
    case "SUSPENDED":
      return "Your seller profile is suspended. Contact support or review the admin note below.";
    default:
      return "Complete your seller profile to unlock listing tools.";
  }
}

export function SellerOnboardingPanel({
  envelope,
  returnTo,
  title = "Seller onboarding",
}: {
  envelope: ApiSellerProfileEnvelope;
  returnTo: string;
  title?: string;
}) {
  const profile = envelope.sellerProfile;

  if (!profile) {
    return (
      <section className="panel grid gap-4">
        <div>
          <p className="section-eyebrow">Become a seller</p>
          <h2 className="mt-2 text-2xl font-black">{title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Switch your account into seller mode, complete onboarding, and wait
            for admin approval before posting listings.
          </p>
        </div>
        <form action={switchToSellerAction}>
          <button className="action-primary px-4 py-3 text-sm font-bold">
            Start seller onboarding
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="panel grid gap-3">
        <div>
          <p className="section-eyebrow">Seller profile</p>
          <h2 className="mt-2 text-2xl font-black">{title}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {statusCopy(profile.status)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
          <span className="rounded-md bg-[var(--brand-soft)] px-3 py-2 text-[var(--brand-strong)]">
            {profile.status}
          </span>
          <span className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-[var(--muted)]">
            Verified seller: {profile.verifiedSellerStatus}
          </span>
          {profile.privilegeTier ? (
            <span className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent-strong)]">
              Tier: {profile.privilegeTier.name}
            </span>
          ) : null}
        </div>
        {profile.reviewNotes ? (
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
            <p className="font-bold text-[var(--foreground)]">Admin notes</p>
            <p className="mt-2">{profile.reviewNotes}</p>
          </div>
        ) : null}
        {profile.missingRequiredFields?.length ? (
          <div className="rounded-md border border-[rgba(185,56,32,0.2)] bg-[rgba(255,243,240,0.8)] p-4 text-sm text-[#8f2e1c]">
            Missing required fields: {profile.missingRequiredFields.join(", ")}
          </div>
        ) : null}
        {profile.unresolvedRequiredDocuments?.length ? (
          <div className="rounded-md border border-[rgba(185,56,32,0.2)] bg-[rgba(255,243,240,0.8)] p-4 text-sm text-[#8f2e1c]">
            Pending required documents:{" "}
            {profile.unresolvedRequiredDocuments.join(", ")}
          </div>
        ) : null}
      </div>

      <form action={saveSellerProfileAction} className="panel grid gap-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <p className="section-eyebrow">Seller details</p>
          <h3 className="mt-2 text-xl font-black">Profile answers</h3>
        </div>
        <SellerFormFields
          fields={envelope.formDefinition.fields}
          answers={profile.formAnswers ?? {}}
        />
        <div className="flex flex-wrap gap-3">
          <button className="action-secondary px-4 py-3 text-sm font-bold">
            Save seller draft
          </button>
        </div>
      </form>

      <form action={submitSellerProfileAction} className="panel grid gap-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <SellerFormFields
          fields={envelope.formDefinition.fields}
          answers={profile.formAnswers ?? {}}
        />
        <button className="action-primary px-4 py-3 text-sm font-bold">
          Submit for admin review
        </button>
      </form>

      {profile.documentRequests?.length ? (
        <div className="panel grid gap-4">
          <div>
            <p className="section-eyebrow">Requested documents</p>
            <h3 className="mt-2 text-xl font-black">Upload requested files</h3>
          </div>
          {profile.documentRequests.map((request) => (
            <form
              key={request.id}
              action={submitSellerDocumentAction}
              className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
            >
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="requestId" value={request.id} />
              <div>
                <p className="font-bold">{request.label}</p>
                {request.description ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {request.description}
                  </p>
                ) : null}
              </div>
              <input
                type="file"
                name={`sellerFile:${request.slug}`}
                className="surface-input w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:font-bold file:text-white"
              />
              <button className="action-secondary px-4 py-3 text-sm font-bold">
                Submit document
              </button>
            </form>
          ))}
        </div>
      ) : null}

      {profile.status === "APPROVED" ? (
        <form action={requestVerifiedSellerAction} className="panel grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div>
            <p className="section-eyebrow">Verified seller</p>
            <h3 className="mt-2 text-xl font-black">Request verification</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ask admins to grant the public verified seller badge.
            </p>
          </div>
          <textarea
            name="reviewNotes"
            rows={4}
            className="surface-input min-h-24 w-full text-sm"
            placeholder="Add supporting notes for the admin team"
          />
          <button className="action-primary px-4 py-3 text-sm font-bold">
            Request verified seller status
          </button>
        </form>
      ) : null}
    </section>
  );
}
