export type TetherErrorCode =
  | "VALIDATION_FAILED"
  | "VERSION_CONFLICT"
  | "RESOURCE_IMMUTABLE"
  | "PLUGIN_INCOMPATIBLE"
  | "AUTHENTICATION_REQUIRED"
  | "TENANT_SCOPE_DENIED"
  | "RESOURCE_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT";

export class TetherError extends Error {
  readonly code: TetherErrorCode;
  readonly details: readonly string[];

  constructor(code: TetherErrorCode, message: string, details: readonly string[] = []) {
    super(message);
    this.name = "TetherError";
    this.code = code;
    this.details = details;
  }
}
