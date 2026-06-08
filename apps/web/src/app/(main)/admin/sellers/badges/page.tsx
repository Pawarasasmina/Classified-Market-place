import {
  assignSellerBadgeAction,
  removeSellerBadgeAction,
  upsertSellerBadgeTypeAction,
} from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchAdminSellerBadges,
  fetchAdminSellerProfiles,
} from "@/lib/marketplace-api";

export default async function AdminSellerBadgesPage() {
  const { accessToken } = await requireSessionContext("/admin/sellers/badges");
  const [badges, sellers] = await Promise.all([
    fetchAdminSellerBadges(accessToken),
    fetchAdminSellerProfiles(accessToken, { take: 100 }),
  ]);

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller Operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Seller badges</h1>
      </div>
      <form action={upsertSellerBadgeTypeAction} className="panel grid gap-3 md:grid-cols-3">
        <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
        <input name="label" placeholder="Badge label" className="surface-input w-full text-sm" />
        <input name="slug" placeholder="Slug" className="surface-input w-full text-sm" />
        <input name="icon" placeholder="Icon" className="surface-input w-full text-sm" />
        <input name="backgroundColor" placeholder="Background color" className="surface-input w-full text-sm" />
        <input name="textColor" placeholder="Text color" className="surface-input w-full text-sm" />
        <input name="description" placeholder="Description" className="surface-input w-full text-sm md:col-span-3" />
        <button className="action-primary px-4 py-3 text-sm font-bold md:col-span-3">
          Save badge type
        </button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {badges.map((badge) => (
          <div key={badge.id} className="panel grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{badge.label}</h2>
                <p className="text-sm text-[var(--muted)]">{badge.slug}</p>
              </div>
              <span
                className="rounded-md px-3 py-2 text-xs font-black"
                style={{
                  background: badge.backgroundColor ?? "#eef2ff",
                  color: badge.textColor ?? "#1f2937",
                }}
              >
                Preview
              </span>
            </div>
            <form action={upsertSellerBadgeTypeAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
              <input type="hidden" name="id" value={badge.id} />
              <input
                name="label"
                defaultValue={badge.label}
                className="surface-input w-full text-sm"
              />
              <input
                name="slug"
                defaultValue={badge.slug}
                className="surface-input w-full text-sm"
              />
              <input
                name="icon"
                defaultValue={badge.icon ?? ""}
                className="surface-input w-full text-sm"
              />
              <input
                name="backgroundColor"
                defaultValue={badge.backgroundColor ?? ""}
                className="surface-input w-full text-sm"
              />
              <input
                name="textColor"
                defaultValue={badge.textColor ?? ""}
                className="surface-input w-full text-sm"
              />
              <textarea
                name="description"
                defaultValue={badge.description ?? ""}
                rows={3}
                className="surface-input min-h-20 w-full text-sm"
              />
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <label className="flex items-center gap-2">
                  <input type="hidden" name="isActive" value="false" />
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={badge.isActive}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isHidden"
                    value="true"
                    defaultChecked={badge.isHidden}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Hidden
                </label>
              </div>
              <button className="action-secondary px-4 py-3 text-sm font-bold">
                Save badge settings
              </button>
            </form>
            <form action={assignSellerBadgeAction} className="grid gap-3">
              <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
              <input type="hidden" name="badgeTypeId" value={badge.id} />
              <select name="sellerProfileId" className="surface-input w-full text-sm">
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.user.displayName}
                  </option>
                ))}
              </select>
              <button className="action-secondary px-4 py-3 text-sm font-bold">
                Assign badge
              </button>
            </form>
            {sellers.flatMap((seller) =>
              (seller.badges ?? [])
                .filter((assignment) => assignment.badgeType.id === badge.id)
                .map((assignment) => (
                  <form
                    key={assignment.id}
                    action={removeSellerBadgeAction}
                    className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] p-3 text-sm"
                  >
                    <input type="hidden" name="returnTo" value="/admin/sellers/badges" />
                    <input type="hidden" name="sellerProfileId" value={seller.id} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <span>{seller.user.displayName}</span>
                    <button className="text-sm font-bold text-[#b93820]">
                      Remove
                    </button>
                  </form>
                )),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
