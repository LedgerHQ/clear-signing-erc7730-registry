import { DevicesDemo } from "~/app/DevicesDemo";
import { PreviewForm } from "~/app/PreviewForm";
import { type PreviewData } from "~/types/PreviewData";
import { UI } from "~/app/UI";
import { extractDisplayFields } from "~/app/raw-data-example/extractDisplayFields";
import poapMetaDataFile from "../../../registry/poap/calldata-PoapBridge.json";
import { type ERC7730Schema } from "~/types";

export default function HomePage() {
  const wipParsedData = extractDisplayFields(
    poapMetaDataFile as unknown as ERC7730Schema,
  );

  const data = {
    ...wipParsedData,
    intent: "Mint POAP",
  } satisfies PreviewData;

  return (
    <main>
      <div className="container p-16 text-lg">
        <UI.Heading1>Open Clear Signing Format preview</UI.Heading1>
        <PreviewForm />
      </div>
      <DevicesDemo data={data} />
      <pre className="container p-16">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
