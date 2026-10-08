import { createHmac } from "node:crypto";

export function hmacSha256Hex(key: string, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

export function signPayload(secret: string, timestamp: string, body: string): string {
  return hmacSha256Hex(secret, `${timestamp}.${body}`);
}
