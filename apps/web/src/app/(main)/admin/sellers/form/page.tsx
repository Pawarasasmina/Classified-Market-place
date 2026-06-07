import { updateSellerFormDefinitionAction } from "@/app/(main)/actions";
import { SellerFormDefinitionEditor } from "@/components/marketplace/seller-form-definition-editor";
import { requireSessionContext } from "@/lib/auth-dal";
import { fetchSellerFormDefinition } from "@/lib/marketplace-api";

export default async function AdminSellerFormPage() {
  await requireSessionContext("/admin/sellers/form");
  const definition = await fetchSellerFormDefinition().catch(() => ({ fields: [] }));

  return (
    <div className="page grid gap-6">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Seller Operations</p>
        <h1 className="mt-2 text-3xl font-black text-white">Seller form builder</h1>
      </div>
      <form action={updateSellerFormDefinitionAction} className="panel grid gap-4">
        <input type="hidden" name="returnTo" value="/admin/sellers/form" />
        <SellerFormDefinitionEditor initialFields={definition.fields} />
        <button className="action-primary px-4 py-3 text-sm font-bold">
          Save seller form
        </button>
      </form>
    </div>
  );
}
