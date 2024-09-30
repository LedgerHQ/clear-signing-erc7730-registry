import fs from "fs";
import path from "path";
import { type NextRequest } from "next/server";
import { registryPath } from "~/constants";
import { parseMetadataFile } from "~/app/api/file/parseMetadataFile";

export async function GET(request: NextRequest) {
  const label = new URL(request.url).searchParams.get("label");

  if (!label) {
    return new Response("Label query expected", { status: 400 });
  }
  const absolutePath = path.join(registryPath, label);

  try {
    const content: string = fs.readFileSync(absolutePath, "utf-8");
    const json = parseMetadataFile(content, absolutePath);

    return new Response(JSON.stringify(json), {
      headers: {
        "content-type": "application/json",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return new Response("File not found", { status: 404 });
  }
}
