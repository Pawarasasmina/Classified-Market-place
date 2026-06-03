import {
  deleteSellerRatingAction,
  rateSellerAction,
} from "@/app/(main)/actions";

export function SellerRatingForm({
  listingId,
  returnTo,
  existingStars,
  existingReview,
  result,
  message,
}: {
  listingId: string;
  returnTo: string;
  existingStars?: number | null;
  existingReview?: string | null;
  result?: string;
  message?: string;
}) {
  const feedback =
    result === "saved"
      ? "Your seller rating has been saved."
      : result === "removed"
        ? "Your seller rating has been removed."
        : result === "error"
          ? (message ?? "Your seller rating could not be saved.")
          : null;

  return (
    <div className="panel p-5">
      <p className="text-sm font-black uppercase tracking-wide text-[var(--brand-strong)]">
        Seller rating and review
      </p>
      <h2 className="mt-2 text-lg font-black">Review this seller</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Share a 1 to 5 star rating and optional written feedback for this
        listing.
      </p>
      {feedback ? (
        <p
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            result === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {feedback}
        </p>
      ) : null}
      <form action={rateSellerAction} className="mt-4 grid gap-4">
        <input type="hidden" name="listingId" value={listingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Select seller rating</legend>
          {[1, 2, 3, 4, 5].map((stars) => (
            <label
              key={stars}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm font-bold"
            >
              <input
                type="radio"
                name="stars"
                value={stars}
                defaultChecked={existingStars === stars}
                required
              />
              <span aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`}>
                {Array.from({ length: stars }, (_, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="text-[var(--accent)]"
                  >
                    &#9733;
                  </span>
                ))}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="grid gap-2 text-sm font-bold">
          Written review{" "}
          <span className="font-normal text-[var(--muted)]">(optional)</span>
          <textarea
            name="review"
            rows={4}
            maxLength={1000}
            defaultValue={existingReview ?? ""}
            className="surface-input"
            placeholder="Describe communication, accuracy, and overall experience."
          />
        </label>
        <button className="action-primary px-4 py-3 text-sm font-black">
          {existingStars ? "Update review" : "Submit review"}
        </button>
      </form>
      {existingStars ? (
        <form action={deleteSellerRatingAction} className="mt-2">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button className="action-secondary w-full px-4 py-3 text-sm font-black">
            Remove rating and review
          </button>
        </form>
      ) : null}
    </div>
  );
}
