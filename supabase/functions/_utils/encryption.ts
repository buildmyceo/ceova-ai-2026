/**
 * AES-GCM Encryption Utility for Supabase Edge Functions
 */

const ENCRYPTION_KEY_RAW = Deno.env.get("ENCRYPTION_KEY") || "default_fallback_key_32_chars_long!!";

async function getCryptoKey() {
  const enc = new TextEncoder();
  const keyData = enc.encode(ENCRYPTION_KEY_RAW.padEnd(32, '0').slice(0, 32));
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(text: string) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedText = enc.encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedText
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

export async function decrypt(encrypted: { iv: number[]; data: number[] }) {
  const key = await getCryptoKey();
  const iv = new Uint8Array(encrypted.iv);
  const data = new Uint8Array(encrypted.data);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}
