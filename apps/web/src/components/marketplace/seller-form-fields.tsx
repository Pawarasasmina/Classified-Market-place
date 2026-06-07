import type { ApiSellerFormField } from "@/lib/marketplace";

function getStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getToggleValue(value: unknown) {
  return value === true || value === "true";
}

export function SellerFormFields({
  fields,
  answers = {},
  inputPrefix = "sellerAnswer:",
  filePrefix = "sellerFile:",
}: {
  fields: ApiSellerFormField[];
  answers?: Record<string, unknown>;
  inputPrefix?: string;
  filePrefix?: string;
}) {
  return (
    <div className="grid gap-4">
      {fields.map((field) => {
        const value = answers[field.key];
        const inputName = `${inputPrefix}${field.key}`;
        const helpText = field.helpText ? (
          <p className="text-xs text-[var(--muted)]">{field.helpText}</p>
        ) : null;

        if (field.type === "textarea") {
          return (
            <label key={field.key} className="grid gap-2">
              <span className="text-sm font-bold">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <textarea
                name={inputName}
                defaultValue={getStringValue(value)}
                placeholder={field.placeholder}
                rows={4}
                className="surface-input min-h-28 w-full text-sm"
              />
              {helpText}
            </label>
          );
        }

        if (field.type === "select") {
          return (
            <label key={field.key} className="grid gap-2">
              <span className="text-sm font-bold">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <select
                name={inputName}
                defaultValue={getStringValue(value)}
                className="surface-input w-full text-sm"
              >
                <option value="">Select</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {helpText}
            </label>
          );
        }

        if (field.type === "toggle") {
          return (
            <label
              key={field.key}
              className="flex items-start gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm"
            >
              <input
                type="checkbox"
                name={inputName}
                value="true"
                defaultChecked={getToggleValue(value)}
                className="mt-1 h-4 w-4 accent-[var(--brand)]"
              />
              <span>
                <span className="font-bold">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                {helpText}
              </span>
            </label>
          );
        }

        if (field.type === "file") {
          return (
            <label key={field.key} className="grid gap-2">
              <span className="text-sm font-bold">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                type="file"
                name={`${filePrefix}${field.key}`}
                className="surface-input w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:font-bold file:text-white"
              />
              {Array.isArray(value) && value.length ? (
                <p className="text-xs text-[var(--muted)]">
                  Existing file attached.
                </p>
              ) : null}
              {helpText}
            </label>
          );
        }

        return (
          <label key={field.key} className="grid gap-2">
            <span className="text-sm font-bold">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            <input
              name={inputName}
              defaultValue={getStringValue(value)}
              placeholder={field.placeholder}
              className="surface-input w-full text-sm"
            />
            {helpText}
          </label>
        );
      })}
    </div>
  );
}
