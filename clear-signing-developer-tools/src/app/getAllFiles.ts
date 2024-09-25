import fs from "fs";
import path from "path";

import { registryPath } from "~/constants";

function listAllJsonInRegistry() {
  const files: string[] = [];
  listAllJsonInPath(files, registryPath);
  return files;
}

function listAllJsonInPath(files: string[], currentPath: string) {
  fs.readdirSync(currentPath).forEach((fileOrDir) => {
    const fullPath = path.join(currentPath, fileOrDir);
    if (isDirectory(fullPath)) {
      listAllJsonInPath(files, fullPath);
      return;
    }

    const fileLabel = fullPath.replace(registryPath, "");
    files.push(fileLabel);
  });
}
function isDirectory(candidatePath: string) {
  return fs.lstatSync(candidatePath).isDirectory();
}

export default listAllJsonInRegistry;
