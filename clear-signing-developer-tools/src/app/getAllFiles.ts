import fs from "fs";
import path from "path";

import { registryPath } from "~/constants";

type Files = Array<{
  fullPath: string;
  label: string;
}>;

function listAllJsonInRegistry(): Files {
  const files: Files = [];
  listAllJsonInPath(files, registryPath);
  return files;
}

function listAllJsonInPath(files: Files, currentPath: string) {
  fs.readdirSync(currentPath).forEach((fileOrDir) => {
    const fullPath = path.join(currentPath, fileOrDir);
    if (isDirectory(fullPath)) {
      listAllJsonInPath(files, fullPath);
      return;
    }
    files.push({ fullPath, label: fullPath.replace(registryPath, "") });
  });
}
function isDirectory(candidatePath: string) {
  return fs.lstatSync(candidatePath).isDirectory();
}

export default listAllJsonInRegistry;
