/**
 * Minimal ZIP reader for previewing the seller's own photos ZIP in the browser (nothing is uploaded). Reads the
 * central directory, then single entries on demand: stored entries as-is, deflated ones with the browser's
 * DecompressionStream. ZIP64 and encrypted archives aren't supported (the server's 100 MB limit keeps us clear).
 */
export interface ZipEntry {
  /** Path inside the ZIP, "/" separated, as the server reports it. */
  path: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

/** Blob.arrayBuffer with a FileReader fallback for older engines. */
const buffer = (b: Blob) =>
  typeof b.arrayBuffer === "function"
    ? b.arrayBuffer()
    : new Promise<ArrayBuffer>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as ArrayBuffer);
        r.onerror = () => reject(r.error ?? new Error("This file couldn't be read."));
        r.readAsArrayBuffer(b);
      });
const bytes = async (file: Blob, start: number, end: number) => new DataView(await buffer(file.slice(start, end)));

/** Entries by lower-case path (the server matches paths case-insensitively). */
export async function listZip(file: Blob): Promise<Map<string, ZipEntry>> {
  const tail = Math.min(file.size, 22 + 0xffff);
  const end = await bytes(file, file.size - tail, file.size);
  let eocd = -1;
  for (let i = end.byteLength - 22; i >= 0; i--) {
    if (end.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This isn't a ZIP file.");
  const count = end.getUint16(eocd + 10, true);
  const size = end.getUint32(eocd + 12, true);
  const offset = end.getUint32(eocd + 16, true);
  const cd = await bytes(file, offset, offset + size);
  const utf8 = new TextDecoder();
  const out = new Map<string, ZipEntry>();
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== CEN) break;
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const path = utf8.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen)).replace(/\\/g, "/");
    if (!path.endsWith("/")) out.set(path.toLowerCase(), { path, method: cd.getUint16(p + 10, true), compressedSize: cd.getUint32(p + 20, true), localHeaderOffset: cd.getUint32(p + 42, true) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** One entry's contents as a Blob typed from its extension. */
export async function readZipEntry(file: Blob, e: ZipEntry): Promise<Blob> {
  const head = await bytes(file, e.localHeaderOffset, e.localHeaderOffset + 30);
  if (head.getUint32(0, true) !== LOC) throw new Error("This photo couldn't be read from the ZIP.");
  const start = e.localHeaderOffset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
  const data = file.slice(start, start + e.compressedSize);
  const type = TYPES[e.path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
  if (e.method === 0) return new Blob([await buffer(data)], { type });
  if (e.method === 8 && typeof DecompressionStream !== "undefined") {
    const raw = await new Response(new Response(await buffer(data)).body!.pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    return new Blob([raw], { type });
  }
  throw new Error("This photo can't be previewed here.");
}
