import { updateSellerFormDefinitionAction } from "@/app/(main)/actions";
import {
  AdminActionFeedback,
  AdminSubmitButton,
} from "@/components/marketplace/admin-form-feedback";
import { AdminFormSection } from "@/components/marketplace/admin-form-section";
import { AdminPageHeader } from "@/components/marketplace/admin-page-header";
import { SellerFormDefinitionEditor } from "@/components/marketplace/seller-form-definition-editor";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchSellerFormDefinition } from "@/lib/marketplace-api";

type AdminSellerFormPageProps = {
  searchParams: Promise<{
    form?: string;
    message?: string;
  }>;
};

export default async function AdminSellerFormPage(
  props: AdminSellerFormPageProps,
) {
  const searchParams = await props.searchParams;
  await requireSessionContext("/admin/sellers/form");
  const definition = await fetchSellerFormDefinition().catch(() => ({ fields: [] }));

  return (
    <div className="page grid gap-6">
      <AdminPageHeader
        eyebrow="Seller operations"
        title="Seller form builder"
        description="Configure the custom onboarding fields sellers complete before approval."
        badge={`${definition.fields.length} fields`}
      />
      <AdminActionFeedback
        status={searchParams.form}
        message={searchParams.message}
        messages={{
          saved: "Seller form saved.",
          invalid: "Add at least one valid seller form field before saving.",
        }}
        successStatuses={["saved"]}
      />
      <form action={updateSellerFormDefinitionAction} className="panel admin-form-card">
        <input type="hidden" name="returnTo" value="/admin/sellers/form" />
        <AdminFormSection
          title="Onboarding fields"
          copy="Group the custom questions sellers answer before the approval team reviews the profile."
        >
          <SellerFormDefinitionEditor initialFields={definition.fields} />
        </AdminFormSection>
        <AdminSubmitButton pendingText="Saving seller form...">
          Save seller form
        </AdminSubmitButton>
      </form>
    </div>
  );
}
