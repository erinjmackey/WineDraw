/** Scroll an overflowing projector spotlight back and forth at a readable speed. */
export function startSpotlightScroll(viewport) {
  const speed = 45; // pixels per second
  const endPause = 1500;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let position = viewport.scrollLeft;
  let direction = 1;
  let lastTime = null;
  let pauseRemaining = 0;
  let hovered = false;
  let focused = false;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
  }

  function canScroll() {
    return !motion.matches && !hovered && !focused && viewport.scrollWidth >= viewport.clientWidth + 1;
  }

  function tick(time) {
    frame = 0;
    if (!canScroll()) {
      lastTime = null;
      return;
    }

    const max = viewport.scrollWidth - viewport.clientWidth;
    if (lastTime !== null) {
      // Avoid jumping past names after a tab has been in the background.
      const elapsed = Math.min(time - lastTime, 50);
      if (pauseRemaining > 0) {
        pauseRemaining -= elapsed;
      } else {
        position = Math.max(0, Math.min(max, position + direction * speed * elapsed / 1000));
        viewport.scrollLeft = position;
        if (position === 0 || position === max) {
          direction *= -1;
          pauseRemaining = endPause;
        }
      }
    }
    lastTime = time;
    frame = requestAnimationFrame(tick);
  }

  function update() {
    stop();
    position = viewport.scrollLeft;
    if (canScroll()) frame = requestAnimationFrame(tick);
  }

  function onEnter() { hovered = true; update(); }
  function onLeave() { hovered = false; update(); }
  function onFocus() { focused = true; update(); }
  function onBlur() { focused = false; update(); }

  viewport.addEventListener("pointerenter", onEnter);
  viewport.addEventListener("pointerleave", onLeave);
  viewport.addEventListener("focusin", onFocus);
  viewport.addEventListener("focusout", onBlur);
  motion.addEventListener("change", update);
  const observer = new ResizeObserver(update);
  observer.observe(viewport);
  update();

  return () => {
    stop();
    observer.disconnect();
    motion.removeEventListener("change", update);
    viewport.removeEventListener("pointerenter", onEnter);
    viewport.removeEventListener("pointerleave", onLeave);
    viewport.removeEventListener("focusin", onFocus);
    viewport.removeEventListener("focusout", onBlur);
  };
}
