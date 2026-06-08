import {
  createSellerDocumentRequestAction,
  reviewSellerDocumentAction,
  reviewSellerProfileAction,
} from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminSellerPrivileges,
  fetchAdminSellerProfiles,
} from "@/lib/marketplace-api";

function formatAnswerValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return `${value.length} file${value.length === 1 ? "" : "s"} attached`;
  }

  return "Provided";
}

export default async function AdminSellerApprovalsPage() {
  const { accessToken } = await requireSessionContext("/admin/sellers/approvals");
  const [sellers, tiers] = await Promise.all([
    fetchAdminSellerProfiles(accessToken, { take: 100 }),
    fetchAdminSellerPrivileges(accessToken),
  ]);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller Operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Seller approvals</h1>
      </div>
      {sellers.map((seller) => (
        <div key={seller.id} className="panel grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{seller.user.displayName}</h2>
              <p className="text-sm text-[var(--muted)]">{seller.user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
              <span className="rounded-md bg-[var(--brand-soft)] px-3 py-2 text-[var(--brand-strong)]">
                {seller.status}
              </span>
              <span className="rounded-md bg-[var(--surface-strong)] px-3 py-2 text-[var(--muted)]">
                Verified: {seller.verifiedSellerStatus}
              </span>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-[var(--line)] p-3 text-sm">
              Total listings: {seller.stats?.totalListings ?? 0}
            </div>
            <div className="rounded-md border border-[var(--line)] p-3 text-sm">
              Active: {seller.stats?.activeListings ?? 0}
            </div>
            <div className="rounded-md border border-[var(--line)] p-3 text-sm">
              Pending: {seller.stats?.pendingListings ?? 0}
            </div>
            <div className="rounded-md border border-[var(--line)] p-3 text-sm">
              Offers: {seller.stats?.offers ?? 0}
            </div>
          </div>
          {seller.formDefinition?.fields?.length ? (
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4">
              <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
                Seller profile answers
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {seller.formDefinition.fields.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-md border border-[var(--line)] bg-white p-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                      {field.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {formatAnswerValue(seller.formAnswers?.[field.key])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <form action={reviewSellerProfileAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="returnTo" value="/admin/sellers/approvals" />
            <input type="hidden" name="sellerProfileId" value={seller.id} />
            <select name="status" defaultValue={seller.status} className="surface-input w-full text-sm">
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
            <select
              name="privilegeTierId"
              defaultValue={seller.privilegeTier?.id ?? ""}
              className="surface-input w-full text-sm"
            >
              <option value="">Default tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
            <textarea
              name="reviewNotes"
              defaultValue={seller.reviewNotes ?? ""}
              rows={3}
              placeholder="Admin notes for seller"
              className="surface-input min-h-24 w-full text-sm md:col-span-2"
            />
            <textarea
              name="rejectionReason"
              defaultValue={seller.rejectionReason ?? ""}
              rows={3}
              placeholder="Rejection reason if needed"
              className="surface-input min-h-24 w-full text-sm md:col-span-2"
            />
            <button className="action-primary px-4 py-3 text-sm font-bold md:col-span-2">
              Save review
            </button>
          </form>
          <form action={createSellerDocumentRequestAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="returnTo" value="/admin/sellers/approvals" />
            <input type="hidden" name="sellerProfileId" value={seller.id} />
            <input name="label" placeholder="Request document label" className="surface-input w-full text-sm" />
            <input name="slug" placeholder="Slug (optional)" className="surface-input w-full text-sm" />
            <input name="description" placeholder="Description" className="surface-input w-full text-sm md:col-span-2" />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="isRequired" value="true" defaultChecked className="h-4 w-4 accent-[var(--brand)]" />
              Required document
            </label>
            <button className="action-secondary px-4 py-3 text-sm font-bold">
              Request document
            </button>
          </form>
          {seller.documentSubmissions?.map((submission) => (
            <form
              key={submission.id}
              action={reviewSellerDocumentAction}
              className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4"
            >
              <input type="hidden" name="returnTo" value="/admin/sellers/approvals" />
              <input type="hidden" name="documentSubmissionId" value={submission.id} />
              <div className="text-sm">
                Submission {submission.requestId ?? submission.id} / {submission.status}
              </div>
              {submission.answers && Object.keys(submission.answers).length ? (
                <div className="grid gap-2 rounded-md border border-[var(--line)] bg-white p-3 text-sm">
                  <p className="font-bold text-[var(--foreground)]">
                    Submitted answers
                  </p>
                  {Object.entries(submission.answers).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-semibold text-[var(--muted)]">
                        {key}:
                      </span>{" "}
                      <span>{formatAnswerValue(value)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {submission.files?.length ? (
                <div className="grid gap-2 rounded-md border border-[var(--line)] bg-white p-3 text-sm">
                  <p className="font-bold text-[var(--foreground)]">Submitted files</p>
                  {submission.files.map((file, index) => (
                    <div key={`${submission.id}-file-${index}`}>
                      <span className="font-semibold text-[var(--muted)]">
                        {String(file.fieldKey ?? `file_${index + 1}`)}:
                      </span>{" "}
                      <span>{String(file.name ?? "Uploaded file")}</span>
                      {file.mimeType ? ` / ${String(file.mimeType)}` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
              <select name="status" defaultValue={submission.status} className="surface-input w-full text-sm">
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <textarea name="reviewNotes" defaultValue={submission.reviewNotes ?? ""} rows={3} className="surface-input min-h-24 w-full text-sm" />
              <textarea name="rejectionReason" defaultValue={submission.rejectionReason ?? ""} rows={3} className="surface-input min-h-24 w-full text-sm" />
              <button className="action-secondary px-4 py-3 text-sm font-bold">
                Review document
              </button>
            </form>
          ))}
        </div>
      ))}
    </div>
  );
}
