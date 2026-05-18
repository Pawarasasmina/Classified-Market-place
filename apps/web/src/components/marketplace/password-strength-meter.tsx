"use client";

type PasswordStrength = {
  label: string;
  score: number;
  color: string;
};

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password) {
    return { label: "Not started", score: 0, color: "#d7dee8" };
  }

  if (score <= 2) {
    return { label: "Weak", score: 2, color: "#b93820" };
  }

  if (score <= 4) {
    return { label: "Good", score: 4, color: "#c47d1a" };
  }

  return { label: "Strong", score: 5, color: "#1f7a5f" };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const segments = Array.from({ length: 5 }, (_, index) => index);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {segments.map((segment) => (
          <span
            key={segment}
            className="h-1.5 rounded-full"
            style={{
              background:
                segment < strength.score ? strength.color : "var(--line)",
            }}
          />
        ))}
      </div>
      <p className="text-xs font-bold text-[var(--muted)]">
        Password strength: {strength.label}
      </p>
    </div>
  );
}
