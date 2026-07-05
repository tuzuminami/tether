import type { TetherErrorCode } from "./types.js";

export class TetherError extends Error {
  readonly code: TetherErrorCode;
  readonly details: string[];

  constructor(code: TetherErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = "TetherError";
    this.code = code;
    this.details = details;
  }
}
