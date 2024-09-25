import { type ERC7730Schema } from "~/types";
import path from "path";
import fs from "fs";

export function parseMetadataFile(
  file: string,
  absolutePath: string,
): ERC7730Schema {
  const json = JSON.parse(file) as ERC7730Schema;

  const includes = json.includes;
  if (!includes) return json;

  const localFolderName = absolutePath.split("/").slice(0, -1).join("/");
  const includedPath = path.join(localFolderName, includes);
  const content: string = fs.readFileSync(includedPath, "utf-8");

  try {
    const aggregatedJson = {
      ...JSON.parse(content),
      ...json,
    } as ERC7730Schema;
    delete aggregatedJson.includes;
    return aggregatedJson;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return json;
  }
}
