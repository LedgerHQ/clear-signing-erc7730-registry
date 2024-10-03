import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/ui/select";

export const UI = {
  Container: ({
    as = "div",
    children,
    className,
  }: {
    as?: keyof HTMLElementTagNameMap;
    children: ReactNode;
    className?: string;
  }) => {
    const El = as;
    return <El className={cn("p-4", className)}>{children}</El>;
  },
  FauxInput: ({
    children,
    error = false,
  }: {
    children: ReactNode;
    error: boolean;
  }) => (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        error ? "border-red-400" : "border-tool-neutral-20",
      )}
    >
      {children}
    </div>
  ),
  InputText: ({ children }: { children: string }) => (
    <div className="font-medium">{children}</div>
  ),
  GreyLink: ({
    children,
    ...props
  }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
    children: string;
  }) => (
    <a className="text-sm text-tool-neutral-70" {...props}>
      {children}
    </a>
  ),
  Label: ({ children }: { children: string }) => (
    <div className="mb-2 text-sm text-tool-neutral-70">{children}</div>
  ),
  Heading1: ({ children }: { children: string }) => (
    <h1 className="text-lg font-medium">{children}</h1>
  ),
  Select: ({
    fullWidth = true,
    items,
    onChange,
    placeholder,
    value,
  }: {
    fullWidth?: boolean;
    items: string[] | { value: string; label: string }[];
    onChange: (value: string) => void | undefined;
    placeholder: string;
    value: string;
  }) => (
    <Select defaultValue={value} onValueChange={onChange}>
      <SelectTrigger className={cn(!fullWidth && "w-auto")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((key) =>
          typeof key === "object" ? (
            <SelectItem key={key.value} value={key.value}>
              {key.label}
            </SelectItem>
          ) : (
            <SelectItem key={key} value={key}>
              {key}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  ),
};
