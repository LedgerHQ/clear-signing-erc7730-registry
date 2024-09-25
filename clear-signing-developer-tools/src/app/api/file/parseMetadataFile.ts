export function parseMetadataFile(file: string) {
  const json = JSON.parse(file) as unknown;
  return json;
}
