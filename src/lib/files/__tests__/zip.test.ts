import { describe, expect, it } from "vitest";
import { listZip, readZipEntry } from "../zip";
import { makeZip } from "@/test/zip";

const bytesOf = (b: Blob) => new Promise<Uint8Array>((res) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(b); });

describe("zip reader (photo preview)", () => {
  it("lists entries case-insensitively and reads stored and deflated photos", async () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 3, 3, 3, 3, 3, 3]);
    const zip = await makeZip([
      { path: "Shalom Inventory/", data: new Uint8Array() },
      { path: "Shalom Inventory/002_Pipe_01.JPG", data: jpg },
      { path: "002_Pipe_02.png", data: jpg, deflate: true },
    ]);
    const entries = await listZip(zip);
    expect([...entries.keys()]).toEqual(["shalom inventory/002_pipe_01.jpg", "002_pipe_02.png"]);
    const a = await readZipEntry(zip, entries.get("shalom inventory/002_pipe_01.jpg")!);
    expect(a.type).toBe("image/jpeg");
    expect(await bytesOf(a)).toEqual(jpg);
    const b = await readZipEntry(zip, entries.get("002_pipe_02.png")!);
    expect(b.type).toBe("image/png");
    expect(await bytesOf(b)).toEqual(jpg);
  });

  it("says so when the file isn't a ZIP", async () => {
    await expect(listZip(new Blob(["hello"]))).rejects.toThrow(/isn't a ZIP/);
  });
});
