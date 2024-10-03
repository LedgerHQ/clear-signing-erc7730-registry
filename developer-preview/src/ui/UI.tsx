import Image from "next/image";
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
    return <El className={cn("p-5", className)}>{children}</El>;
  },
  FauxInput: ({
    children,
    error = false,
  }: {
    children: ReactNode;
    error?: boolean;
  }) => (
    <div
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        error ? "text-red-400" : "bg-[#fff1]",
      )}
    >
      {children}
    </div>
  ),
  InputText: ({ children }: { children: string }) => (
    <div className="font-medium text-white">{children}</div>
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
    <div className="mb-2 text-sm font-medium text-tool-neutral-70">
      {children}
    </div>
  ),
  Heading1: ({ children }: { children: string }) => (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-[#fff1] p-3">
        <Image
          src="/assets/Ledger-favicon.svg"
          width={20}
          height={17.5}
          alt="Logo"
        />
      </div>
      <h1 className="text-lg font-medium">{children}</h1>
    </div>
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
