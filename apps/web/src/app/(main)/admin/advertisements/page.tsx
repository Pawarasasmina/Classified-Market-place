import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createAdvertisementBannerAction,
  deleteAdvertisementBannerAction,
  updateAdvertisementBannerAction,
} from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminFormSection } from "@/components/marketplace/admin-form-section";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchAdminAdvertisementBanners } from "@/lib/marketplace-api";
import type { MarketplaceAdvertisementBanner } from "@/lib/marketplace";

type AdminAdvertisementsPageProps = {
  searchParams: Promise<{
    banner?: string;
    message?: string;
  }>;
};

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatSchedule(banner: MarketplaceAdvertisementBanner) {
  if (!banner.startsAt && !banner.endsAt) {
    return "Always eligible";
  }

  const starts = banner.startsAt
    ? new Date(banner.startsAt).toLocaleString()
    : "Now";
  const ends = banner.endsAt
    ? new Date(banner.endsAt).toLocaleString()
    : "No end";

  return `${starts} to ${ends}`;
}

function BannerFormFields({
  banner,
}: {
  banner?: MarketplaceAdvertisementBanner;
}) {
  return (
    <>
      <AdminFormSection
        title="Image"
        copy="This visual appears as the image panel of the home page banner."
      >
        <div className="admin-form-grid md:grid-cols-2">
          <label className="admin-field md:col-span-2">
            <span className="admin-field-label">Image URL</span>
            <input
              name="imageUrl"
              defaultValue={banner?.imageUrl}
              placeholder="Paste an image URL, or upload a file below"
              className="surface-input"
            />
          </label>
          <label className="admin-field md:col-span-2">
            <span className="admin-field-label">Upload image from computer</span>
            <input
              name="imageFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="surface-input text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:font-bold file:text-white"
            />
            <span className="text-xs font-semibold text-[var(--muted)]">
              JPG, PNG, or WEBP up to 5 MB. A selected file replaces the image URL.
            </span>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Image alt text</span>
            <input
              name="imageAlt"
              defaultValue={banner?.imageAlt}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Image badge</span>
            <input
              name="badgeLabel"
              defaultValue={banner?.badgeLabel}
              placeholder="Limited offer"
              className="surface-input"
            />
          </label>
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Content"
        copy="Headline and copy are kept separate from image and action settings."
      >
        <div className="admin-form-grid md:grid-cols-2">
          <label className="admin-field">
            <span className="admin-field-label">Kicker</span>
            <input
              name="kicker"
              defaultValue={banner?.kicker}
              placeholder="Featured"
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Title</span>
            <input
              name="title"
              defaultValue={banner?.title}
              className="surface-input"
              required
            />
          </label>
          <label className="admin-field md:col-span-2">
            <span className="admin-field-label">Subtitle</span>
            <input
              name="subtitle"
              defaultValue={banner?.subtitle}
              className="surface-input"
            />
          </label>
          <label className="admin-field md:col-span-2">
            <span className="admin-field-label">Body</span>
            <textarea
              name="body"
              defaultValue={banner?.body}
              rows={4}
              className="surface-input min-h-28 resize-none"
            />
          </label>
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Actions and campaign details"
        copy="Control links, timing, rotation speed, and visual accent separately."
      >
        <div className="admin-form-grid md:grid-cols-2 xl:grid-cols-4">
          <label className="admin-field">
            <span className="admin-field-label">Primary CTA label</span>
            <input
              name="ctaLabel"
              defaultValue={banner?.ctaLabel}
              placeholder="Explore now"
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Primary CTA URL</span>
            <input
              name="ctaHref"
              defaultValue={banner?.ctaHref}
              placeholder="/search"
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Secondary CTA label</span>
            <input
              name="secondaryCtaLabel"
              defaultValue={banner?.secondaryCtaLabel}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Secondary CTA URL</span>
            <input
              name="secondaryCtaHref"
              defaultValue={banner?.secondaryCtaHref}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Metric value</span>
            <input
              name="metricValue"
              defaultValue={banner?.metricValue}
              placeholder="24/7"
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Metric label</span>
            <input
              name="metricLabel"
              defaultValue={banner?.metricLabel}
              placeholder="local visibility"
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Layout</span>
            <select
              name="layout"
              defaultValue={banner?.layout ?? "WIDE"}
              className="surface-input"
            >
              <option value="WIDE">Wide valuation strip</option>
              <option value="FEATURE">Full-width feature strip</option>
              <option value="HALF">Half-width promo card</option>
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Sort order</span>
            <input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={banner?.sortOrder ?? 0}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Rotation seconds</span>
            <input
              name="rotationSeconds"
              type="number"
              min="3"
              max="30"
              defaultValue={banner?.rotationSeconds ?? 6}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Starts at</span>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={toDateTimeLocal(banner?.startsAt)}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Ends at</span>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={toDateTimeLocal(banner?.endsAt)}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Background color</span>
            <input
              name="backgroundColor"
              defaultValue={banner?.backgroundColor ?? "#f6f3ff"}
              className="surface-input"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field-label">Accent color</span>
            <input
              name="accentColor"
              defaultValue={banner?.accentColor ?? "#6d46ff"}
              className="surface-input"
            />
          </label>
          <input name="placement" type="hidden" value="HOME" />
          <label className="admin-toggle md:col-span-2 xl:col-span-4">
            <span className="admin-toggle-copy">
              <span>Active</span>
              <span>Active banners appear on the home page when inside schedule.</span>
            </span>
            <input
              name="isActive"
              value="true"
              type="checkbox"
              defaultChecked={banner?.isActive ?? true}
            />
          </label>
        </div>
      </AdminFormSection>
    </>
  );
}

