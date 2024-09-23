import type { ReactElement } from "react";

export const UI = {
  BlueLink: ({ children, href }: { children: string; href: string }) => (
    <a className="text-blue-500" href={href} target="_blank">
      {children}
    </a>
  ),
  HeadingField: ({ children }: { children: string }) => (
    <div className="mb-2 text-sm uppercase text-neutral-400">{children}</div>
  ),
  Heading1: ({ children }: { children: string }) => (
    <h1 className="mb-10 text-3xl font-medium">{children}</h1>
  ),
  Option: ({ children, value }: { children: string; value: string }) => (
    <option className="text-lg" value={value}>
      {children}
    </option>
  ),
  Select: ({
    children,
    defaultValue,
    onChange,
  }: {
    children:
      | ReactElement<HTMLSelectElement>
      | ReactElement<HTMLSelectElement>[];
    defaultValue?: string;
    onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  }) => (
    <select
      className="border-neutral-400 bg-white font-sans text-lg marker:-left-2 enabled:border enabled:p-2 disabled:appearance-none"
      defaultValue={defaultValue}
      onChange={onChange}
    >
      {children}
    </select>
  ),
};
