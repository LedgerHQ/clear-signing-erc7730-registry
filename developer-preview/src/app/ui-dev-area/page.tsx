import listAllJsonInRegistry from "~/app/getAllFiles";
import DevFocus from "~/app/ui-dev-area/DevFocus";

export default function HomePage() {
  const jsonInRegistry = listAllJsonInRegistry();
  return <DevFocus jsonInRegistry={jsonInRegistry} />;
}