export default async function AdminAdvertisementsPage(
  props: AdminAdvertisementsPageProps,
) {
  const searchParams = await props.searchParams;
  const { accessToken, user } = await requireSessionContext(
    "/admin/advertisements",
  );

  if (!hasAdminPermission(user.role, "BOOSTS_READ")) {
    redirect("/");
  }

  const canEdit = hasAdminPermission(user.role, "BOOSTS_WRITE");
  const banners = await fetchAdminAdvertisementBanners(accessToken);
  const activeCount = banners.filter((banner) => banner.isActive).length;

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Homepage promotions"
        title="Advertisement Banners"
        description="Create rotating home page advertisement banners with separate image, content, and action details."
        badge={`${activeCount} active / ${banners.length} total`}
        actions={
          <Link href="/admin" className="action-secondary px-4 py-2 text-sm font-semibold">
            Back to admin
          </Link>
        }
      />

      <AdminActionFeedback
        status={searchParams.banner}
        message={searchParams.message}
        messages={{
          created: "Advertisement banner created.",
          updated: "Advertisement banner updated.",
          deleted: "Advertisement banner disabled.",
          invalid: "Check the banner fields and try again.",
        }}
        successStatuses={["created", "updated", "deleted"]}
      />

      {canEdit ? (
        <section className="panel">
          <div className="admin-form-section-head">
            <h2 className="text-xl font-bold">Create banner</h2>
            <p className="admin-form-section-copy">
              Add an image-led campaign that rotates on the client home page.
            </p>
          </div>
          <form
            action={createAdvertisementBannerAction}
            className="admin-form-card mt-4"
            encType="multipart/form-data"
          >
            <BannerFormFields />
            <AdminSubmitButton pendingText="Creating banner...">
              Create banner
            </AdminSubmitButton>
          </form>
        </section>
      ) : (
        <div className="rounded-md border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)] shadow-sm">
          This role can view advertisement banners but cannot create or change them.
        </div>
      )}

      <section className="grid gap-4">
        {banners.length ? (
          banners.map((banner) => (
            <article key={banner.id} className="admin-form-card">
              <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
                <div className="grid content-start gap-3">
                  <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[#f8faf8]">
                    <img
                      src={banner.imageUrl}
                      alt={banner.imageAlt}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="admin-status-badge"
                      data-status={banner.isActive ? "active" : "hidden"}
                    >
                      {banner.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="admin-page-header-badge">
                      {banner.layout}
                    </span>
                    <span className="admin-page-header-badge">
                      Every {banner.rotationSeconds}s
                    </span>
                    <span className="admin-page-header-badge">
                      Sort {banner.sortOrder}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {formatSchedule(banner)}
                  </p>
                </div>

                <div className="grid gap-3">
                  <div>
                    <p className="admin-card-eyebrow">{banner.kicker || "Banner"}</p>
                    <h2 className="text-xl font-bold text-[var(--foreground)]">
                      {banner.title}
                    </h2>
                    {banner.subtitle ? (
                      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                        {banner.subtitle}
                      </p>
                    ) : null}
                  </div>

                  {canEdit ? (
                    <form
                      action={updateAdvertisementBannerAction}
                      className="grid gap-4"
                      encType="multipart/form-data"
                    >
                      <input type="hidden" name="bannerId" value={banner.id} />
                      <BannerFormFields banner={banner} />
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <AdminSubmitButton pendingText="Saving banner...">
                          Save banner
                        </AdminSubmitButton>
                        <button
                          type="submit"
                          form={`disable-banner-${banner.id}`}
                          className="rounded-md border border-[#e7b6a9] px-4 py-3 text-sm font-bold text-[#9f321e] hover:bg-[#fff3ef]"
                        >
                          Disable
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {canEdit ? (
                    <form
                      id={`disable-banner-${banner.id}`}
                      action={deleteAdvertisementBannerAction}
                    >
                      <input type="hidden" name="bannerId" value={banner.id} />
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="admin-empty-state">
            <p className="admin-empty-state-title">No banners yet</p>
            <p className="admin-empty-state-copy">
              Create a home page advertisement banner to show promotions on the
              customer homepage.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
