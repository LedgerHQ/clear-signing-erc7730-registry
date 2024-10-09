import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const bathPath = path.join(__dirname, "..", "..");
export const registryPath = path.join(bathPath, "registry");
