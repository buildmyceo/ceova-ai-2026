// Ceova Cryptographic Invisible Watermarking & Provenance Engine
// Provides invisible zero-width unicode steganography for text/emails/calendar,
// metadata chunk watermarking for PNG/JPEG images, and custom attributes for Drive files.

const DEFAULT_SECRET = 'ceova-master-secret-key-2026-cctv-ai';

function getSecretKey(): string {
  try {
    // Deno environment check
    if (typeof (globalThis as any).Deno !== 'undefined' && (globalThis as any).Deno.env) {
      return (globalThis as any).Deno.env.get('CEOVA_WATERMARK_SECRET') || DEFAULT_SECRET;
    }
  } catch (_) {}
  try {
    // Node.js environment check
    if (typeof process !== 'undefined' && process.env) {
      return process.env.CEOVA_WATERMARK_SECRET || DEFAULT_SECRET;
    }
  } catch (_) {}
  return DEFAULT_SECRET;
}

// ---------------------------------------------------------------------------
// 1. Pure Synchronous SHA-256 and HMAC-SHA-256 (0 External Dependencies)
// ---------------------------------------------------------------------------

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function computeSha256(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = true;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength | 0;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        ((w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0) |
          0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (let i2 = 3; i2 >= 0; i2--) {
      const c = (hash[i] >> (i2 * 8)) & 255;
      result += (c < 16 ? '0' : '') + c.toString(16);
    }
  }
  return result;
}

function hexToBinaryStr(hex: string): string {
  let bin = '';
  for (let i = 0; i < hex.length; i += 2) {
    bin += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return bin;
}

export function computeHmacSha256(key: string, message: string): string {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) {
    k = hexToBinaryStr(computeSha256(k));
  }
  while (k.length < blockSize) {
    k += '\x00';
  }
  let oKeyPad = '';
  let iKeyPad = '';
  for (let i = 0; i < blockSize; i++) {
    oKeyPad += String.fromCharCode(k.charCodeAt(i) ^ 0x5c);
    iKeyPad += String.fromCharCode(k.charCodeAt(i) ^ 0x36);
  }
  const innerHash = hexToBinaryStr(computeSha256(iKeyPad + message));
  return computeSha256(oKeyPad + innerHash);
}

export function generateCeovaSignature(payload: any): string {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return computeHmacSha256(getSecretKey(), data);
}

export function verifyCeovaSignature(payload: any, signature: string): boolean {
  if (!signature) return false;
  const expected = generateCeovaSignature(payload);
  return expected.toLowerCase() === signature.toLowerCase();
}

// ---------------------------------------------------------------------------
// 2. Invisible Zero-Width Unicode Steganography (Emails, Texts, Calendar)
// ---------------------------------------------------------------------------
// Uses:
// \u200B = Zero-Width Space (Bit 0)
// \u200C = Zero-Width Non-Joiner (Bit 1)
// \u200D = Zero-Width Joiner (Delimiter)
// \uFEFF = Zero-Width No-Break Space / BOM (Header Anchor)

const ZW = {
  ZERO: '\u200B',
  ONE: '\u200C',
  DELIM: '\u200D',
  ANCHOR: '\uFEFF'
};

