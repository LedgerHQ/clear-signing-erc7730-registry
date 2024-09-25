import { type ERC7730Schema } from "~/types";
import path from "path";
import fs from "fs";

export function parseMetadataFile(
  file: string,
  absolutePath: string,
): ERC7730Schema {
  const jsonMainFile = JSON.parse(file) as ERC7730Schema;
  const includesValue = jsonMainFile.includes;

  if (!includesValue) return jsonMainFile;

  const localFolderName = absolutePath.split("/").slice(0, -1).join("/");
  const includesPath = path.join(localFolderName, includesValue);
  const includesFileContent: string = fs.readFileSync(includesPath, "utf-8");

  try {
    const aggregatedJson = {
      ...JSON.parse(includesFileContent),
      ...jsonMainFile,
    } as ERC7730Schema;
    delete aggregatedJson.includes;
    return aggregatedJson;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return jsonMainFile;
  }
}
