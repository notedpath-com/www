// Scroll behaviour, as an enhancement only.
//
// CSS scroll-driven animations (animation-timeline) would do all of this
// without a script, but Firefox reports support for them and then does not
// drive them, so the whole page sat still there. This does the same job with
// an observer, which every browser agrees on.
//
// Nothing here is load-bearing. Every element it touches already renders in
// its finished state, and the header keeps its backdrop, so with the script
// blocked, failed or still loading the page is complete, just still.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("np-js");

  const header = document.querySelector(".site-header");
  const page = document.querySelector(".np-anim");
  const glows = page ? [page.querySelector(".g1"), page.querySelector(".g2")] : [];

  // Each element reveals once, as it comes into view. Stacked items (the four
  // lines of the statement, the six cards) cross the line a moment apart on
  // their own, which is the stagger.
  if (page) {
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
  }

  // The header earns its backdrop only once there is something behind it, and
  // the background glows drift with scroll position. Their transforms are set
  // on the two elements directly: an inherited custom property on the wrapper
  // would restyle the whole page on every frame of every scroll.
  let queued = false;
  const onScroll = () => {
    queued = false;
    const y = window.scrollY;
    if (header) header.classList.toggle("stuck", y > 4);
    const [g1, g2] = glows;
    if (!g1 || !g2) return;
    const travel = document.documentElement.scrollHeight - window.innerHeight;
    const p = travel > 0 ? y / travel : 0;
    g1.style.transform = `translate3d(${26 * p}vw, ${26 * p}vh, 0) scale(${1 + 0.3 * p})`;
    g2.style.transform = `translate3d(${-22 * p}vw, ${-24 * p}vh, 0) scale(${1.2 - 0.3 * p})`;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(onScroll);
    },
    { passive: true },
  );
  onScroll();
})();
