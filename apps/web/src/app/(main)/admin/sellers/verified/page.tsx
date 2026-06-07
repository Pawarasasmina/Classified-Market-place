import { reviewVerifiedSellerAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminSellerProfiles } from "@/lib/marketplace-api";

export default async function AdminSellerVerifiedPage() {
  const { accessToken } = await requireSessionContext("/admin/sellers/verified");
  const sellers = await fetchAdminSellerProfiles(accessToken, { take: 100 });

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller Operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Verified seller queue</h1>
      </div>
      {sellers
        .filter(
          (seller) =>
            seller.verifiedSellerStatus === "REQUESTED" ||
            seller.verifiedSellerStatus === "VERIFIED" ||
            seller.verifiedSellerStatus === "REJECTED",
        )
        .map((seller) => (
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
            <button className="action-primary px-4 py-3 text-sm font-bold">
              Save verified decision
            </button>
          </form>
        ))}
    </div>
  );
}
