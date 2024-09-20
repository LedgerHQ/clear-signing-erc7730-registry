import { PreviewForm } from "~/app/PreviewForm";
import { type PreviewData } from "~/app/raw-data-example/page";
import { UI } from "~/app/UI";

export default function HomePage() {
  const mockData = {
    intent: "swap",
    displays: [{ label: "tx1", displayValue: "0xbe936…e403" }],
  } satisfies PreviewData;

  return (
    <main className="px-16 py-16 text-lg">
      <div className="container">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <PreviewForm />
        <pre>{JSON.stringify(mockData, null, 2)}</pre>
      </div>
    </main>
  );
}
