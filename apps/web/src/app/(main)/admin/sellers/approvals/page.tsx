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
import type { ApiSellerProfile } from "@/lib/marketplace";

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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getSellerTimelineLabel(seller: ApiSellerProfile) {
  if (seller.status === "APPROVED") {
    return `Approved ${formatDateTime(
      seller.approvedAt ?? seller.reviewedAt ?? seller.submittedAt,
    )}`;
  }

  if (seller.status === "REJECTED") {
    return `Declined ${formatDateTime(
      seller.rejectedAt ?? seller.reviewedAt ?? seller.submittedAt,
    )}`;
  }

  if (seller.status === "SUSPENDED") {
    return `Suspended ${formatDateTime(
      seller.reviewedAt ?? seller.submittedAt ?? seller.requestedAt,
    )}`;
  }

  return `Requested ${formatDateTime(
    seller.submittedAt ?? seller.requestedAt ?? seller.reviewedAt,
  )}`;
}

function getPendingDocumentCount(seller: ApiSellerProfile) {
  return (
    seller.documentSubmissions?.filter(
      (submission) =>
        submission.status === "REQUESTED" || submission.status === "SUBMITTED",
    ).length ?? 0
  );
}

function SellerStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "pending" | "approved" | "rejected" | "neutral";
}) {
  const toneClass =
    tone === "approved"
      ? "border border-emerald-400/20 bg-emerald-500/12 text-[var(--foreground)]"
      : tone === "rejected"
        ? "border border-rose-400/20 bg-rose-500/12 text-[var(--foreground)]"
        : tone === "pending"
          ? "border border-amber-400/20 bg-amber-500/12 text-[var(--foreground)]"
          : "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]";

  return (
    <span
      className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function SellerAnswers({ seller }: { seller: ApiSellerProfile }) {
  if (!seller.formDefinition?.fields?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--muted)]">
        Seller profile answers
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {seller.formDefinition.fields.map((field) => (
          <div
            key={field.key}
            className="rounded-2xl border border-[var(--line)] bg-white p-3"
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
  );
}

function SellerDocumentReviews({ seller }: { seller: ApiSellerProfile }) {
  if (!seller.documentSubmissions?.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {seller.documentSubmissions.map((submission) => (
        <form
          key={submission.id}
          action={reviewSellerDocumentAction}
          className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4"
        >
          <input type="hidden" name="returnTo" value="/admin/sellers/approvals" />
          <input
            type="hidden"
            name="documentSubmissionId"
            value={submission.id}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[var(--foreground)]">
                Document submission
              </p>
              <p className="text-sm text-[var(--muted)]">
                Request {submission.requestId ?? submission.id} / Submitted{" "}
                {formatDateTime(submission.submittedAt)}
              </p>
            </div>
            <SellerStatusBadge
              label={submission.status}
              tone={
                submission.status === "APPROVED"
                  ? "approved"
                  : submission.status === "REJECTED"
                    ? "rejected"
                    : "pending"
              }
            />
          </div>
          {submission.answers && Object.keys(submission.answers).length ? (
            <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-3 text-sm">
              <p className="font-bold text-[var(--foreground)]">
                Submitted answers
              </p>
              {Object.entries(submission.answers).map(([key, value]) => (
                <div key={key}>
                  <span className="font-semibold text-[var(--muted)]">{key}:</span>{" "}
                  <span>{formatAnswerValue(value)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {submission.files?.length ? (
            <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-3 text-sm">
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
          <div className="grid gap-3 md:grid-cols-2">
            <select
              name="status"
              defaultValue={
                submission.status === "APPROVED" ||
                submission.status === "REJECTED"
                  ? submission.status
                  : "APPROVED"
              }
              className="surface-input w-full text-sm"
            >
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
            <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
              Reviewed: {formatDateTime(submission.reviewedAt)}
            </div>
            <textarea
              name="reviewNotes"
              defaultValue={submission.reviewNotes ?? ""}
              rows={3}
              className="surface-input min-h-24 w-full text-sm md:col-span-2"
              placeholder="Document review notes"
            />
            <textarea
              name="rejectionReason"
              defaultValue={submission.rejectionReason ?? ""}
              rows={3}
              className="surface-input min-h-24 w-full text-sm md:col-span-2"
              placeholder="Reason if document is rejected"
            />
          </div>
          <button className="action-secondary px-4 py-3 text-sm font-bold">
            Review document
          </button>
        </form>
      ))}
    </div>
  );
}

function SellerPendingCard({
  seller,
  tiers,
}: {
  seller: ApiSellerProfile;
  tiers: Awaited<ReturnType<typeof fetchAdminSellerPrivileges>>;
}) {
  const pendingDocuments = getPendingDocumentCount(seller);

  return (
    <article className="panel grid gap-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
            Pending review
          </p>
          <h2 className="mt-2 text-2xl font-black">{seller.user.displayName}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {seller.user.email}
            {seller.user.phone ? ` / ${seller.user.phone}` : ""}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {getSellerTimelineLabel(seller)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SellerStatusBadge label={seller.status} tone="pending" />
          <SellerStatusBadge
            label={`Verified ${seller.verifiedSellerStatus}`}
            tone="neutral"
          />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Listings", seller.stats?.totalListings ?? 0],
          ["Active", seller.stats?.activeListings ?? 0],
          ["Pending", seller.stats?.pendingListings ?? 0],
          ["Sold", seller.stats?.soldListings ?? 0],
          ["Offers", seller.stats?.offers ?? 0],
          ["Docs waiting", pendingDocuments],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4"
          >
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      {(seller.missingRequiredFields?.length ||
        seller.unresolvedRequiredDocuments?.length) && (
        <section className="grid gap-3 xl:grid-cols-2">
          {seller.missingRequiredFields?.length ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--foreground)]">
                Missing required fields
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {seller.missingRequiredFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-amber-300/30 px-3 py-1 text-xs font-bold text-[var(--foreground)]"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {seller.unresolvedRequiredDocuments?.length ? (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--foreground)]">
                Required documents unresolved
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {seller.unresolvedRequiredDocuments.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-rose-300/30 px-3 py-1 text-xs font-bold text-[var(--foreground)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      <SellerAnswers seller={seller} />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <form
          action={reviewSellerProfileAction}
          className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4"
        >
          <input type="hidden" name="returnTo" value="/admin/sellers/approvals" />
          <input type="hidden" name="sellerProfileId" value={seller.id} />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--muted)]">
              Review decision
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Approve, reject, or suspend this seller request with clear notes.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              name="status"
              defaultValue={seller.status === "PENDING" ? "APPROVED" : seller.status}
              className="surface-input w-full text-sm"
            >
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
          </div>
          <textarea
            name="reviewNotes"
            defaultValue={seller.reviewNotes ?? ""}
            rows={3}
            placeholder="Approval or moderation notes"
            className="surface-input min-h-24 w-full text-sm"
          />
          <textarea
            name="rejectionReason"
            defaultValue={seller.rejectionReason ?? ""}
            rows={3}
            placeholder="Reason if this request is declined"
            className="surface-input min-h-24 w-full text-sm"
          />
          <button className="action-primary px-4 py-3 text-sm font-bold">
            Save seller decision
          </button>
        </form>

        <form
          action={createSellerDocumentRequestAction}
          className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4"
        >
          <input type="hidden" name="returnTo" value="/admin/sellers/approvals" />
          <input type="hidden" name="sellerProfileId" value={seller.id} />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[var(--muted)]">
              Request more documents
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ask for missing business or identity documents before approval.
            </p>
          </div>
          <input
            name="label"
            placeholder="Request document label"
            className="surface-input w-full text-sm"
          />
          <input
            name="slug"
            placeholder="Slug (optional)"
            className="surface-input w-full text-sm"
          />
          <input
            name="description"
            placeholder="Description"
            className="surface-input w-full text-sm"
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="isRequired"
              value="true"
              defaultChecked
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Required document
          </label>
          <button className="action-secondary px-4 py-3 text-sm font-bold">
            Send document request
          </button>
        </form>
      </div>

      <SellerDocumentReviews seller={seller} />
    </article>
  );
}

function SellerHistoryCard({
  seller,
  tone,
}: {
  seller: ApiSellerProfile;
  tone: "approved" | "rejected";
}) {
  const badgeTone = tone === "approved" ? "approved" : "rejected";

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{seller.user.displayName}</h3>
          <p className="text-sm text-[var(--muted)]">{seller.user.email}</p>
        </div>
        <SellerStatusBadge label={seller.status} tone={badgeTone} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
        <p>{getSellerTimelineLabel(seller)}</p>
        <p>
          Tier:{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {seller.privilegeTier?.name ?? "Default tier"}
          </span>
        </p>
        <p>
          Listings:{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {seller.stats?.totalListings ?? 0}
          </span>
        </p>
        {seller.reviewNotes ? (
          <p>
            Notes:{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {seller.reviewNotes}
            </span>
          </p>
        ) : null}
        {seller.rejectionReason ? (
          <p>
            Decline reason:{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {seller.rejectionReason}
            </span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default async function AdminSellerApprovalsPage() {
  const { accessToken } = await requireSessionContext("/admin/sellers/approvals");
  const [sellers, tiers] = await Promise.all([
    fetchAdminSellerProfiles(accessToken, { take: 100 }),
    fetchAdminSellerPrivileges(accessToken),
  ]);

  const pendingSellers = sellers
    .filter((seller) => seller.status === "PENDING")
    .sort((first, second) =>
      (second.submittedAt ?? second.requestedAt ?? "").localeCompare(
        first.submittedAt ?? first.requestedAt ?? "",
      ),
    );
  const approvedSellers = sellers
    .filter((seller) => seller.status === "APPROVED")
    .sort((first, second) =>
      (second.approvedAt ?? second.reviewedAt ?? "").localeCompare(
        first.approvedAt ?? first.reviewedAt ?? "",
      ),
    );
  const rejectedSellers = sellers
    .filter((seller) => seller.status === "REJECTED")
    .sort((first, second) =>
      (second.rejectedAt ?? second.reviewedAt ?? "").localeCompare(
        first.rejectedAt ?? first.reviewedAt ?? "",
      ),
    );

  return (
    <div className="page admin-dashboard grid gap-6">
      <div className="panel-dark grid gap-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-eyebrow">Seller Operations</p>
            <h1 className="mt-2 text-3xl font-black text-[var(--foreground)]">
              Seller approvals
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review current seller profile requests, manage supporting
              documents, and keep a visible history of approved and declined
              decisions.
            </p>
          </div>
        </div>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pending requests", pendingSellers.length],
            ["Approved history", approvedSellers.length],
            ["Declined history", rejectedSellers.length],
            [
              "Docs waiting",
              sellers.reduce(
                (total, seller) => total + getPendingDocumentCount(seller),
                0,
              ),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4"
            >
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-3xl font-black text-[var(--foreground)]">
                {value}
              </p>
            </div>
          ))}
        </section>
      </div>

      <section className="grid gap-4">
        <div className="panel flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--brand-strong)]">
              Current requests
            </p>
            <h2 className="mt-2 text-2xl font-black">Pending seller reviews</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Focus on active requests first, review their answers, request
              missing documents, and record the approval decision.
            </p>
          </div>
          <div className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--muted)]">
            {pendingSellers.length} pending
          </div>
        </div>
        {pendingSellers.length ? (
          pendingSellers.map((seller) => (
            <SellerPendingCard key={seller.id} seller={seller} tiers={tiers} />
          ))
        ) : (
          <div className="panel text-sm text-[var(--muted)]">
            No seller requests are waiting for approval right now.
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel grid gap-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--foreground)]">
                Past decisions
              </p>
              <h2 className="mt-2 text-2xl font-black">Approved sellers</h2>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-[var(--foreground)]">
              {approvedSellers.length} approved
            </div>
          </div>
          <div className="grid gap-3">
            {approvedSellers.length ? (
              approvedSellers.map((seller) => (
                <SellerHistoryCard
                  key={seller.id}
                  seller={seller}
                  tone="approved"
                />
              ))
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
                No approved seller requests yet.
              </div>
            )}
          </div>
        </div>

        <div className="panel grid gap-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--foreground)]">
                Past decisions
              </p>
              <h2 className="mt-2 text-2xl font-black">Declined sellers</h2>
            </div>
            <div className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-bold text-[var(--foreground)]">
              {rejectedSellers.length} declined
            </div>
          </div>
          <div className="grid gap-3">
            {rejectedSellers.length ? (
              rejectedSellers.map((seller) => (
                <SellerHistoryCard
                  key={seller.id}
                  seller={seller}
                  tone="rejected"
                />
              ))
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
                No declined seller requests yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
