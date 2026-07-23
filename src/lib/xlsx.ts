// Minimal, dependency-free .xlsx writer. Builds a single-sheet workbook from
// rows of strings/numbers and packages the OOXML parts into a STORED
// (uncompressed) ZIP with correct CRC-32s — so Excel, Google Sheets, and Numbers
// all open it as a native, typed workbook (numbers stay numbers). We avoid a
// dependency because the only thing needed here is a plain table export.

export type XlsxCell = string | number | null | undefined;

// ── CRC-32 (ZIP requires it per entry) ───────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function xmlEscape(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (ch) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch] as string,
  );
}

// 0-based column index → spreadsheet letters (0→A, 25→Z, 26→AA…).
function colLetter(index: number): string {
  let s = "";
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function isNumericCell(v: XlsxCell): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function sheetXml(rows: XlsxCell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((val, c) => {
          const ref = `${colLetter(c)}${r + 1}`;
          if (val == null || val === "") return "";
          if (isNumericCell(val)) return `<c r="${ref}"><v>${val}</v></c>`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
            String(val),
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(
    sheetName,
  )}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

// ── STORED ZIP packaging ──────────────────────────────────────────────────────
type ZipEntry = { name: string; data: Buffer; crc: number; offset: number };

function localHeader(name: Buffer, crc: number, size: number): Buffer {
  const h = Buffer.alloc(30 + name.length);
  h.writeUInt32LE(0x04034b50, 0); // local file header signature
  h.writeUInt16LE(20, 4); // version needed
  h.writeUInt16LE(0, 6); // flags
  h.writeUInt16LE(0, 8); // method = 0 (stored)
  h.writeUInt16LE(0, 10); // mod time
  h.writeUInt16LE(0x21, 12); // mod date = 1980-01-01
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(size, 18); // compressed size
  h.writeUInt32LE(size, 22); // uncompressed size
  h.writeUInt16LE(name.length, 26);
  h.writeUInt16LE(0, 28); // extra len
  name.copy(h, 30);
  return h;
}

function centralHeader(e: ZipEntry): Buffer {
  const name = Buffer.from(e.name, "utf8");
  const h = Buffer.alloc(46 + name.length);
  h.writeUInt32LE(0x02014b50, 0); // central dir signature
  h.writeUInt16LE(20, 4); // version made by
  h.writeUInt16LE(20, 6); // version needed
  h.writeUInt16LE(0, 8); // flags
  h.writeUInt16LE(0, 10); // method
  h.writeUInt16LE(0, 12); // mod time
  h.writeUInt16LE(0x21, 14); // mod date
  h.writeUInt32LE(e.crc, 16);
  h.writeUInt32LE(e.data.length, 20); // compressed size
  h.writeUInt32LE(e.data.length, 24); // uncompressed size
  h.writeUInt16LE(name.length, 28);
  h.writeUInt16LE(0, 30); // extra
  h.writeUInt16LE(0, 32); // comment
  h.writeUInt16LE(0, 34); // disk number
  h.writeUInt16LE(0, 36); // internal attrs
  h.writeUInt32LE(0, 38); // external attrs
  h.writeUInt32LE(e.offset, 42); // local header offset
  name.copy(h, 46);
  return h;
}

function zip(files: { name: string; content: string }[]): Buffer {
  const chunks: Buffer[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  for (const f of files) {
    const data = Buffer.from(f.content, "utf8");
    const nameBuf = Buffer.from(f.name, "utf8");
    const crc = crc32(data);
    const header = localHeader(nameBuf, crc, data.length);
    entries.push({ name: f.name, data, crc, offset });
    chunks.push(header, data);
    offset += header.length + data.length;
  }

  const central: Buffer[] = entries.map(centralHeader);
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const centralOffset = offset;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...chunks, ...central, end]);
}

/** Build a one-sheet .xlsx workbook from a 2-D array of cells. Returns the file bytes. */
export function buildXlsx(rows: XlsxCell[][], sheetName = "Sheet1"): Buffer {
  return zip([
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: ROOT_RELS },
    { name: "xl/workbook.xml", content: workbookXml(sheetName) },
    { name: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml(rows) },
  ]);
}
