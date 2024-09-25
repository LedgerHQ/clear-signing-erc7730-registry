import listAllJsonInRegistry from "~/app/getAllFiles";
import PreviewTool from "~/app/PreviewTool";

export default function HomePage() {
  const jsonInRegistry = listAllJsonInRegistry();
  return <PreviewTool jsonInRegistry={jsonInRegistry} />;
}
