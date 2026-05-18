import { ForgotPasswordForm } from "@/components/marketplace/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="page max-w-3xl">
      <div className="panel-dark p-6">
        <p className="section-eyebrow">Account recovery</p>
        <h1 className="mt-3 text-3xl font-black text-white">Reset your password.</h1>
        <p className="mt-2 text-[#d7d9ea]">
          Enter your email and we will send a secure reset link.
        </p>
      </div>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
