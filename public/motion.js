// Scroll artwork, as an enhancement only.
//
// CSS scroll-driven animations (animation-timeline) would do all of this
// without a script, but Firefox reports support for them and then does not
// drive them, so the whole page sat still there. This does the same job with
// an observer, which every browser agrees on.
//
// Nothing here is load-bearing. Every element it touches already renders in
// its finished state, so with the script blocked, failed or still loading the
// page is complete, just still.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const page = document.querySelector(".np-anim");
  if (!page) return;
  page.classList.add("np-js");

  // Each element reveals once, as it comes into view. Stacked items (the four
  // lines of the statement, the six cards) cross the line a moment apart on
  // their own, which is the stagger.
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        reveal.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
  );
  for (const el of page.querySelectorAll(".sv, .light, .zoom, .path-link")) reveal.observe(el);

  // The background glows drift with scroll position. Their transforms are set
  // on the two elements directly: an inherited custom property on the wrapper
  // would restyle the whole page on every frame of every scroll.
  const g1 = page.querySelector(".g1");
  const g2 = page.querySelector(".g2");
  let queued = false;
  const setProgress = () => {
    queued = false;
    if (!g1 || !g2) return;
    const travel = document.documentElement.scrollHeight - window.innerHeight;
    const p = travel > 0 ? window.scrollY / travel : 0;
    g1.style.transform = `translate3d(${26 * p}vw, ${26 * p}vh, 0) scale(${1 + 0.3 * p})`;
    g2.style.transform = `translate3d(${-22 * p}vw, ${-24 * p}vh, 0) scale(${1.2 - 0.3 * p})`;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(setProgress);
    },
    { passive: true },
  );
  setProgress();
})();
