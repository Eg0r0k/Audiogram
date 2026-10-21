export type UpdateErrorKind
  = | "NETWORK"
    | "INVALID_CHANNEL"
    | "NO_UPDATE_AVAILABLE"
    | "INSTALL_FAILED"
    | "UNKNOWN";

export interface UpdateError {
  kind: UpdateErrorKind;
  message: string;
}
