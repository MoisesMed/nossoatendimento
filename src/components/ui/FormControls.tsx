import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef, useId } from "react";
import Select, {
  components,
  type DropdownIndicatorProps,
  type GroupBase,
  type SingleValue,
  type StylesConfig,
} from "react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type FormLabelProps = LabelHTMLAttributes<HTMLLabelElement>;

type FormInputProps = InputHTMLAttributes<HTMLInputElement>;

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

type FormShadcnSelectOption = {
  value: string;
  label: string;
};

type FormShadcnSelectProps = {
  id?: string;
  value: string;
  options: FormShadcnSelectOption[];
  onValueChange: (value: string) => void;
  isDisabled?: boolean;
  ariaLabel?: string;
  className?: string;
  menuPlacement?: "auto" | "top" | "bottom";
};

const baseControlClass =
  "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60";

const shadcnSelectStyles: StylesConfig<
  FormShadcnSelectOption,
  false,
  GroupBase<FormShadcnSelectOption>
> = {
  control: (base, state) => ({
    ...base,
    minHeight: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "var(--app-border)",
    boxShadow: state.isFocused
      ? "0 0 0 2px color-mix(in oklab, var(--app-primary) 20%, transparent)"
      : "0 1px 2px rgba(15, 23, 42, 0.04)",
    backgroundColor: "var(--app-surface-muted)",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
    transition: "border-color .15s ease, box-shadow .15s ease",
    ":hover": {
      borderColor: "var(--app-border)",
      backgroundColor: "var(--app-surface-muted)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 8px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: "var(--app-text)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--app-text)",
    fontSize: 12,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: "var(--app-muted)",
    padding: "0 8px",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "none",
    transition: "transform .15s ease",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 8,
    border: "1px solid var(--app-border)",
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.12)",
    overflow: "hidden",
    zIndex: 60,
  }),
  menuList: (base) => ({
    ...base,
    padding: 4,
    backgroundColor: "#ffffff",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 6,
    fontSize: 14,
    padding: "8px 10px",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "var(--app-primary)"
      : state.isFocused
        ? "var(--app-surface-muted)"
        : "#ffffff",
    color: state.isSelected ? "var(--app-primary-contrast)" : "var(--app-text)",
  }),
};

function DropdownIndicator(
  props: DropdownIndicatorProps<
    FormShadcnSelectOption,
    false,
    GroupBase<FormShadcnSelectOption>
  >,
) {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown className="h-3.5 w-3.5" />
    </components.DropdownIndicator>
  );
}

export function FormLabel({ className, ...props }: FormLabelProps) {
  return (
    <label
      className={cn(
        "block space-y-1 text-sm font-medium text-[var(--app-text)]",
        className,
      )}
      {...props}
    />
  );
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ className, ...props }, ref) {
    return (
      <input ref={ref} className={cn(baseControlClass, className)} {...props} />
    );
  },
);

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  function FormSelect({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          baseControlClass,
          "cursor-pointer appearance-none pr-10 transition-colors hover:bg-[var(--app-surface-muted)] focus:border-[var(--app-primary)] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22none%22%3E%3Cpath%20d=%27M5.5%207.5L10%2012l4.5-4.5%27%20stroke=%27%236b7280%27%20stroke-width=%271.6%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27/%3E%3C/svg%3E')] bg-[length:16px_16px] bg-no-repeat bg-[position:calc(100%-10px)_center]",
          className,
        )}
        {...props}
      />
    );
  },
);

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  function FormTextarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(baseControlClass, "resize-none", className)}
        {...props}
      />
    );
  },
);

export function FormShadcnSelect({
  id,
  value,
  options,
  onValueChange,
  isDisabled,
  ariaLabel,
  className,
  menuPlacement = "auto",
}: FormShadcnSelectProps) {
  const generatedId = useId();
  const selectId = id ?? `form-shadcn-select-${generatedId.replace(/:/g, "")}`;
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <div className={className}>
      <Select<FormShadcnSelectOption, false>
        unstyled
        instanceId={selectId}
        inputId={selectId}
        aria-label={ariaLabel}
        isSearchable={false}
        isDisabled={isDisabled}
        options={options}
        value={selected}
        menuPlacement={menuPlacement}
        components={{ DropdownIndicator, IndicatorSeparator: () => null }}
        styles={shadcnSelectStyles}
        onChange={(nextOption) => {
          const selectedOption =
            nextOption as SingleValue<FormShadcnSelectOption>;
          if (selectedOption?.value) {
            onValueChange(selectedOption.value);
          }
        }}
      />
    </div>
  );
}
