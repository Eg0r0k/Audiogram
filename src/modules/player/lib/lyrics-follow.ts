export interface FollowState {
  following: boolean;
  userScrolling: boolean;
  direction: "up" | "down";
}

export type FollowEvent
  = | { type: "userScrollStart" }
    | { type: "scroll"; offset: number; clientHeight: number }
    | { type: "scrollEnd" }
    | { type: "resume" }
    | { type: "linesChanged" };

export const NEAR_CENTER_RATIO = 0.3;

export const INITIAL_FOLLOW_STATE: FollowState = {
  following: true,
  userScrolling: false,
  direction: "down",
};

export const isNearCenter = (offset: number, clientHeight: number, ratio = NEAR_CENTER_RATIO): boolean =>
  Math.abs(offset) <= clientHeight * ratio;

// Follow is released only by scrolls the user started; programmatic smooth
// scrolls fire the same `scroll` events but must never change `following`.
export const reduceFollow = (state: FollowState, event: FollowEvent): FollowState => {
  switch (event.type) {
    case "userScrollStart":
      return { ...state, userScrolling: true };
    case "scroll": {
      const direction = event.offset < 0 ? "up" : "down";
      const following = state.userScrolling ? isNearCenter(event.offset, event.clientHeight) : state.following;
      return { ...state, direction, following };
    }
    case "scrollEnd":
      return { ...state, userScrolling: false };
    case "resume":
      return { ...state, following: true, userScrolling: false };
    case "linesChanged":
      return INITIAL_FOLLOW_STATE;
  }
};
