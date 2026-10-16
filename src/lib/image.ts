/**
 * Client-side image preparation for Vault uploads.
 *
 * A modern phone photo is 3–8 MB, which is slow to push through the Edge
 * Function and wasteful for a family archive that is viewed on a 400 px-wide
 * screen. Downscaling to a 2560 px long edge at JPEG q0.85 typically lands
 * around 300–800 KB with no visible loss at viewing size.
 *
 * The original EXIF capture date must be read *before* this runs, because
 * re-encoding drops metadata.
 */

const MAX_EDGE = 2560;
const QUALITY = 0.85;
/** Below this, re-encoding costs more than it saves. */
const SKIP_BELOW_BYTES = 400 * 1024;

export type PreparedUpload = {
  file: File;
  /** True when the bytes were re-encoded. */
  resized: boolean;
  width: number | null;
  height: number | null;
};

function passthrough(file: File): PreparedUpload {
  return { file, resized: false, width: null, height: null };
}

/**
 * Returns a smaller JPEG when that helps, or the original file otherwise.
 * Never throws: if the browser cannot decode the image, the original is sent.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedUpload> {
  if (!file.type.startsWith("image/")) return passthrough(file);
  // Re-encoding a GIF would drop the animation, and SVG is vector — leave both.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return passthrough(file);
  if (file.size < SKIP_BELOW_BYTES) return passthrough(file);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longest = Math.max(bitmap.width, bitmap.height);
    if (!longest) return passthrough(file);

    const scale = Math.min(1, MAX_EDGE / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return passthrough(file);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return passthrough(file);

    const name = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return {
      file: new File([blob], name, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      }),
      resized: true,
      width,
      height,
    };
  } catch {
    return passthrough(file);
  } finally {
    bitmap?.close();
  }
}
