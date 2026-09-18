import { errorMessage } from "@/lib/errors";
import { runPlayerScript } from "./eval-script";

export interface EvalRequest {
  id: number;
  output: string;
}

export type EvalReply
  = | { id: number; result: Record<string, unknown> }
    | { id: number; error: string };

self.onmessage = (event: MessageEvent<EvalRequest>) => {
  const { id, output } = event.data;
  try {
    self.postMessage({ id, result: runPlayerScript(output) } satisfies EvalReply);
  }
  catch (error) {
    const message = errorMessage(error);
    self.postMessage({ id, error: message } satisfies EvalReply);
  }
};
