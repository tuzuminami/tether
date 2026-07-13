/**
 * Collision-free encoding for opaque storage and lock keys.
 *
 * Each component is byte-length-prefixed, so delimiters inside tenant or
 * resource identifiers cannot change the key boundary.
 */
export function encodeStorageKey(...parts: readonly string[]): string {
  return parts.map((part) => `${Buffer.byteLength(part, "utf8")}:${part}`).join("");
}
