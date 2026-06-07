import Link from "next/link";
import { completeListingPaymentAction } from "@/app/(main)/actions";
import { requireSessionContext } from "@/lib/auth-dal";
import {
  fetchMyListing,
  fetchMyTransactions,
  fetchTransaction,
} from "@/lib/marketplace-api";
import { type ApiTransactionStatus } from "@/lib/marketplace";

type ListingCheckoutPageProps = {
  params: Promise<{
    listingId: string;
  }>;
  searchParams: Promise<{
    status?: ApiTransactionStatus;
    transactionId?: string;
    providerRef?: string;
  }>;
};

function getStatusCopy(status: ApiTransactionStatus | undefined) {
  switch (status) {
    case "SUCCEEDED":
      return {
        eyebrow: "Payment complete",
        title: "Listing fee paid",
        body: "Your listing fee is complete. The listing remains in moderation until it is approved.",
      };
    case "FAILED":
      return {
        eyebrow: "Payment failed",
        title: "Listing fee payment failed",
        body: "The listing fee was not completed. You can try again from this checkout.",
      };
    case "CANCELLED":
      return {
        eyebrow: "Payment cancelled",
        title: "Listing checkout was cancelled",
        body: "No listing fee was collected. Resume payment when you are ready.",
      };
    case "REFUNDED":
      return {
        eyebrow: "Payment refunded",
        title: "Listing fee refunded",
        body: "This listing fee transaction has been marked as refunded.",
      };
    default:
      return {
        eyebrow: "Payment pending",
        title: "Complete listing fee",
        body: "Your free listing balance has been used, so this listing needs a one-time listing fee before it can be treated as paid.",
      };
  }
}

export default async function ListingCheckoutPage(
  props: ListingCheckoutPageProps,
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext(
    `/listings/${params.listingId}/checkout`,
  );
  const [listing, transactionFromParams, listingTransactions] =
    await Promise.all([
      fetchMyListing(accessToken, params.listingId),
      searchParams.transactionId
        ? fetchTransaction(accessToken, searchParams.transactionId).catch(
            () => null,
          )
        : Promise.resolve(null),
      fetchMyTransactions(accessToken, {
        listingId: params.listingId,
        take: 10,
        type: "LISTING_FEE",
      }),
    ]);
  const transaction =
    transactionFromParams ??
    listingTransactions.find((item) => item.status === "PENDING") ??
    listingTransactions[0] ??
    null;
  const status = transaction?.status ?? searchParams.status;
  const providerRef = transaction?.providerRef ?? searchParams.providerRef;
  const copy = getStatusCopy(status);
  const canPay =
    transaction?.status === "PENDING" || (!transaction && status !== "SUCCEEDED");

  return (
    <div className="page max-w-4xl">
      <section className="panel-dark p-6 sm:p-8">
        <p className="section-eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-black text-white">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d7d9ea]">
          {copy.body}
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="panel">
          <p className="text-sm text-[var(--muted)]">Listing</p>
          <p className="mt-2 text-lg font-black">
            {listing?.title ?? params.listingId}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {listing?.status ?? "Pending"}
          </p>
        </div>
        <div className="panel">
          <p className="text-sm text-[var(--muted)]">Listing fee</p>
          <p className="mt-2 text-lg font-black">
            {transaction?.amountLabel ?? "Payment required"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {transaction?.statusLabel ?? status ?? "Pending"}
          </p>
        </div>
      </section>

      <section className="mt-6 panel">
        {canPay ? (
          <form action={completeListingPaymentAction} className="grid gap-4">
            <input type="hidden" name="listingId" value={params.listingId} />
            <input
              type="hidden"
              name="returnTo"
              value={`/listings/${params.listingId}/checkout`}
            />
            {providerRef ? (
              <input type="hidden" name="providerRef" value={providerRef} />
            ) : null}
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
                Gateway checkout
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                This environment uses the dev payment gateway. Pressing pay will
                mark the provider checkout as successful and update the
                transaction.
              </p>
            </div>
            <button className="action-primary w-full px-4 py-3 text-sm font-black sm:w-fit">
              Pay listing fee
            </button>
          </form>
        ) : (
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--muted)]">
              Checkout status
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              No pending payment action is required for this listing.
            </p>
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {listing?.status === "Active" ? (
          <Link
            href={`/listings/${params.listingId}`}
            className="action-primary px-4 py-3 text-sm font-black"
          >
            View listing
          </Link>
        ) : null}
        <Link
          href="/transactions?type=LISTING_FEE"
          className="action-secondary px-4 py-3 text-sm font-black"
        >
          Listing payments
        </Link>
        <Link
          href="/my-listings"
          className="action-secondary px-4 py-3 text-sm font-black"
        >
          My listings
        </Link>
      </div>
    </div>
  );
}
