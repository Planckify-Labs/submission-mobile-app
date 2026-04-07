/** Thrown by the ky afterResponse hook when the server returns HTTP 409. */
export class ApiConflictError extends Error {
  readonly statusCode = 409;
  constructor() {
    super("CONFLICT");
    this.name = "ApiConflictError";
  }
}
