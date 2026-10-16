/**
 * Reads the capture date out of a JPEG's EXIF block.
 *
 * The Vault groups memories by year, and a photo's "when" is the moment it was
 * taken — not when it was uploaded. Re-encoding a photo through a canvas (which
 * we do to keep uploads small) strips its metadata, so the date is read from the
 * original bytes *before* any resizing happens.
 *
 * Only the three DateTime tags are read; this is deliberately not a general
 * EXIF parser.
 */

const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const MAX_HEADER_BYTES = 256 * 1024;

/** EXIF stores `YYYY:MM:DD HH:MM:SS` with no timezone. */
function parseExifDate(value: string): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (Number.isNaN(date.getTime())) return null;
  // Years before 1970 mean a camera with a flat battery, not a memory.
  if (date.getFullYear() < 1970) return null;
  return date.toISOString();
}

type IfdEntry = { tag: number; type: number; count: number; valueOffset: number };

function readEntries(view: DataView, offset: number, little: boolean): IfdEntry[] {
  if (offset + 2 > view.byteLength) return [];
  const count = view.getUint16(offset, little);
  // A malformed count is the classic way to blow up a parser (and the heap).
  if (count > 512) return [];
  const entries: IfdEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = offset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) break;
    entries.push({
      tag: view.getUint16(entryOffset, little),
      type: view.getUint16(entryOffset + 2, little),
      count: view.getUint32(entryOffset + 4, little),
      valueOffset: entryOffset + 8,
    });
  }
  return entries;
}

/** ASCII values longer than 4 bytes live elsewhere in the buffer. */
function readAscii(view: DataView, entry: IfdEntry, little: boolean): string | null {
  if (entry.type !== 2 || entry.count > 64) return null;
  const start = entry.count <= 4 ? entry.valueOffset : view.getUint32(entry.valueOffset, little);
  if (start < 0 || start + entry.count > view.byteLength) return null;
  let text = "";
  for (let index = 0; index < entry.count; index += 1) {
    const code = view.getUint8(start + index);
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text;
}

export function readExifCaptureDate(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return null;
  // JPEG SOI + marker.
  if (view.getUint16(0, false) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    if ((marker & 0xff00) !== 0xff00) return null;
    const size = view.getUint16(offset + 2, false);
    if (size < 2) return null;

    if (marker === 0xffe1) {
      const segment = offset + 4;
      // "Exif\0\0"
      if (
        segment + 6 <= view.byteLength &&
        view.getUint32(segment, false) === 0x45786966 &&
        view.getUint16(segment + 4, false) === 0x0000
      ) {
        return readTiff(view, segment + 6);
      }
    }
    // Start of scan / end of image: no EXIF past here.
    if (marker === 0xffda || marker === 0xffd9) return null;
    offset += 2 + size;
  }
  return null;
}

function readTiff(view: DataView, tiffStart: number): string | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart, false);
  const little = byteOrder === 0x4949;
  if (!little && byteOrder !== 0x4d4d) return null;
  if (view.getUint16(tiffStart + 2, little) !== 0x002a) return null;

  const ifd0 = tiffStart + view.getUint32(tiffStart + 4, little);
  const entries0 = readEntries(view, ifd0, little);

  let fallback: string | null = null;
  let exifIfdOffset: number | null = null;

  for (const entry of entries0) {
    if (entry.tag === TAG_DATETIME) {
      const value = readAscii(view, entry, little);
      if (value) fallback = parseExifDate(value);
    } else if (entry.tag === TAG_EXIF_IFD) {
      exifIfdOffset = tiffStart + view.getUint32(entry.valueOffset, little);
    }
  }

  if (exifIfdOffset !== null) {
    const entriesExif = readEntries(view, exifIfdOffset, little);
    let digitized: string | null = null;
    for (const entry of entriesExif) {
      if (entry.tag !== TAG_DATETIME_ORIGINAL && entry.tag !== TAG_DATETIME_DIGITIZED) {
        continue;
      }
      const value = readAscii(view, entry, little);
      if (!value) continue;
      const parsed = parseExifDate(value);
      if (!parsed) continue;
      // DateTimeOriginal is the moment of capture; prefer it over anything else.
      if (entry.tag === TAG_DATETIME_ORIGINAL) return parsed;
      digitized = digitized ?? parsed;
    }
    if (digitized) return digitized;
  }

  return fallback;
}

/**
 * Best-effort capture date for a picked file. Only the first
 * `MAX_HEADER_BYTES` are read, which is where EXIF always lives.
 */
export async function readCaptureDate(file: File): Promise<string | null> {
  if (file.type !== "image/jpeg" && !/\.jpe?g$/i.test(file.name)) return null;
  try {
    const header = await file.slice(0, MAX_HEADER_BYTES).arrayBuffer();
    return readExifCaptureDate(header);
  } catch {
    return null;
  }
}
