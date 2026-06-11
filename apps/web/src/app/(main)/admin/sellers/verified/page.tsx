import { reviewVerifiedSellerAction } from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminSellerProfiles } from "@/lib/marketplace-api";

type AdminSellerVerifiedPageProps = {
  searchParams: Promise<{
    message?: string;
    verifiedReview?: string;
  }>;
};

export default async function AdminSellerVerifiedPage(
  props: AdminSellerVerifiedPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/admin/sellers/verified");
  const sellers = await fetchAdminSellerProfiles(accessToken, { take: 100 });
  const visibleSellers = sellers.filter(
    (seller) =>
      seller.verifiedSellerStatus === "REQUESTED" ||
      seller.verifiedSellerStatus === "VERIFIED" ||
      seller.verifiedSellerStatus === "REJECTED",
  );

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Seller operations"
        title="Verified seller queue"
        description="Review verified seller requests and keep verification decisions visible."
        badge={`${visibleSellers.length} in queue`}
      />
      <AdminActionFeedback
        status={searchParams.verifiedReview}
        message={searchParams.message}
        messages={{
          saved: "Verified seller decision saved.",
          invalid: "Choose a seller and verified status before submitting.",
        }}
        successStatuses={["saved"]}
      />
      {visibleSellers.map((seller) => (
          <form key={seller.id} action={reviewVerifiedSellerAction} className="panel grid gap-3">
            <input type="hidden" name="returnTo" value="/admin/sellers/verified" />
            <input type="hidden" name="sellerProfileId" value={seller.id} />
            <div>
              <h2 className="text-xl font-black">{seller.user.displayName}</h2>
              <p className="text-sm text-[var(--muted)]">
                Current verified status: {seller.verifiedSellerStatus}
              </p>
            </div>
            <select
              name="status"
              defaultValue={seller.verifiedSellerStatus}
              className="surface-input w-full text-sm"
            >
              <option value="REQUESTED">REQUESTED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="NOT_REQUESTED">NOT_REQUESTED</option>
            </select>
            <textarea
              name="reviewNotes"
              defaultValue={seller.reviewNotes ?? ""}
              rows={3}
              className="surface-input min-h-24 w-full text-sm"
            />
            <AdminSubmitButton
              confirmMessage={`Save the verified seller decision for ${seller.user.displayName}?`}
              pendingText="Saving decision..."
            >
              Save verified decision
            </AdminSubmitButton>
          </form>
        ))}
    </div>
  );
}
