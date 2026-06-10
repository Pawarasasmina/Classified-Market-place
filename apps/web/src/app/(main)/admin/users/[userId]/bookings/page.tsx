import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { requireSessionContext } from "@/lib/auth-dal";
import type { AdminBookingMessage, AdminBookingParticipant } from "@/lib/marketplace";
import {
  fetchAdminUser,
  fetchAdminUserBookings,
} from "@/lib/marketplace-api";

type AdminUserBookingsPageProps = {
  params: Promise<{ userId: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOffer(message: AdminBookingMessage) {
  if (message.offerAmount == null) {
    return "Offer activity";
  }

  const amount = Number(message.offerAmount);
  const currency = message.offerCurrency ?? "AED";

  if (Number.isNaN(amount)) {
    return `${currency} ${message.offerAmount}`;
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function participantNames(participants: AdminBookingParticipant[], userId: string) {
  const names = participants
    .filter((participant) => participant.userId !== userId)
    .map((participant) => participant.user.displayName);

  return names.length ? names.join(", ") : "No other participant";
}

function messageHref(
  participants: AdminBookingParticipant[],
  userId: string,
  listingId?: string | null
) {
  if (listingId) {
    return `/messages?listing=${listingId}`;
  }

  const otherParticipant = participants.find(
    (participant) => participant.userId !== userId
  );

  return otherParticipant ? `/messages?user=${otherParticipant.userId}` : "/messages";
}

export default async function AdminUserBookingsPage(
  props: AdminUserBookingsPageProps
) {
  const [{ userId }, session] = await Promise.all([
    props.params,
    requireSessionContext("/admin/users"),
  ]);
  const { accessToken, user } = session;

  if (user.role.toUpperCase() !== "ADMIN") {
    redirect("/");
  }

  const [managedUser, bookings] = await Promise.all([
    fetchAdminUser(accessToken, userId),
    fetchAdminUserBookings(accessToken, userId),
  ]);

  return (
    <div className="admin-dashboard page">
      <AdminPageHeader
        eyebrow="User bookings"
        title={managedUser.displayName}
        description="Booking conversations and offer records for this user."
        badge={`${bookings.length} conversations`}
        actions={
          <>
            <Link
              href={`/admin/users/${managedUser.id}`}
              className="action-secondary px-4 py-2 text-sm font-semibold"
            >
              User details
            </Link>
            <Link
              href={`/admin/users/${managedUser.id}/listings`}
              className="action-primary px-4 py-2 text-sm font-semibold"
            >
              Listings
            </Link>
          </>
        }
      />

      <section className="admin-booking-grid">
        {bookings.map((booking) => (
          <article key={booking.id} className="admin-booking-card">
            <div className="admin-booking-card-header">
              <div>
                <span className="admin-kicker">Booking conversation</span>
                <h2>{booking.listing?.title ?? "General conversation"}</h2>
                <p>{participantNames(booking.participants, managedUser.id)}</p>
              </div>
              <span>{formatDate(booking.updatedAt)}</span>
            </div>

            <div className="admin-booking-meta">
              <div>
                <span>Listing</span>
                <strong>{booking.listing?.priceLabel ?? "Not attached"}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{booking.listing?.subcategory ?? "Support"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{booking.listing?.status ?? "Conversation"}</strong>
              </div>
            </div>

            {booking.messages.length ? (
              <div className="admin-booking-offers">
                {booking.messages.map((message) => (
                  <div key={message.id}>
                    <span>{message.sender.displayName}</span>
                    <strong>{formatOffer(message)}</strong>
                    <small>
                      {message.offerStatus ?? "Pending"} / {formatDate(message.createdAt)}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-empty-state">
                No offer amount recorded for this conversation.
              </div>
            )}

            <div className="admin-user-links">
              <Link
                href={messageHref(
                  booking.participants,
                  managedUser.id,
                  booking.listingId
                )}
              >
                Open conversation
              </Link>
              {booking.listing ? (
                <Link
                  href={`/listings/${booking.listing.id}?view=customer`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Customer listing
                </Link>
              ) : null}
            </div>
          </article>
        ))}

        {bookings.length === 0 ? (
          <div className="admin-management-panel">
            <div className="admin-empty-state">
              No bookings or offer conversations found for this user.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
