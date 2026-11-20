/** Builds a ZIP in memory: method 0 (stored) or 8 (deflate-raw via CompressionStream). */
export async function makeZip(files: Array<{ path: string; data: Uint8Array; deflate?: boolean }>): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path);
    const body = f.deflate ? new Uint8Array(await new Response(new Response(f.data.slice().buffer as ArrayBuffer).body!.pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()) : f.data;
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true);
    loc.setUint16(8, f.deflate ? 8 : 0, true);
    loc.setUint32(18, body.length, true);
    loc.setUint32(22, f.data.length, true);
    loc.setUint16(26, name.length, true);
    parts.push(new Uint8Array(loc.buffer), name, body);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(10, f.deflate ? 8 : 0, true);
    cen.setUint32(20, body.length, true);
    cen.setUint32(24, f.data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + body.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)].map((u) => u.slice().buffer));
}

