"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useState } from "react";
import type { MarketplaceListing } from "@/lib/marketplace";

type AdminListingToolsProps = {
  listing: MarketplaceListing;
};

function formatBoolean(value: boolean) {
  return value ? "Yes" : "No";
}

function formatAttributeValue(value: string | number | boolean) {
  return typeof value === "boolean" ? formatBoolean(value) : String(value);
}

function humanizeLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminListingTools({ listing }: AdminListingToolsProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const customerHref = `/listings/${listing.id}?view=customer`;
  const attributes = Object.entries(listing.attributes);
  const images = listing.imageUrls.length
    ? listing.imageUrls
    : listing.imageUrl
      ? [listing.imageUrl]
      : [];

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
      <div className="admin-listing-tools">
        <button type="button" onClick={() => setOpen(true)}>
          Details
        </button>
        <a href={customerHref} target="_blank" rel="noreferrer">
          Customer view
        </a>
      </div>

      {open ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            className="admin-listing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-kicker">Listing details</span>
                <h2 id={titleId}>{listing.title}</h2>
                <p>
                  {listing.subcategory} / {listing.location} / {listing.postedLabel}
                </p>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                aria-label="Close listing details"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-modal-main">
                {images[0] ? (
                  <div className="admin-modal-media">
                    <img src={images[0]} alt={listing.title} />
                  </div>
                ) : (
                  <div className="admin-modal-media admin-modal-media-empty">
                    No image
                  </div>
                )}

                <div className="admin-detail-block">
                  <h3>Description</h3>
                  <p>{listing.description || "No description provided."}</p>
                </div>

                {listing.featureBullets.length ? (
                  <div className="admin-detail-block">
                    <h3>Highlights</h3>
                    <div className="admin-detail-chip-list">
                      {listing.featureBullets.map((feature) => (
                        <span key={feature}>{feature}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {images.length > 1 ? (
                  <div className="admin-detail-block">
                    <h3>Photos</h3>
                    <div className="admin-modal-gallery">
                      {images.slice(0, 6).map((src, index) => (
                        <img key={`${src}-${index}`} src={src} alt="" />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="admin-modal-side">
                <div className="admin-detail-summary">
                  <div>
                    <span>Status</span>
                    <strong>{listing.status}</strong>
                  </div>
                  <div>
                    <span>Price</span>
                    <strong>{listing.priceLabel}</strong>
                  </div>
                  <div>
                    <span>Condition</span>
                    <strong>{listing.condition}</strong>
                  </div>
                  <div>
                    <span>Saved</span>
                    <strong>{formatBoolean(listing.saved)}</strong>
                  </div>
                </div>

                <div className="admin-detail-block">
                  <h3>Seller</h3>
                  <dl className="admin-detail-list">
                    <div>
                      <dt>Name</dt>
                      <dd>{listing.sellerDisplayName ?? "Marketplace seller"}</dd>
                    </div>
                    <div>
                      <dt>Seller ID</dt>
                      <dd>{listing.sellerId}</dd>
                    </div>
                    <div>
                      <dt>Verified</dt>
                      <dd>{formatBoolean(Boolean(listing.sellerVerified))}</dd>
                    </div>
                    <div>
                      <dt>Joined</dt>
                      <dd>{listing.sellerJoinedLabel ?? "Not available"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="admin-detail-block">
                  <h3>Listing metadata</h3>
                  <dl className="admin-detail-list">
                    <div>
                      <dt>Listing ID</dt>
                      <dd>{listing.id}</dd>
                    </div>
                    <div>
                      <dt>Category slug</dt>
                      <dd>{listing.categorySlug || "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Views</dt>
                      <dd>{listing.viewCount}</dd>
                    </div>
                    <div>
                      <dt>Chats</dt>
                      <dd>{listing.chatCount}</dd>
                    </div>
                  </dl>
                </div>

                {attributes.length ? (
                  <div className="admin-detail-block">
                    <h3>Attributes</h3>
                    <dl className="admin-detail-list">
                      {attributes.map(([key, value]) => (
                        <div key={key}>
                          <dt>{humanizeLabel(key)}</dt>
                          <dd>{formatAttributeValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </aside>
            </div>

            <div className="admin-modal-footer">
              <button type="button" onClick={() => setOpen(false)}>
                Done
              </button>
              <a href={customerHref} target="_blank" rel="noreferrer">
                Open customer view
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
