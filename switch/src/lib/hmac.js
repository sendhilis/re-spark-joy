import { createHmac } from "node:crypto";

// Synchronous HMAC-SHA256, hex-encoded. Node's crypto is C-backed and faster
// than WebCrypto for this size of payload.
export function hmacSha256Hex(secret, data) {
  return createHmac("sha256", secret).update(data).digest("hex");
}
