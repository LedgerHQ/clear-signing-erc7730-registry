import type { ReactElement } from "react";

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
  HeadingField: ({ children }: { children: string }) => (
    <div className="mb-2 text-sm uppercase text-neutral-400">{children}</div>
  ),
  Heading1: ({ children }: { children: string }) => (
    <h1 className="mb-10 text-3xl font-medium">{children}</h1>
  ),
  Option: ({
    children,
    ...props
  }: Omit<React.OptionHTMLAttributes<HTMLOptionElement>, "className"> & {
    children: string;
  }) => (
    <option className="text-lg" {...props}>
      {children}
    </option>
  ),
  Error: ({ children }: { children: string }) => (
    <div className="inline-block bg-red-400 px-2 py-1">{children}</div>
  ),
  Select: ({
    children,
    ...props
  }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    children:
      | ReactElement<HTMLSelectElement>
      | ReactElement<HTMLSelectElement>[];
  }) => (
    <select
      className="border-neutral-400 bg-white font-sans text-lg marker:-left-2 enabled:border enabled:p-2 disabled:appearance-none"
      {...props}
    >
      {children}
    </select>
  ),
};
