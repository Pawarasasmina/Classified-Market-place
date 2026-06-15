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
