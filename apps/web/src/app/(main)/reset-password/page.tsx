import { ResetPasswordForm } from "@/components/marketplace/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage(props: ResetPasswordPageProps) {
  const searchParams = await props.searchParams;
  const token = searchParams.token ?? "";

  return (
    <div className="page max-w-3xl">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Account recovery</p>
        <h1 className="mt-3 text-3xl font-black text-white">Choose a new password.</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Reset links expire quickly and can only be used once.
        </p>
      </div>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
