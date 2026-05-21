import Link from "next/link";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchTransaction } from "@/lib/marketplace-api";
import { type ApiTransactionStatus } from "@/lib/marketplace";

type BoostCheckoutPageProps = {
  params: Promise<{
    boostId: string;
  }>;
  searchParams: Promise<{
    status?: ApiTransactionStatus;
    listingId?: string;
    transactionId?: string;
  }>;
};

function getStatusCopy(status: ApiTransactionStatus | undefined) {
  switch (status) {
    case "SUCCEEDED":
      return {
        eyebrow: "Payment complete",
        title: "Your boost is active",
        body: "The listing has been promoted and the transaction is available in your purchase history.",
      };
    case "FAILED":
      return {
        eyebrow: "Payment failed",
        title: "Boost payment did not complete",
        body: "The boost was not activated. You can try again from My Listings.",
      };
    case "REFUNDED":
      return {
        eyebrow: "Payment refunded",
        title: "This boost payment was refunded",
        body: "The transaction has been marked as refunded in your purchase history.",
      };
    case "CANCELLED":
      return {
        eyebrow: "Payment cancelled",
        title: "Boost checkout was cancelled",
        body: "No active boost was applied. You can start another boost any time.",
      };
    default:
      return {
        eyebrow: "Payment pending",
        title: "Boost checkout is pending",
        body: "The transaction is still being processed. Check purchase history for updates.",
      };
  }
}

export default async function BoostCheckoutPage(props: BoostCheckoutPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { accessToken } = await requireSessionContext("/my-listings");
  const transaction = searchParams.transactionId
    ? await fetchTransaction(accessToken, searchParams.transactionId).catch(
        () => null,
      )
    : null;
  const status = transaction?.status ?? searchParams.status;
  const copy = getStatusCopy(status);
  const listingId = transaction?.listingId ?? searchParams.listingId;

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
          <p className="text-sm text-[var(--muted)]">Boost ID</p>
          <p className="mt-2 break-all text-lg font-black">{params.boostId}</p>
        </div>
        <div className="panel">
          <p className="text-sm text-[var(--muted)]">Transaction</p>
          <p className="mt-2 text-lg font-black">
            {transaction?.amountLabel ?? "Pending"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {transaction?.statusLabel ?? status ?? "Pending"}
          </p>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {listingId ? (
          <Link
            href={`/listings/${listingId}`}
            className="action-primary px-4 py-3 text-sm font-black"
          >
            View listing
          </Link>
        ) : null}
        <Link
          href="/transactions"
          className="action-secondary px-4 py-3 text-sm font-black"
        >
          Purchase history
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
