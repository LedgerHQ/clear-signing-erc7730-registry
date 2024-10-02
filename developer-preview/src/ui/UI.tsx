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
  BlueLink: ({
    children,
    ...props
  }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className"> & {
    children: string;
  }) => (
    <a className="text-blue-500" {...props}>
      {children}
    </a>
  ),
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
  HeadingField: ({ children }: { children: string }) => (
    <div className="mb-2 text-sm uppercase text-neutral-400">{children}</div>
  ),
  Heading1: ({ children }: { children: string }) => (
    <h1 className="text-sm font-medium">{children}</h1>
  ),
  Error: ({ children }: { children: string }) => (
    <div className="inline-block bg-red-400 px-2 py-1">{children}</div>
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
