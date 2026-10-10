// Opening preserved from the local Gabriel V2 reference. Motion follows the author preference.
(() => {
const root = document.documentElement;
const signal = document.querySelector("[data-opening-signal]");
const preference = matchMedia("(prefers-reduced-motion: reduce)");
const compact = matchMedia("(max-width: 700px)");
const lineArrival = 3100;
const contentStart = lineArrival + 200;
const nameEnd = contentStart + 2600;
const slidesStart = nameEnd - 700;
const slidesEnd = slidesStart + 2e3;
const restStart = nameEnd + 200;
const total = restStart + 2e3;
const easing = "cubic-bezier(.4, 0, .2, 1)";
const forced = new URLSearchParams(location.search).get("motion") === "full";
const reduced = () => false;
const enabled = () => root.classList.contains("js") && !reduced() && typeof Element.prototype.animate === "function";
if (signal) {
  let buttonState2 = function() {
    if (!toggle) return;
    const paused = root.dataset.motionPaused === "true";
    toggle.hidden = !enabled();
    toggle.querySelector("[data-motion-label]").textContent = paused ? "Resume motion" : "Pause motion";
    toggle.querySelector("[data-motion-pause-icon]").hidden = paused;
    toggle.querySelector("[data-motion-play-icon]").hidden = !paused;
  }, cancelFinite2 = function() {
    generation++;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    clock = void 0;
  }, makePulse2 = function(delay = 0) {
    pulse?.cancel();
    pulse = void 0;
    if (!enabled()) return;
    pulse = ink.animate([{ opacity: 0.42 }, { opacity: 0.8 }, { opacity: 0.42 }], {
      duration: 4800,
      delay,
      easing: "ease-in-out",
      iterations: Infinity,
      fill: "both"
    });
    pulse.id = "opening-pulse";
  }, finish2 = function(reason = "completed") {
    root.dataset.intro = "complete";
    root.dataset.openingExit = reason;
    cancelFinite2();
    if (!pulse && enabled()) makePulse2();
    sync2();
  }, sync2 = function() {
    buttonState2();
    if (!enabled()) {
      pulse?.cancel();
      pulse = void 0;
      if (root.dataset.intro !== "complete") finish2("reduced-or-unavailable");
      return;
    }
    const paused = root.dataset.motionPaused === "true";
    if (paused && root.dataset.intro !== "complete") {
      finish2("paused");
      return;
    }
    const blocked = pageHidden || document.hidden || Boolean(document.querySelector("dialog[open]"));
    const time = typeof clock?.currentTime === "number" ? clock.currentTime : 0;
    const now = document.timeline.currentTime;
    animations.forEach((animation) => {
      if (blocked) {
        animation.pause();
        animation.currentTime = time;
      } else if (animation.playState === "paused") {
        animation.play();
        if (typeof now === "number") animation.startTime = now - time;
      }
    });
    if (pulse) {
      if (blocked || paused || !lineVisible) pulse.pause();
      else if (pulse.playState === "paused") pulse.play();
    }
  }, stage2 = function(element, id, from, to, start3, end) {
    return finite2(element, id, [
      { ...from, offset: 0 },
      { ...from, offset: start3 / total, easing },
      { ...to, offset: end / total },
      { ...to, offset: 1 }
    ]);
  }, finite2 = function(element, id, frames) {
    const animation = element.animate(frames, { duration: total, easing: "linear", fill: "both" });
    animation.id = id;
    animations.push(animation);
    return animation;
  }, start2 = function() {
    cancelFinite2();
    pulse?.cancel();
    pulse = void 0;
    if (!enabled() || root.dataset.motionPaused === "true") {
      finish2("reduced-or-paused");
      return;
    }
    root.dataset.intro = "playing";
    delete root.dataset.openingExit;
    const token = generation;
    try {
      clock = finite2(signal, "opening-clock", [{ opacity: 1 }, { opacity: 1 }]);
      finite2(dot, "opening-dot", [
        { opacity: 0, transform: "scale(.35)", offset: 0 },
        { opacity: 0, transform: "scale(.35)", offset: 420 / total, easing: "ease-out" },
        { opacity: 1, transform: "scale(1)", offset: 850 / total },
        { opacity: 1, transform: "scale(1)", offset: 2860 / total, easing: "ease-in-out" },
        { opacity: 0, transform: "scale(.65)", offset: 3360 / total },
        { opacity: 0, transform: "scale(.65)", offset: 1 }
      ]);
      stage2(line, "opening-line", { transform: "scaleX(0)" }, { transform: "scaleX(1)" }, 1e3, lineArrival);
      stage2(travel, "opening-travel", { transform: "translateX(0)" }, { transform: "translateX(100%)" }, 1e3, lineArrival);
      stage2(name, "opening-name", { opacity: 0, transform: `translateY(${compact.matches ? 14 : 28}px)` }, { opacity: 1, transform: "translateY(0)" }, contentStart, nameEnd);
      stage2(header, "opening-header", { opacity: 0 }, { opacity: 1 }, contentStart, contentStart + 1500);
      stage2(slides, "opening-slides", { opacity: 0 }, { opacity: 1 }, slidesStart, slidesEnd);
      remainder.forEach((element, index) => stage2(element, `opening-rest-${index}`, { opacity: 0 }, { opacity: 1 }, restStart, total));
      makePulse2(lineArrival);
      const now = document.timeline.currentTime;
      if (typeof now === "number") [...animations, ...pulse ? [pulse] : []].forEach((animation) => {
        animation.startTime = now;
      });
      clock.finished.then(() => {
        if (generation === token) finish2();
      }).catch(() => {
      });
      sync2();
    } catch {
      pulse?.cancel();
      pulse = void 0;
      root.dataset.intro = "complete";
      cancelFinite2();
      buttonState2();
    }
  }, release2 = function() {
    if (root.dataset.intro !== "complete") finish2("interaction");
  }, observe2 = function() {
    if (anchor) observer?.observe(anchor);
    observer?.observe(signal);
    const bounds = signal.getBoundingClientRect();
    lineVisible = bounds.bottom > 0 && bounds.top < innerHeight;
  };
  var buttonState = buttonState2, cancelFinite = cancelFinite2, makePulse = makePulse2, finish = finish2, sync = sync2, stage = stage2, finite = finite2, start = start2, release = release2, observe = observe2;
  const line = signal.querySelector("[data-opening-line]");
  const ink = signal.querySelector("[data-opening-ink]");
  const travel = signal.querySelector("[data-opening-travel]");
  const dot = signal.querySelector("[data-opening-dot]");
  const name = document.querySelector("[data-opening-name]");
  const slides = document.querySelector("[data-opening-slides]");
  const header = document.querySelector(".header-inner");
  const remainder = [...document.querySelectorAll("[data-opening-rest]")];
  const toggle = document.querySelector("[data-motion-toggle]");
  const anchor = document.querySelector("[data-opening-anchor]");
  let animations = [];
  let clock;
  let pulse;
  let generation = 0;
  let pageHidden = false;
  let lineVisible = true;
  const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === anchor && !entry.isIntersecting && scrollY > 8) release2();
      if (entry.target === signal) lineVisible = entry.isIntersecting;
    }
    sync2();
  }, { threshold: 0 }) : void 0;
  document.addEventListener("keydown", release2, true);
  document.addEventListener("focusin", release2, true);
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, summary")) release2();
  }, true);
  window.addEventListener("wheel", release2, { passive: true });
  window.addEventListener("touchstart", release2, { passive: true });
  window.addEventListener("hashchange", release2);
  window.addEventListener("portfolio:focus-destination", release2);
  document.addEventListener("visibilitychange", sync2);
  window.addEventListener("portfolio:dialog-change", sync2);
  window.addEventListener("portfolio:motion-change", sync2);
  preference.addEventListener("change", () => {
    if (!enabled()) finish2("reduced-or-unavailable");
    else {
      if (!pulse) makePulse2();
      sync2();
    }
  });
  document.addEventListener("error", (event) => {
    if (event.target?.tagName === "SCRIPT") finish2("script-fallback");
  }, true);
  window.addEventListener("pagehide", () => {
    pageHidden = true;
    finish2("pagehide");
    observer?.disconnect();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      pageHidden = false;
      observe2();
      sync2();
    }
  });
  toggle?.addEventListener("click", () => {
    root.dataset.motionPaused = String(root.dataset.motionPaused !== "true");
    window.dispatchEvent(new Event("portfolio:motion-change"));
  });
  document.querySelector("[data-replay]")?.addEventListener("click", () => {
    observer?.takeRecords();
    window.scrollTo({ top: 0, behavior: "instant" });
    window.dispatchEvent(new Event("portfolio:replay-reveals"));
    start2();
  });
  const prepared = root.dataset.intro === "pending";
  window.dispatchEvent(new Event("portfolio:intro-mounted"));
  observe2();
  if (prepared && !location.hash && !new URLSearchParams(location.search).has("projeto") && scrollY < 8) start2();
  else finish2("direct-reading");
}

})();
