"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MarketplaceAdvertisementBanner } from "@/lib/marketplace";

function withCustomerPreview(path: string, customerPreview: boolean) {
  if (!customerPreview) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}view=customer`;
}

function getRotatedBanners(
  banners: MarketplaceAdvertisementBanner[],
  offset: number,
) {
  if (!banners.length) {
    return [];
  }

  return banners.map((_, index) => banners[(offset + index) % banners.length]);
}

function pickShowcaseBanners(
  banners: MarketplaceAdvertisementBanner[],
  offset: number,
) {
  const rotated = getRotatedBanners(banners, offset);
  const wide = rotated.find((banner) => banner.layout === "WIDE") ?? rotated[0];
  const afterWide = rotated.filter((banner) => banner.id !== wide?.id);
  const feature =
    afterWide.find((banner) => banner.layout === "FEATURE") ?? afterWide[0];
  const afterFeature = afterWide.filter((banner) => banner.id !== feature?.id);
  const halfBanners = [
    ...afterFeature.filter((banner) => banner.layout === "HALF"),
    ...afterFeature.filter((banner) => banner.layout !== "HALF"),
  ].slice(0, 2);

  return { wide, feature, halfBanners };
}

function BannerAction({
  banner,
  customerPreview,
}: {
  banner: MarketplaceAdvertisementBanner;
  customerPreview: boolean;
}) {
  return (
    <Link href={withCustomerPreview(banner.ctaHref, customerPreview)}>
      {banner.ctaLabel}
      <span aria-hidden="true">›</span>
    </Link>
  );
}

function BannerCard({
  banner,
  customerPreview,
  slot,
}: {
  banner: MarketplaceAdvertisementBanner;
  customerPreview: boolean;
  slot: "wide" | "feature" | "half";
}) {
  return (
    <article
      className={`home-advertisement-card home-advertisement-card-${slot}`}
      style={
        {
          "--home-ad-bg": banner.backgroundColor,
          "--home-ad-text": banner.textColor,
          "--home-ad-accent": banner.accentColor,
        } as CSSProperties
      }
    >
      <div className="home-advertisement-card-image">
        <img src={banner.imageUrl} alt={banner.imageAlt} />
      </div>
      <div className="home-advertisement-card-copy">
        {banner.kicker ? (
          <p className="home-advertisement-kicker">{banner.kicker}</p>
        ) : null}
        <h2>{banner.title}</h2>
        {banner.subtitle ? <p>{banner.subtitle}</p> : null}
        {banner.body ? <p>{banner.body}</p> : null}
      </div>
      <div className="home-advertisement-card-action">
        <BannerAction banner={banner} customerPreview={customerPreview} />
      </div>
    </article>
  );
}

export function AdvertisementBannerRotator({
  banners,
  customerPreview,
}: {
  banners: MarketplaceAdvertisementBanner[];
  customerPreview: boolean;
}) {
  const activeBanners = useMemo(
    () =>
      banners
        .filter((banner) => banner.isActive)
        .sort((first, second) => first.sortOrder - second.sortOrder),
    [banners],
  );
  const [offset, setOffset] = useState(0);
  const rotationSeconds = activeBanners[0]?.rotationSeconds ?? 8;
  const { wide, feature, halfBanners } = pickShowcaseBanners(
    activeBanners,
    offset,
  );
  const shouldRotate = activeBanners.length > 4;

  useEffect(() => {
    if (!shouldRotate) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setOffset((current) => (current + 1) % activeBanners.length);
    }, rotationSeconds * 1000);

    return () => window.clearTimeout(timeout);
  }, [activeBanners.length, rotationSeconds, shouldRotate]);

  if (!wide) {
    return null;
  }

  return (
    <section
      className="home-advertisement-showcase"
      aria-label="Featured marketplace promotions"
    >
      <BannerCard banner={wide} customerPreview={customerPreview} slot="wide" />
      {feature ? (
        <BannerCard
          banner={feature}
          customerPreview={customerPreview}
          slot="feature"
        />
      ) : null}
      {halfBanners.length ? (
        <div className="home-advertisement-half-grid">
          {halfBanners.map((banner) => (
            <BannerCard
              key={banner.id}
              banner={banner}
              customerPreview={customerPreview}
              slot="half"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
