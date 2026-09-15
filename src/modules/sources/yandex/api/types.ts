import type { SourceErrorKind } from "@/types/source-dto";

//
// What crosses the Rust bridge for Yandex Music. The token never does: the
// frontend learns who is signed in, never how.
//

export interface YmAuthStatus {
  loggedIn: boolean;
  uid: number | null;
  hasPlus: boolean;
  displayName: string | null;
}

export interface YmDeviceCode {
  userCode: string;
  verificationUrl: string;
  /** Seconds until the code stops working. */
  expiresIn: number;
  /** Seconds between token polls (Rust does the polling). */
  interval: number;
}

/** `ym:auth` — how a sign-in progresses and how a session ends. */
export type YmAuthEvent
  = | { status: "pending" }
    | { status: "ok"; uid: number; hasPlus: boolean; displayName: string }
    | { status: "cancelled" }
    | { status: "codeExpired" }
    | { status: "expired" }
    | { status: "error"; message: string };

export interface YmRequestPayload {
  method?: "GET" | "POST";
  /** API path; `{uid}` is filled in on the Rust side. */
  path: string;
  query?: Record<string, string>;
  form?: Record<string, string>;
}

/** `ym_request` rejects with this shape (serialized `YmError`). */
export interface YmError {
  kind: Extract<SourceErrorKind, "AUTH" | "FORBIDDEN" | "RATE_LIMITED" | "NOT_FOUND" | "NETWORK" | "UNAVAILABLE" | "UNKNOWN">;
  message: string;
  retryAfterMs?: number;
}
