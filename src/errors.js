export class TetherError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "TetherError";
    this.code = code;
    this.details = details;
  }
}
