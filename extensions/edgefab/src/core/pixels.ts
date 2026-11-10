// Pictures as plain RGBA pixels, in JavaScript: no native libraries, so it runs anywhere the core does.
// JPEG through jpeg-js and PNG through pngjs (both bundled); WebP isn't read yet.

import * as jpeg from "jpeg-js";
import { PNG } from "pngjs";

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes a pixel, rows top to bottom. */
  data: Uint8Array;
}

export class PixelsError extends Error {}

export function blank(width: number, height: number, rgba: [number, number, number, number]): Pixels {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

/** Reads a JPEG or PNG. */
export function decode(bytes: Uint8Array, mime: string): Pixels {
  if (mime === "image/jpeg" || (bytes[0] === 0xff && bytes[1] === 0xd8)) {
    const j = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048, maxResolutionInMP: 200 });
    return { width: j.width, height: j.height, data: j.data };
  }
  if (mime === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50)) {
    const p = PNG.sync.read(Buffer.from(bytes));
    return { width: p.width, height: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) };
  }
  throw new PixelsError(`EDGEfab can't read ${mime || "this kind of"} picture yet (only JPEG and PNG).`);
}

export function encodePng(img: Pixels): Buffer {
  const p = new PNG({ width: img.width, height: img.height });
  Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length).copy(p.data);
  return PNG.sync.write(p, { deflateLevel: 6 });
}

/** A part of a picture, as its own picture. */
export function crop(img: Pixels, x: number, y: number, width: number, height: number): Pixels {
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * img.width + x) * 4;
    out.set(img.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { width, height, data: out };
}

/** Resized: each new pixel the average of the old ones under it (smaller), or bilinear (larger). */
export function resize(img: Pixels, width: number, height: number): Pixels {
  if (width === img.width && height === img.height) return img;
  const out = new Uint8Array(width * height * 4);
  const sx = img.width / width;
  const sy = img.height / height;
  const src = img.data;
  if (sx >= 1 && sy >= 1) {
    for (let y = 0; y < height; y++) {
      const y0 = Math.floor(y * sy);
      const y1 = Math.max(y0 + 1, Math.min(img.height, Math.floor((y + 1) * sy)));
      for (let x = 0; x < width; x++) {
        const x0 = Math.floor(x * sx);
        const x1 = Math.max(x0 + 1, Math.min(img.width, Math.floor((x + 1) * sx)));
        let r = 0, g = 0, b = 0, a = 0;
        for (let yy = y0; yy < y1; yy++) {
          let i = (yy * img.width + x0) * 4;
          for (let xx = x0; xx < x1; xx++, i += 4) {
            r += src[i];
            g += src[i + 1];
            b += src[i + 2];
            a += src[i + 3];
          }
        }
        const n = (y1 - y0) * (x1 - x0);
        const o = (y * width + x) * 4;
        out[o] = r / n;
        out[o + 1] = g / n;
        out[o + 2] = b / n;
        out[o + 3] = a / n;
      }
    }
    return { width, height, data: out };
  }
  for (let y = 0; y < height; y++) {
    const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(img.height - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const tx = fx - x0;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = src[(y0 * img.width + x0) * 4 + c] * (1 - tx) + src[(y0 * img.width + x1) * 4 + c] * tx;
        const bottom = src[(y1 * img.width + x0) * 4 + c] * (1 - tx) + src[(y1 * img.width + x1) * 4 + c] * tx;
        out[o + c] = top * (1 - ty) + bottom * ty;
      }
    }
  }
  return { width, height, data: out };
}

/** Puts `img` into `into` at (x, y), with `pad` pixels round it copied from its edges, so mipmaps don't bleed. */
export function blit(into: Pixels, img: Pixels, x: number, y: number, pad: number): void {
  for (let ty = y - pad; ty < y + img.height + pad; ty++) {
    if (ty < 0 || ty >= into.height) continue;
    const sy = Math.min(img.height - 1, Math.max(0, ty - y));
    for (let tx = x - pad; tx < x + img.width + pad; tx++) {
      if (tx < 0 || tx >= into.width) continue;
      const sx = Math.min(img.width - 1, Math.max(0, tx - x));
      const s = (sy * img.width + sx) * 4;
      const o = (ty * into.width + tx) * 4;
      into.data[o] = img.data[s];
      into.data[o + 1] = img.data[s + 1];
      into.data[o + 2] = img.data[s + 2];
      into.data[o + 3] = img.data[s + 3];
    }
  }
}

/** Multiplies every pixel by a factor per channel (glTF's factors baked in). */
export function multiply(img: Pixels, f: [number, number, number, number]): Pixels {
  if (f.every((v) => v === 1)) return img;
  const data = new Uint8Array(img.data.length);
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 4; c++) data[i + c] = Math.min(255, img.data[i + c] * f[c]);
  return { width: img.width, height: img.height, data };
}