export interface WatermarkPayload {
  issuer: 'CEOVA_AI';
  target: 'email' | 'calendar' | 'drive' | 'image' | 'text';
  timestamp: number;
  userId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

export function embedInvisibleTextWatermark(
  text: string,
  extra: { target: WatermarkPayload['target']; userId?: string; traceId?: string; metadata?: Record<string, any> }
): string {
  const payload: WatermarkPayload = {
    issuer: 'CEOVA_AI',
    target: extra.target,
    timestamp: Date.now(),
    userId: extra.userId,
    traceId: extra.traceId || `cv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    metadata: extra.metadata
  };

  const jsonStr = JSON.stringify(payload);
  const signature = generateCeovaSignature(jsonStr);
  const token = `${btoa(unescape(encodeURIComponent(jsonStr)))}.${signature}`;

  // Encode token into zero-width binary sequence
  let zwBits = '';
  for (let i = 0; i < token.length; i++) {
    const code = token.charCodeAt(i);
    const bin = code.toString(2).padStart(8, '0');
    for (const b of bin) {
      zwBits += b === '1' ? ZW.ONE : ZW.ZERO;
    }
  }

  const envelope = ZW.ANCHOR + ZW.DELIM + zwBits + ZW.DELIM;
  return (text || '') + envelope;
}

export function extractAndVerifyTextWatermark(text: string): {
  verified: boolean;
  issuer?: string;
  payload?: WatermarkPayload;
  reason?: string;
  tampered?: boolean;
} {
  if (!text || typeof text !== 'string') {
    return { verified: false, reason: 'Empty or invalid text input' };
  }

  const anchorIdx = text.indexOf(ZW.ANCHOR + ZW.DELIM);
  if (anchorIdx === -1) {
    return { verified: false, reason: 'No hidden Ceova watermark found in text' };
  }

  const startIdx = anchorIdx + 2;
  const endIdx = text.indexOf(ZW.DELIM, startIdx);
  if (endIdx === -1) {
    return { verified: false, reason: 'Malformed hidden watermark sequence' };
  }

  const zwBits = text.substring(startIdx, endIdx);
  let binary = '';
  for (const ch of zwBits) {
    if (ch === ZW.ONE) binary += '1';
    else if (ch === ZW.ZERO) binary += '0';
  }

  if (binary.length === 0 || binary.length % 8 !== 0) {
    return { verified: false, reason: 'Corrupted watermark binary stream' };
  }

  let token = '';
  for (let i = 0; i < binary.length; i += 8) {
    token += String.fromCharCode(parseInt(binary.substring(i, i + 8), 2));
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { verified: false, reason: 'Invalid watermark token structure' };
  }

  try {
    const [b64Data, signature] = parts;
    const jsonStr = decodeURIComponent(escape(atob(b64Data)));
    const payload = JSON.parse(jsonStr) as WatermarkPayload;

    const isValid = verifyCeovaSignature(jsonStr, signature);
    if (!isValid) {
      return { verified: false, tampered: true, reason: 'Cryptographic signature mismatch! Content was forged or tampered.' };
    }

    return {
      verified: true,
      issuer: payload.issuer,
      payload
    };
  } catch (err: any) {
    return { verified: false, reason: `Failed to decode watermark: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 3. Image Watermarking (PNG tEXt chunk & JPEG COM Marker)
// ---------------------------------------------------------------------------

const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function embedImageWatermark(
  imageBytes: Uint8Array,
  extra: { prompt?: string; userId?: string; traceId?: string }
): Uint8Array {
  if (!imageBytes || imageBytes.length < 8) return imageBytes;

  const payload: WatermarkPayload = {
    issuer: 'CEOVA_AI',
    target: 'image',
    timestamp: Date.now(),
    userId: extra.userId,
    traceId: extra.traceId || `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    metadata: {
      prompt: extra.prompt ? extra.prompt.substring(0, 200) : undefined
    }
  };

  const jsonStr = JSON.stringify(payload);
  const signature = generateCeovaSignature(jsonStr);
  const watermarkText = `${btoa(unescape(encodeURIComponent(jsonStr)))}.${signature}`;

  // Check if PNG (89 50 4E 47 0D 0A 1A 0A)
  const isPng =
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47 &&
    imageBytes[4] === 0x0d &&
    imageBytes[5] === 0x0a &&
    imageBytes[6] === 0x1a &&
    imageBytes[7] === 0x0a;

  if (isPng) {
    const keyword = 'Ceova-Provenance';
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(keyword);
    const textBytes = encoder.encode(watermarkText);

    // Chunk data = keyword + null byte (0x00) + text
    const dataLen = keyBytes.length + 1 + textBytes.length;
    const chunkData = new Uint8Array(dataLen);
    chunkData.set(keyBytes, 0);
    chunkData[keyBytes.length] = 0x00;
    chunkData.set(textBytes, keyBytes.length + 1);

    // Chunk type: "tEXt" (0x74, 0x45, 0x58, 0x74)
    const typeBytes = new Uint8Array([0x74, 0x45, 0x58, 0x74]);

    // CRC covers type + data
    const crcInput = new Uint8Array(4 + dataLen);
    crcInput.set(typeBytes, 0);
    crcInput.set(chunkData, 4);
    const crc = computeCrc32(crcInput);

    // Total chunk size = 4 (length) + 4 (type) + dataLen + 4 (crc)
    const chunk = new Uint8Array(12 + dataLen);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, dataLen, false); // Length BE
    chunk.set(typeBytes, 4);
    chunk.set(chunkData, 8);
    view.setUint32(8 + dataLen, crc, false); // CRC BE

    // Insert right after IHDR chunk (33 bytes)
    const ihdrEnd = 8 + 4 + 4 + 13 + 4; // 33
    const result = new Uint8Array(imageBytes.length + chunk.length);
    result.set(imageBytes.subarray(0, ihdrEnd), 0);
    result.set(chunk, ihdrEnd);
    result.set(imageBytes.subarray(ihdrEnd), ihdrEnd + chunk.length);
    return result;
  }

  // Check if JPEG (FF D8)
  const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8;
  if (isJpeg) {
    const prefix = 'CEOVA_WATERMARK:';
    const fullText = prefix + watermarkText;
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(fullText);

    // JPEG COM marker: FF FE [2 bytes length = textBytes.length + 2] [comment bytes]
    const markerLen = textBytes.length + 2;
    const comMarker = new Uint8Array(4 + textBytes.length);
    comMarker[0] = 0xff;
    comMarker[1] = 0xfe;
    comMarker[2] = (markerLen >> 8) & 0xff;
    comMarker[3] = markerLen & 0xff;
    comMarker.set(textBytes, 4);

    // Insert immediately after SOI (FF D8 = 2 bytes)
    const result = new Uint8Array(imageBytes.length + comMarker.length);
    result.set(imageBytes.subarray(0, 2), 0);
    result.set(comMarker, 2);
    result.set(imageBytes.subarray(2), 2 + comMarker.length);
    return result;
  }

  return imageBytes;
}

export function extractAndVerifyImageWatermark(imageBytes: Uint8Array): {
  verified: boolean;
  issuer?: string;
  payload?: WatermarkPayload;
  format?: 'png' | 'jpeg';
  reason?: string;
  tampered?: boolean;
} {
  if (!imageBytes || imageBytes.length < 8) {
    return { verified: false, reason: 'Invalid or empty image bytes' };
  }

  let token: string | null = null;
  let detectedFormat: 'png' | 'jpeg' | undefined;

  // Check PNG
  const isPng =
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47;

  if (isPng) {
    detectedFormat = 'png';
    let offset = 8;
    const view = new DataView(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength);

    while (offset < imageBytes.length - 8) {
      const len = view.getUint32(offset, false);
      const type = String.fromCharCode(
        imageBytes[offset + 4],
        imageBytes[offset + 5],
        imageBytes[offset + 6],
        imageBytes[offset + 7]
      );

      if (type === 'tEXt') {
        const chunkData = imageBytes.subarray(offset + 8, offset + 8 + len);
        let nullIdx = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0x00) {
            nullIdx = i;
            break;
          }
        }
        if (nullIdx !== -1) {
          const keyword = new TextDecoder().decode(chunkData.subarray(0, nullIdx));
          if (keyword === 'Ceova-Provenance') {
            token = new TextDecoder().decode(chunkData.subarray(nullIdx + 1));
            break;
          }
        }
      }
      offset += 12 + len;
    }
  }

  // Check JPEG
  const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8;
  if (!token && isJpeg) {
    detectedFormat = 'jpeg';
    let offset = 2;
    while (offset < imageBytes.length - 4) {
      if (imageBytes[offset] === 0xff && imageBytes[offset + 1] === 0xfe) {
        const len = (imageBytes[offset + 2] << 8) | imageBytes[offset + 3];
        const comBytes = imageBytes.subarray(offset + 4, offset + 2 + len);
        const text = new TextDecoder().decode(comBytes);
        if (text.startsWith('CEOVA_WATERMARK:')) {
          token = text.replace('CEOVA_WATERMARK:', '');
          break;
        }
        offset += 2 + len;
      } else if (imageBytes[offset] === 0xff) {
        const marker = imageBytes[offset + 1];
        if (marker === 0xd9 || marker === 0xda) break; // End of image or SOS
        const len = (imageBytes[offset + 2] << 8) | imageBytes[offset + 3];
        offset += 2 + len;
      } else {
        offset++;
      }
    }
  }

  if (!token) {
    return { verified: false, format: detectedFormat, reason: 'No Ceova watermark chunk found in image file' };
  }

  try {
    const [b64Data, signature] = token.split('.');
    if (!b64Data || !signature) {
      return { verified: false, format: detectedFormat, reason: 'Invalid image watermark structure' };
    }

    const jsonStr = decodeURIComponent(escape(atob(b64Data)));
    const payload = JSON.parse(jsonStr) as WatermarkPayload;

    const isValid = verifyCeovaSignature(jsonStr, signature);
    if (!isValid) {
      return {
        verified: false,
        tampered: true,
        format: detectedFormat,
        reason: 'Image signature mismatch! The watermark or image was forged or modified.'
      };
    }

    return {
      verified: true,
      issuer: payload.issuer,
      format: detectedFormat,
      payload
    };
  } catch (err: any) {
    return { verified: false, format: detectedFormat, reason: `Error decoding image watermark: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 4. Universal Provenance Verifier Tool Helper
// ---------------------------------------------------------------------------

export async function verifyCeovaArtifact(
  type: 'auto' | 'text' | 'email' | 'image' | 'calendar' | 'drive',
  content: string | Uint8Array | Record<string, any>
): Promise<{
  isCeovaVerified: boolean;
  typeDetected: string;
  issuer: string;
  timestamp?: string;
  traceId?: string;
  details?: Record<string, any>;
  message: string;
}> {
  // If calendar object
  if (type === 'calendar' || (typeof content === 'object' && !(content instanceof Uint8Array) && (content.extendedProperties || content.summary))) {
    const obj = content as any;
    const priv = obj.extendedProperties?.private || {};
    const hasOrigin = priv.ceovaOrigin === 'true';
    const textVerify = extractAndVerifyTextWatermark(obj.description || '');

    if (hasOrigin || textVerify.verified) {
      return {
        isCeovaVerified: true,
        typeDetected: 'Google Calendar Event',
        issuer: 'CEOVA AI Suite',
        timestamp: textVerify.payload ? new Date(textVerify.payload.timestamp).toISOString() : new Date().toISOString(),
        traceId: textVerify.payload?.traceId || priv.ceovaTraceId || 'calendar_event',
        details: {
          summary: obj.summary,
          hasPrivateProperty: hasOrigin,
          hasDescriptionWatermark: textVerify.verified
        },
        message: '✅ Verified: This calendar event was created by Ceova AI.'
      };
    }
    return {
      isCeovaVerified: false,
      typeDetected: 'Google Calendar Event',
      issuer: 'Unknown',
      message: '❌ Verification failed: No Ceova watermark or signature found in this calendar event.'
    };
  }

  // If Drive file object
  if (type === 'drive' || (typeof content === 'object' && !(content instanceof Uint8Array) && (content.appProperties || content.properties))) {
    const obj = content as any;
    const appProps = obj.appProperties || {};
    const props = obj.properties || {};
    const isCeova = props.ceova_verified === 'true' || appProps.ceova_origin === 'Ceova-AI';

    if (isCeova) {
      return {
        isCeovaVerified: true,
        typeDetected: 'Google Drive File',
        issuer: 'CEOVA AI Suite',
        timestamp: appProps.ceova_created_at || new Date().toISOString(),
        traceId: appProps.ceova_signature || 'drive_file',
        details: {
          fileName: obj.name,
          properties: props,
          appProperties: appProps
        },
        message: '✅ Verified: This file was uploaded to Google Drive by Ceova AI.'
      };
    }
    return {
      isCeovaVerified: false,
      typeDetected: 'Google Drive File',
      issuer: 'Unknown',
      message: '❌ Verification failed: No Ceova provenance properties found on this Google Drive file.'
    };
  }

  // If Image Bytes or Base64 / URL
  if (type === 'image' || content instanceof Uint8Array || (typeof content === 'string' && (content.startsWith('data:image/') || content.startsWith('http')))) {
    let bytes: Uint8Array | null = null;
    if (content instanceof Uint8Array) {
      bytes = content;
    } else if (typeof content === 'string') {
      if (content.startsWith('data:image/')) {
        const b64 = content.split(',')[1];
        const binary = atob(b64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      } else if (content.startsWith('http')) {
        try {
          const res = await fetch(content);
          if (res.ok) {
            bytes = new Uint8Array(await res.arrayBuffer());
          }
        } catch (_) {}
      }
    }

    if (bytes) {
      const imgRes = extractAndVerifyImageWatermark(bytes);
      if (imgRes.verified) {
        return {
          isCeovaVerified: true,
          typeDetected: `Image (${imgRes.format?.toUpperCase() || 'Raster'})`,
          issuer: 'CEOVA AI Suite',
          timestamp: imgRes.payload ? new Date(imgRes.payload.timestamp).toISOString() : new Date().toISOString(),
          traceId: imgRes.payload?.traceId,
          details: imgRes.payload?.metadata,
          message: '✅ Verified: This image was generated and cryptographically signed by Ceova AI.'
        };
      }
      return {
        isCeovaVerified: false,
        typeDetected: `Image (${imgRes.format?.toUpperCase() || 'Unknown'})`,
        issuer: 'Unknown',
        message: `❌ Verification failed: ${imgRes.reason || 'No Ceova watermark found in image.'}`
      };
    }
  }

  // Fallback: Text or Email String
  if (typeof content === 'string') {
    const textRes = extractAndVerifyTextWatermark(content);
    if (textRes.verified) {
      const targetLabel = textRes.payload?.target === 'email' ? 'Email Message' : 'Text / Document';
      return {
        isCeovaVerified: true,
        typeDetected: targetLabel,
        issuer: 'CEOVA AI Suite',
        timestamp: textRes.payload ? new Date(textRes.payload.timestamp).toISOString() : new Date().toISOString(),
        traceId: textRes.payload?.traceId,
        details: textRes.payload?.metadata,
        message: `✅ Verified: This ${targetLabel.toLowerCase()} was authored and sent by Ceova AI.`
      };
    }
    return {
      isCeovaVerified: false,
      typeDetected: 'Text / Email',
      issuer: 'Unknown',
      message: `❌ Verification failed: ${textRes.reason || 'No hidden Ceova watermark detected.'}`
    };
  }

  return {
    isCeovaVerified: false,
    typeDetected: 'Unknown',
    issuer: 'Unknown',
    message: '❌ Unsupported content format or empty data.'
  };
}
