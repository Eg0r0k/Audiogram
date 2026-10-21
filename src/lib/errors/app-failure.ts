import type { AppError } from "./app-error";

export class AppFailure<E extends AppError = AppError> extends Error {
  constructor(readonly error: E) {
    super(error.message);
    this.name = "AppFailure";
  }
}
