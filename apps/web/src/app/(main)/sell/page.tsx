import { redirect } from "next/navigation";
import { SellerOnboardingPanel } from "@/components/marketplace/seller-onboarding-panel";
import { SellWizard } from "@/components/marketplace/sell-wizard";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchCategories, fetchMySellerProfile } from "@/lib/marketplace-api";
import { getPhoneVerificationPath } from "@/lib/redirects";

export default async function SellPage() {
  const { accessToken, user } = await requireSessionContext("/sell");
  const sellerProfileEnvelope = await fetchMySellerProfile(accessToken).catch(() => ({
    sellerProfile: null,
    formDefinition: { fields: [] },
  }));

  const approvedSeller =
    sellerProfileEnvelope.sellerProfile?.status === "APPROVED";

  if (approvedSeller && !user.phoneVerified) {
    redirect(getPhoneVerificationPath("/sell"));
  }

  const categories = approvedSeller ? await fetchCategories() : [];

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Post from your account</p>
        <h1 className="mt-3 text-3xl font-black text-white">Create a listing that buyers can trust.</h1>
        <p className="mt-2 max-w-3xl text-[#d7d9ea]">
          Use your regular marketplace account to sell. Add clear details,
          category-specific attributes, and photos; new listings enter review
          before they appear in customer search.
        </p>
      </div>
      {approvedSeller ? (
        <SellWizard categories={categories} />
      ) : (
        <SellerOnboardingPanel
          envelope={sellerProfileEnvelope}
          returnTo="/sell"
          title="Seller onboarding"
        />
      )}
    </div>
  );
}
