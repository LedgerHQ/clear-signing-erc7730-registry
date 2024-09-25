import listAllJsonInRegistry from "~/app/getAllFiles";
import PreviewTool from "~/app/PreviewTool";

export default function HomePage() {
  const allFiles = listAllJsonInRegistry();

  return <PreviewTool allFiles={allFiles} />;
}
