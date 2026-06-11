import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth-dal";
import { bulkImportListings, MarketplaceApiError } from "@/lib/marketplace-api";

export async function POST(request: Request) {
  const session = await getSessionContext();

  if (!session) {
    return NextResponse.json(
      { message: "You must be signed in as an admin to import listings." },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "The bulk import payload is invalid." },
      { status: 400 },
    );
  }

  try {
    const result = await bulkImportListings(
      session.accessToken,
      payload as Parameters<typeof bulkImportListings>[1],
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MarketplaceApiError) {
      return NextResponse.json(
        { message: error.message || "We could not import this listing chunk." },
        { status: error.status || 500 },
      );
    }

    return NextResponse.json(
      { message: "We could not import this listing chunk." },
      { status: 500 },
    );
  }
}
