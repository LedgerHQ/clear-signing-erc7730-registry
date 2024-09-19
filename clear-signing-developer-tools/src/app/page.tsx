import { type ReactElement } from "react";
import { type PreviewData } from "~/app/raw-data-example/page";

const UI = {
  BlueLink: ({ children, href }: { children: string; href: string }) => (
    <a className="text-blue-500" href={href}>
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
  }: {
    children:
      | ReactElement<HTMLSelectElement>
      | ReactElement<HTMLSelectElement>[];
  }) => (
    <select className="border border-neutral-400 bg-white p-2 font-sans text-lg marker:-left-2 marker:hidden">
      {children}
    </select>
  ),
};

export default function HomePage() {
  const mockData = {
    intent: "swap",
    displays: [{ label: "tx1", displayValue: "0xbe936…e403" }],
  } satisfies PreviewData;

  return (
    <main className="px-16 py-16 text-lg">
      <div className="container">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <form className="flex flex-col gap-6">
          <div>
            <UI.HeadingField>Contract</UI.HeadingField>
            <div>
              Uniswap_V3 (<UI.BlueLink href="#">0x4c…cbe9de5</UI.BlueLink>)
            </div>
          </div>
          <div>
            <UI.HeadingField>Function</UI.HeadingField>
            <div>
              swap_1: “Swap with Uniswap (
              <UI.BlueLink href="#">0xfc6f7865</UI.BlueLink>)
            </div>
          </div>
          <div>
            <UI.HeadingField>Preview example</UI.HeadingField>
            <UI.Select>
              <UI.Option value="">tx1 (0xbe936…e403e7b62)</UI.Option>
            </UI.Select>
          </div>
          <div>
            <UI.HeadingField>Preview on</UI.HeadingField>
            <UI.Select>
              <option value="Stax">Ledger Stax</option>
            </UI.Select>
          </div>
        </form>
        <pre>{JSON.stringify(mockData, null, 2)}</pre>
      </div>
    </main>
  );
}
