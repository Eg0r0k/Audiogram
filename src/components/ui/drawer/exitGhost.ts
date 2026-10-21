//
// A drawer unmounted together with its owner (a menu item that opens a page
// tears down the page holding the menu) loses its close animation: Vue drops
// teleported content at once and skips leave transitions when the parent
// unmounts. Just before that, inert copies play the close out from where the
// originals were.
//
// Copies go to the end of the container: Vue removes the whole node range of
// the portal's fragment, so a copy placed next to its original goes with it.
//

const FALLBACK_REMOVE_MS = 1000;

const runningAnimation = (el: Element): Animation | undefined =>
  el.getAnimations?.().find(animation => animation.playState === "running");

const leaveGhost = (el: HTMLElement, closedAt: number | null): void => {
  const container = el.parentElement;
  if (!container) return;

  const canInspect = typeof el.getAnimations === "function";
  const closing = el.dataset.state === "closed";
  const closeAnimation = closing ? runningAnimation(el) : undefined;
  // Closed and done animating: already out of sight.
  if (closing && canInspect && !closeAnimation) return;

  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.dataset.state = "closed";
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.pointerEvents = "none";
  for (const node of [ghost, ...ghost.querySelectorAll("[id]")]) node.removeAttribute("id");
  container.append(ghost);

  const remove = () => ghost.remove();
  ghost.addEventListener("animationend", (event) => {
    if (event.target === ghost) remove();
  });
  window.setTimeout(remove, FALLBACK_REMOVE_MS);

  if (!canInspect) return;
  const animation = runningAnimation(ghost);
  // Reduced motion turns the close animation off; there is nothing to play.
  if (!animation) {
    remove();
    return;
  }
  // The slide runs on the compositor while the page swap holds the main
  // thread, so the original's currentTime lags what is on screen and its
  // startTime may not be resolved yet. Starting the copy at the same moment
  // keeps it where the original would be.
  const startTime = closeAnimation?.startTime ?? (closing ? closedAt : null);
  if (startTime != null) animation.startTime = startTime;
};

/**
 * Pass the elements bottom layer first; the copies keep that stacking.
 * `closedAt` is the frame time the close started, on the document timeline.
 */
export const leaveExitGhosts = (elements: unknown[], closedAt: number | null = null): void => {
  for (const el of elements) {
    if (el instanceof HTMLElement && el.isConnected) leaveGhost(el, closedAt);
  }
};
