import { DevicesDemo } from "~/app/DevicesDemo";
import { PreviewForm } from "~/app/PreviewForm";
import { type PreviewData } from "~/app/raw-data-example/page";
import { UI } from "~/app/UI";

export default function HomePage() {
  const mockData = {
    intent: "Mint POAP",
    owner: "POAP",
    legalName: "Proof of Attendance Protocol",
    displays: [{ label: "tx1", displayValue: "0xbe936…e403" }],
  } satisfies PreviewData;

  const data = mockData;

  return (
    <main>
      <div className="container p-16 text-lg">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <PreviewForm />
      </div>
      <DevicesDemo data={data} />
      <pre className="container p-16">{JSON.stringify(mockData, null, 2)}</pre>
    </main>
  );
}
