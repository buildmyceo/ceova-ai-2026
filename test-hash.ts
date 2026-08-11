import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

async function run() {
  const data = new TextEncoder().encode("hello world");
  const hash = await crypto.subtle.digest("MD5", data);
  console.log(new TextDecoder().decode(hexEncode(new Uint8Array(hash))));
}
run();
