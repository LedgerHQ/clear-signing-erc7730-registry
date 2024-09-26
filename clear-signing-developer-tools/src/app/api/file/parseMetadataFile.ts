import { type ERC7730Schema } from "~/types";
import path from "path";
import fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const key of Object.keys(source)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (source[key] instanceof Object && key in target) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return Object.assign(target || {}, source);
}

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
    const aggregatedJson = deepMerge(
      JSON.parse(includesFileContent),
      jsonMainFile,
    ) as ERC7730Schema;
    delete aggregatedJson.includes;
    return aggregatedJson;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return jsonMainFile;
  }
}
