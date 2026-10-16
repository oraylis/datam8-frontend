import fs from "node:fs";

const decoder = new TextDecoder("windows-1252");
const undefinedBytes = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);
const encodedCharacters = new Map<string, number>();
for (let byte = 0; byte <= 0xff; byte += 1) {
  if (!undefinedBytes.has(byte)) {
    encodedCharacters.set(decoder.decode(Uint8Array.of(byte)), byte);
  }
}

export function readSolutionText(filePath: string): string {
  const bytes = fs.readFileSync(filePath);
  if (bytes.some((byte) => undefinedBytes.has(byte))) {
    throw new Error(`Invalid Windows-1252 byte in solution file: ${filePath}`);
  }
  return decoder.decode(bytes);
}

export function writeSolutionText(filePath: string, content: string): void {
  const bytes: number[] = [];
  for (const character of content) {
    const byte = encodedCharacters.get(character);
    if (byte === undefined) {
      const codePoint = character.codePointAt(0)!.toString(16).toUpperCase();
      throw new Error(`Cannot write U+${codePoint} as Windows-1252: ${filePath}`);
    }
    bytes.push(byte);
  }
  // Encode completely before opening the file so unsupported text cannot truncate it.
  fs.writeFileSync(filePath, Uint8Array.from(bytes));
}
