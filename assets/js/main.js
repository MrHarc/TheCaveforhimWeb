/* The Cave — behaviour layer. No libraries. Everything degrades: the site is fully
   readable and bookable with JavaScript disabled. */
(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- shared data (hours + status strings), injected by build.py ---------- */
  var dataEl = document.getElementById("cave-data");
  var DATA = dataEl ? JSON.parse(dataEl.textContent) : null;

  /* ---------- header scroll state ---------- */
  var hdr = document.querySelector(".hdr");
  function onScrollHdr() {
    // while the menu scroll-lock pins the body, scrollY reads 0 — hold state
    if (document.body.classList.contains("menu-locked")) return;
    if (hdr) hdr.classList.toggle("scrolled", window.scrollY > 80);
  }
  onScrollHdr();
  window.addEventListener("scroll", onScrollHdr, { passive: true });

  /* ---------- mobile menu (dialog behaviour) ---------- */
  var burger = document.querySelector(".burger");
  var mmenu = document.getElementById("mmenu");
  var lastFocus = null;

  /* iOS-safe scroll lock: overflow:hidden alone lets Safari keep scrolling and
     drop the position. Pin the body at the current offset, restore exactly. */
  var lockY = 0;
  function lockScroll() {
    lockY = window.scrollY;
    document.body.classList.add("menu-locked");
    document.body.style.position = "fixed";
    document.body.style.top = -lockY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }
  function unlockScroll() {
    document.body.classList.remove("menu-locked");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    var prev = docEl.style.scrollBehavior; // beat html.js smooth scrolling
    docEl.style.scrollBehavior = "auto";
    window.scrollTo(0, lockY);
    docEl.style.scrollBehavior = prev;
  }
  /* the page behind the dialog is inert where supported (focus + AT);
     the Tab trap below stays as the fallback */
  function setBgInert(on) {
    ["main", ".ftr", ".stickybar"].forEach(function (sel) {
      var el = sel === "main" ? document.getElementById("main") : document.querySelector(sel);
      if (el && "inert" in el) el.inert = on;
    });
  }
  function menuOpen() {
    lastFocus = document.activeElement;
    mmenu.classList.add("open");
    lockScroll();
    setBgInert(true);
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", burger.getAttribute("data-close-label"));
    var first = mmenu.querySelector("a, button");
    if (first) first.focus();
  }
  function menuClose() {
    mmenu.classList.remove("open");
    setBgInert(false);
    // setBgInert cleared the bar's inert bit — re-assert its synced state
    if (typeof setBar === "function") setBar(!!(bar && bar.classList.contains("on")));
    unlockScroll();
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", burger.getAttribute("data-open-label"));
    (lastFocus && lastFocus !== document.body ? lastFocus : burger).focus();
  }
  if (burger && mmenu) {
    burger.addEventListener("click", function () {
      mmenu.classList.contains("open") ? menuClose() : menuOpen();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mmenu.classList.contains("open")) menuClose();
    });
    mmenu.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var items = mmenu.querySelectorAll("a[href], button:not([disabled])");
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); burger.focus(); }
    });
    mmenu.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", menuClose); });
  }

  /* ---------- reveals ---------- */
  var revealables = document.querySelectorAll("[data-reveal], .mask, .break");
  if ("IntersectionObserver" in window && revealables.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- service accordions (open-by-default without JS) ---------- */
  var groups = document.querySelectorAll(".svc-group");
  groups.forEach(function (g, i) {
    var head = g.querySelector(".svc-group__head");
    var panel = g.querySelector(".svc-group__panel");
    if (!head || !panel) return;
    if (g.closest(".svc-layout")) { // homepage: first open, rest closed
      if (i > 0) g.classList.remove("open");
    }
    head.setAttribute("aria-expanded", g.classList.contains("open") ? "true" : "false");
    head.addEventListener("click", function () {
      var open = g.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------- sticky action bar ---------- */
  var bar = document.querySelector(".stickybar");
  var hero = document.querySelector(".hero, .page-head");
  /* one setter keeps the visual state, accessibility tree and tab order in
     sync: an off-screen bar is aria-hidden, unfocusable and (where supported)
     inert, so it can never be announced or tabbed to while invisible. */
  function setBar(on) {
    if (!bar) return;
    bar.classList.toggle("on", on);
    bar.setAttribute("aria-hidden", on ? "false" : "true");
    bar.querySelectorAll("a").forEach(function (a) { a.tabIndex = on ? 0 : -1; });
    if ("inert" in bar) bar.inert = !on;
  }
  /* while the iOS keyboard is up for a field, the bar stays out of the way */
  var typingInField = false;
  document.addEventListener("focusin", function (e) {
    if (e.target.matches && e.target.matches("input, textarea")) {
      typingInField = true;
      setBar(false);
    }
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.matches && e.target.matches("input, textarea")) typingInField = false;
  });
  if (bar && hero) {
    var lastY = window.scrollY, pastHero = false;
    var heroIO = new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting;
      if (!typingInField) setBar(pastHero);
    }, { threshold: 0.05 });
    heroIO.observe(hero);
    window.addEventListener("scroll", function () {
      if (document.body.classList.contains("menu-locked")) return;
      var y = window.scrollY;
      if (pastHero && !typingInField) {
        if (y > lastY + 4) setBar(false);
        else if (y < lastY - 4) setBar(true);
      }
      lastY = y;
    }, { passive: true });
  }

  /* ---------- open / closed status (Europe/Madrid) ---------- */
  function madridNow() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
    var dayIdx = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[get("weekday")];
    return { day: dayIdx, mins: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10) };
  }
  function toMins(hhmm) { var p = hhmm.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  if (DATA && DATA.hours) {
    var now = madridNow();
    var todayRow = DATA.hours[now.day];
    var statusText, isOpen = false;
    if (todayRow.open && now.mins >= toMins(todayRow.open) && now.mins < toMins(todayRow.close)) {
      isOpen = true;
      statusText = DATA.str.open_until.replace("{t}", todayRow.close);
    } else {
      var nextIdx = null, probe;
      for (var k = 0; k < 7; k += 1) {
        probe = (now.day + k) % 7;
        var row = DATA.hours[probe];
        if (!row.open) continue;
        if (k === 0 && now.mins >= toMins(row.close)) continue;
        if (k === 0 && now.mins < toMins(row.open)) { nextIdx = probe; break; }
        if (k > 0) { nextIdx = probe; break; }
      }
      if (nextIdx === null) statusText = DATA.str.closed_today;
      else if (nextIdx === now.day) statusText = DATA.str.open_until ? DATA.str.closed_now.replace("{d}", DATA.str.today_word).replace("{t}", DATA.hours[nextIdx].open) : "";
      else statusText = DATA.str.closed_now.replace("{d}", DATA.str.days_long[nextIdx]).replace("{t}", DATA.hours[nextIdx].open);
    }
    document.querySelectorAll("[data-status]").forEach(function (el) {
      var dot = el.querySelector(".dot");
      var txt = el.querySelector(".status-txt");
      if (dot) dot.classList.toggle("open", isOpen);
      if (txt) txt.textContent = statusText;
      el.hidden = false;
    });
    document.querySelectorAll(".hours tr[data-day]").forEach(function (tr) {
      tr.classList.toggle("today", parseInt(tr.getAttribute("data-day"), 10) === now.day);
    });
  }

  /* ---------- horizontal strip: drag to scroll + cursor label ---------- */
  var strip = document.querySelector(".strip");
  if (strip && window.matchMedia("(pointer: fine)").matches) {
    var isDown = false, startX = 0, startL = 0, moved = false;
    strip.addEventListener("pointerdown", function (e) {
      isDown = true; moved = false; startX = e.clientX; startL = strip.scrollLeft;
      strip.classList.add("dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (!isDown) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      strip.scrollLeft = startL - dx;
    });
    window.addEventListener("pointerup", function () { isDown = false; strip.classList.remove("dragging"); });
    strip.addEventListener("click", function (e) { if (moved) { e.preventDefault(); } }, true);

  }

  /* Cursor micro-label ("View" over gallery tiles, "Drag" over the social strip).
     One document-level handler owns show/hide, so the label can never strand:
     zone pointerleave events are lost when a tile click opens a new tab, so we
     also clear on click, tab switch and window blur. */
  if (window.matchMedia("(pointer: fine)").matches &&
      document.querySelector(".strip, .work__grid, .gal-grid")) {
    var lbl = document.createElement("span");
    lbl.className = "cursor-label";
    lbl.setAttribute("aria-hidden", "true");
    document.body.appendChild(lbl);
    var hideLbl = function () { lbl.classList.remove("on"); };
    document.addEventListener("pointermove", function (e) {
      var tile = e.target.closest && e.target.closest(".work__grid .tile, .gal-grid .tile");
      var stripZone = !tile && e.target.closest && e.target.closest(".strip");
      if (tile || stripZone) {
        lbl.textContent = tile ? "View" : "Drag";
        lbl.style.left = e.clientX + "px";
        lbl.style.top = e.clientY + "px";
        lbl.classList.add("on");
      } else {
        hideLbl();
      }
    }, { passive: true });
    document.addEventListener("click", hideLbl, true);
    document.addEventListener("visibilitychange", hideLbl);
    window.addEventListener("blur", hideLbl);
    document.addEventListener("scroll", hideLbl, { passive: true });
  }

  /* ---------- careers: compose a mailto, store nothing ---------- */
  var form = document.getElementById("careers-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("form-status");
      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();
      var msg = form.elements.message.value.trim();
      var nameEl = form.elements.name, msgEl = form.elements.message;
      if (!name) nameEl.setAttribute("aria-invalid", "true"); else nameEl.removeAttribute("aria-invalid");
      if (!msg) msgEl.setAttribute("aria-invalid", "true"); else msgEl.removeAttribute("aria-invalid");
      if (!name || !msg) {
        status.textContent = form.getAttribute("data-err");
        status.classList.remove("ok");
        // move focus to the first invalid field; scroll-margin keeps it clear
        // of the fixed header and the iOS keyboard. Nothing typed is cleared.
        (!name ? nameEl : msgEl).focus();
        return;
      }
      var body = name + "\n" + (phone ? phone + "\n" : "") + "\n" + msg;
      var href = "mailto:" + form.getAttribute("data-email") +
        "?subject=" + encodeURIComponent(form.getAttribute("data-subject")) +
        "&body=" + encodeURIComponent(body);
      status.textContent = form.getAttribute("data-ok");
      status.classList.add("ok");
      window.location.href = href;
    });
    form.addEventListener("input", function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute("aria-invalid") && e.target.value.trim())
        e.target.removeAttribute("aria-invalid");
    });
  }

  /* ---------- scroll-scrub hero film (saveData- and motion-aware) ----------
     The visitor's scroll drives video.currentTime through the 15s ink-sketch
     flight (aerial -> storefront -> signage). Sticky stage, natural scroll,
     no wheel hijack. Everything below degrades to the static hero.
     Two cuts of the same film: the 16:9 desktop original (>=1024px, fine
     pointer) and a 9:16 portrait recomposition for phones (<=899px portrait,
     coarse pointer, longer runway to absorb touch-flick momentum). The phone
     cut starts immediately behind its load gate; desktop waits for page load.
     Slow/data-saving connections and landscape phones keep the photograph. */
  var scrubHero = document.querySelector("[data-scrub-src]");
  var conn = navigator.connection || {};
  var connOk = !conn.saveData && !/(^| )(slow-2g|2g|3g)( |$)/.test(conn.effectiveType || "");
  var scrubEligible = !!scrubHero &&
    window.matchMedia("(min-width: 1024px)").matches &&
    window.matchMedia("(pointer: fine)").matches &&
    !reduceMotion && !(navigator.connection && navigator.connection.saveData);
  var scrubMobileEligible = !!scrubHero && !scrubEligible &&
    !!scrubHero.getAttribute("data-scrub-src-mobile") &&
    window.matchMedia("(max-width: 899px) and (orientation: portrait)").matches &&
    window.matchMedia("(pointer: coarse)").matches &&
    !reduceMotion && connOk;

  var scrubSrc = scrubEligible ? scrubHero.getAttribute("data-scrub-src")
    : scrubMobileEligible ? scrubHero.getAttribute("data-scrub-src-mobile") : null;
  var scrubRunway = scrubEligible ? (scrubHero.getAttribute("data-scrub-runway") || 200)
    : scrubMobileEligible ? (scrubHero.getAttribute("data-scrub-runway-mobile") || 300) : 0;

  function signalHeroLoader(name, detail) {
    document.dispatchEvent(new CustomEvent("cave:hero-" + name, { detail: detail || {} }));
  }

  /* The visitor's scroll is random access, so a partially-buffered film is a
     stall waiting to happen: any seek into a byte range that has not arrived
     restarts the decoder and strands a stale frame. Both cuts are therefore
     fully downloaded before they are shown. Phones do it behind the intro veil
     and report byte progress to it; desktop keeps its post-load silent fetch. */
  var scrubAbort = null;
  var scrubAbandoned = false;
  var scrubResolved = false;

  /* The budget in the inline boot script gives up on the film and releases the
     veil. Stop paying for bytes we have decided not to use — but only while the
     film is still in flight: a budget that expires in the same tick the film
     lands must not throw away a film we already hold. */
  document.addEventListener("cave:hero-fallback", function () {
    if (scrubResolved) return;
    scrubAbandoned = true;
    if (scrubAbort) { try { scrubAbort.abort(); } catch (e) {} }
  }, { once: true });

  function resolveScrubSource(src, onProgress) {
    var opts;
    if (onProgress && typeof AbortController === "function") {
      scrubAbort = new AbortController();
      opts = { signal: scrubAbort.signal };
    }
    return fetch(src, opts).then(function (r) {
      if (!r.ok) throw new Error("Hero film request failed");
      /* Streams give a real percentage. Without them (or without a
         Content-Length) the veil shows an indeterminate bar instead. */
      if (!onProgress || !r.body || typeof r.body.getReader !== "function") {
        if (onProgress) onProgress(-1);
        return r.blob();
      }
      var total = parseInt(r.headers.get("Content-Length") || "0", 10);
      var reader = r.body.getReader();
      var chunks = [], received = 0;
      onProgress(total ? 0 : -1);
      return (function pump() {
        return reader.read().then(function (res) {
          if (res.done) return new Blob(chunks, { type: "video/mp4" });
          chunks.push(res.value);
          received += res.value.length;
          if (total) onProgress(Math.min(1, received / total));
          return pump();
        });
      })();
    }).then(function (blob) {
      return URL.createObjectURL(blob);
    });
  }

  if (scrubSrc) {
    function loadScrubFilm() {
      resolveScrubSource(scrubSrc, scrubMobileEligible ? function (p) {
        signalHeroLoader("progress", { p: p });
      } : null)
        .then(function (videoSrc) {
          /* The budget expired while the film was in flight: the visitor is
             already looking at the photographic hero, so swapping a film in
             underneath them now would be the very jolt this gate exists to
             prevent. Drop it. */
          if (scrubAbandoned) { URL.revokeObjectURL(videoSrc); return; }
          scrubResolved = true;
          var film = scrubHero.querySelector(".hero__film");
          var v = document.createElement("video");
          v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = "auto";
          v.setAttribute("playsinline", "");
          v.setAttribute("webkit-playsinline", "");
          v.setAttribute("aria-hidden", "true");
          v.src = videoSrc;
          var dur = 14, cur = 0, target = 0, engaged = false;
          var mobileFrame = 1 / 24;
          var mobileGeometry = { top: 0, total: 1 };
          var mobileScrollRaf = 0, mobileLayoutRaf = 0, mobilePlaybackRaf = 0;
          var mobileCatchupTimer = 0;
          var mobileSeekBusy = false, mobileInView = true;
          var mobileSequentialReady = false, mobilePlayPending = false;
          var mobileHeroReadyEmitted = false;
          var mobileAct = "", mobileActionsH = -1;
          /* The film finishes at this fraction of the touch runway; the tail
             beyond it holds the last frame so "Cut with intention." survives
             one more swipe before the hero hands over to the page. */
          var mobileFilmSpan = 0.76;
          var mobileActFourAt = 0.96;
          var mobileScrollP = 0;

          function playableDuration() {
            var mediaDuration = v.duration || 14;
            /* Seeking to duration is an ended state rather than a paintable
               frame in WebKit. Some mobile decoders mark the final timestamp
               ended one frame early, so hold two source frames back on the
               24fps phone cut and always retain a clean decoded image. */
            return scrubMobileEligible ? Math.max(0, mediaDuration - (2 / 24)) : mediaDuration;
          }

          function setAct(p) {
            var next;
            if (scrubMobileEligible) {
              /* Acts 1-3 stay locked to the displayed frame. Act 4 (all hero
                 copy clears, the drawn signage becomes the headline) is held
                 back to the end of the runway instead of the end of the film,
                 so the closing line reads through the hold. */
              next = p < 0.34 ? "1" : p < 0.66 ? "2" : "3";
              if (mobileScrollP >= mobileActFourAt) next = "4";
            } else {
              next = p < 0.36 ? "1" : p < 0.72 ? "2" : p < 0.90 ? "3" : "4";
            }
            if (next === mobileAct) return;
            mobileAct = next;
            scrubHero.setAttribute("data-act", next);
          }

          function mobileIsActive() {
            return mobileInView && !document.hidden;
          }

          function stopMobilePlayback() {
            if (!v.paused) v.pause();
          }

          function releaseMobileSeek() {
            mobileSeekBusy = false;
            if (mobileIsActive()) scheduleMobilePlayback();
          }

          /* Random currentTime jumps make WebKit repeatedly restart its video
             decoder. Keep reverse/fallback seeks close to the displayed frame;
             forward motion is handled by normal sequential playback below. */
          function requestMobileSeek(snapToTarget, catchUp) {
            if (!engaged || v.readyState < 1 || !mobileIsActive() || mobileSeekBusy || mobilePlayPending) return;
            var delta = target - v.currentTime;
            if (Math.abs(delta) < mobileFrame * 0.28) return;

            var distance = Math.abs(delta);
            /* Video cannot play backwards, so rewinding is a chain of seeks —
               and each one waits for its decoded frame to reach the compositor.
               A flat three-frame step therefore needed ~24 sequential seeks to
               rewind three seconds, which is what read as lag and jitter under
               a reverse flick. Step proportionally instead: a long rewind takes
               a few big jumps, and the last one lands frame-exact. */
            var maxStep = delta < 0
              ? (distance > 3 ? mobileFrame * 24
                : distance > 1.5 ? mobileFrame * 12
                : distance > 0.6 ? mobileFrame * 6
                : mobileFrame * 3)
              : mobileFrame * 4;
            var next;
            if (catchUp && Math.abs(delta) > 1.1) {
              /* One decode jump after touch momentum settles keeps the film
                 connected to the finger without seeking on every scroll
                 event. Forward motion lands six frames early, then finishes
                 through the normal playback pipeline. */
              next = delta > 0 ? Math.max(v.currentTime, target - mobileFrame * 6) : target;
            } else {
              next = snapToTarget || distance <= maxStep
                ? target
                : v.currentTime + Math.max(-maxStep, Math.min(maxStep, delta));
            }
            /* Intermediate rewind hops land on the keyframe grid so the decoder
               opens a GOP instead of decoding forward into one; only the final
               resting frame needs to be exact. */
            var grid = (delta < 0 && !snapToTarget && distance > 0.6)
              ? mobileFrame * 8
              : mobileFrame;
            next = Math.min(dur, Math.max(0, Math.round(next / grid) * grid));
            if (Math.abs(next - v.currentTime) < mobileFrame * 0.45) return;

            mobileSeekBusy = true;
            var released = false;
            var fallback = 0;
            function frameReady() {
              if (released) return;
              released = true;
              if (fallback) clearTimeout(fallback);
              setAct(dur ? Math.min(1, v.currentTime / dur) : 0);
              releaseMobileSeek();
            }

            try { v.currentTime = next; }
            catch (e) { frameReady(); return; }

            /* Safari 15.4+ reports when the decoded frame actually reaches the
               compositor. Older engines fall back to seeked; the timer only
               protects against a backgrounded/aborted callback. */
            if (typeof v.requestVideoFrameCallback === "function") {
              v.requestVideoFrameCallback(frameReady);
            } else {
              v.addEventListener("seeked", function () {
                requestAnimationFrame(frameReady);
              }, { once: true });
            }
            fallback = setTimeout(frameReady, 300);
          }

          function scheduleMobilePlayback() {
            if (!mobilePlaybackRaf && mobileIsActive()) {
              mobilePlaybackRaf = requestAnimationFrame(updateMobilePlayback);
            }
          }

          function scheduleMobileCatchup() {
            if (mobileCatchupTimer) clearTimeout(mobileCatchupTimer);
            mobileCatchupTimer = setTimeout(function () {
              mobileCatchupTimer = 0;
              if (!engaged || !mobileIsActive()) return;
              if (Math.abs(target - v.currentTime) > 1.1) {
                stopMobilePlayback();
                requestMobileSeek(false, true);
              } else {
                scheduleMobilePlayback();
              }
            }, 110);
          }

          function startMobilePlayback(rate) {
            if (!mobileSequentialReady) {
              requestMobileSeek(false);
              return;
            }

            if (Math.abs(v.playbackRate - rate) > 0.08) {
              try { v.playbackRate = rate; } catch (e) {}
            }
            if (!v.paused || mobilePlayPending) return;

            mobilePlayPending = true;
            var play = v.play();
            if (!play || !play.then) {
              mobilePlayPending = false;
              scheduleMobilePlayback();
              return;
            }
            play.then(function () {
              mobilePlayPending = false;
              scheduleMobilePlayback();
            }).catch(function () {
              mobilePlayPending = false;
              mobileSequentialReady = false;
              scrubHero.setAttribute("data-scrub-sequential", "0");
              requestMobileSeek(false);
            });
          }

          /* Anime-style progress following for the phone film: native scroll
             only changes `target`; the media decoder advances sequentially and
             eases toward it with playbackRate. This avoids a random video seek
             for every touch-scroll event while retaining exact resting frames. */
          function updateMobilePlayback() {
            mobilePlaybackRaf = 0;
            if (!engaged || !mobileIsActive()) {
              stopMobilePlayback();
              return;
            }
            if (mobileSeekBusy) return;

            setAct(dur ? Math.min(1, v.currentTime / dur) : 0);

            var delta = target - v.currentTime;
            var distance = Math.abs(delta);

            if (distance <= mobileFrame * 0.62) {
              stopMobilePlayback();
              setAct(dur ? Math.min(1, target / dur) : 0);
              if (distance > mobileFrame * 0.28) requestMobileSeek(true);
              return;
            }

            /* Video cannot play backwards. Reverse scrolling uses small,
               decoded-frame-aware steps instead of one conspicuous jump. */
            if (delta < 0) {
              stopMobilePlayback();
              requestMobileSeek(false);
              return;
            }

            var rate = delta > 2.5 ? 5
              : delta > 1.25 ? 4
              : delta > 0.6 ? 3
              : delta > 0.25 ? 1.65
              : delta > 0.1 ? 1
              : 0.5;

            /* Decelerate near the final frame so WebKit never falls into the
               ended state, which can briefly expose a low-quality frame. */
            if (dur - v.currentTime < 0.45) rate = Math.min(rate, 1.25);
            startMobilePlayback(rate);
            scheduleMobilePlayback();
          }

          function updateMobileScroll() {
            mobileScrollRaf = 0;
            if (!mobileIsActive()) return;
            var p = Math.min(1, Math.max(0, (window.scrollY - mobileGeometry.top) / mobileGeometry.total));
            mobileScrollP = p;
            /* Scroll drives the film over mobileFilmSpan of the runway, not all
               of it: the remainder is the hold on the closing frame. */
            var filmP = Math.min(1, p / mobileFilmSpan);
            target = Math.min(dur, Math.round((filmP * dur) / mobileFrame) * mobileFrame);
            setAct(filmP);
            scheduleMobilePlayback();
            scheduleMobileCatchup();
          }

          function scheduleMobileScroll() {
            if (!mobileScrollRaf) mobileScrollRaf = requestAnimationFrame(updateMobileScroll);
          }

          function measureMobileGeometry() {
            var rect = scrubHero.getBoundingClientRect();
            mobileGeometry.top = rect.top + window.scrollY;
            mobileGeometry.total = Math.max(1, scrubHero.offsetHeight - window.innerHeight);
          }

          function onScroll() {
            if (scrubMobileEligible) {
              scheduleMobileScroll();
              return;
            }
            var total = scrubHero.offsetHeight - window.innerHeight;
            if (total <= 0) return;
            var p = Math.min(1, Math.max(0, -scrubHero.getBoundingClientRect().top / total));
            target = p * dur;
            /* Beats of the 15s film (same timeline in both cuts):
               descent 0-5.4s, storefront 5.4-10.8s, sign macro 10.8-13.5s,
               neon glow finale 13.5s-end (act 4: UI text clears — the
               drawn signage is the headline). */
            setAct(p);
          }

          function syncMobileActions() {
            if (!scrubMobileEligible) return;
            var actions = scrubHero.querySelector(".hero__persist");
            if (!actions) return;
            var nextHeight = Math.ceil(actions.getBoundingClientRect().height);
            if (nextHeight === mobileActionsH) return;
            mobileActionsH = nextHeight;
            scrubHero.style.setProperty("--hero-actions-h", nextHeight + "px");
          }

          function syncMobileLayout() {
            mobileLayoutRaf = 0;
            syncMobileActions();
            measureMobileGeometry();
            scheduleMobileScroll();
          }

          function scheduleMobileLayout() {
            if (!mobileLayoutRaf) mobileLayoutRaf = requestAnimationFrame(syncMobileLayout);
          }

          function engageScrub() {
            if (engaged) return;
            engaged = true;
            dur = playableDuration();
            /* On phones the final scrub geometry is useful immediately, but a
               frameless hardware-video layer may paint black in WebKit. Keep
               that layer hidden until loadeddata while the picture remains. */
            if (!scrubMobileEligible || v.readyState >= 2) film.hidden = false;
            scrubHero.style.setProperty("--scrub-runway", scrubRunway + "vh");
            scrubHero.classList.add("scrub-on");
            scrubHero.setAttribute("data-act", "1");
            mobileAct = "1";

            if (scrubMobileEligible) {
              scrubHero.setAttribute("data-scrub-scheduler", "momentum-playback");
              scrubHero.setAttribute("data-scrub-frame-ms", String(Math.round(mobileFrame * 1000)));
              scrubHero.setAttribute("data-scrub-max-rate", "5");
              scrubHero.setAttribute("data-scrub-settle-catchup", "1");
              scheduleMobileLayout();
              if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMobileLayout);
              if ("ResizeObserver" in window) {
                new ResizeObserver(scheduleMobileLayout).observe(scrubHero.querySelector(".hero__persist"));
              }
              if (window.visualViewport) {
                window.visualViewport.addEventListener("resize", scheduleMobileLayout, { passive: true });
              }
              if ("IntersectionObserver" in window) {
                new IntersectionObserver(function (entries) {
                  mobileInView = entries[0].isIntersecting;
                  scrubHero.setAttribute("data-scrub-active", mobileIsActive() ? "1" : "0");
                  if (mobileIsActive()) scheduleMobileLayout();
                  else stopMobilePlayback();
                }, { rootMargin: "100px 0px" }).observe(scrubHero);
              }
              document.addEventListener("visibilitychange", function () {
                scrubHero.setAttribute("data-scrub-active", mobileIsActive() ? "1" : "0");
                if (mobileIsActive()) scheduleMobileLayout();
                else stopMobilePlayback();
              });
            } else {
              (function tick() {
                var d = target - cur;
                if (Math.abs(d) > 0.008) {
                  cur += d * 0.22;
                  try { v.currentTime = cur; } catch (e) {}
                }
                requestAnimationFrame(tick);
              })();
            }
            window.addEventListener("scroll", onScroll, { passive: true });
            window.addEventListener("resize", function () {
              if (scrubMobileEligible) scheduleMobileLayout();
              onScroll();
            }, { passive: true });
            onScroll();
          }

          /* iOS Safari may expose metadata before its hardware video layer has
             decoded anything paintable. The poster owns the early layout;
             after loadeddata, briefly prime muted inline playback so scroll
             seeking paints on physical iPhones as well as WebKit emulation. */
          function signalMobileHeroReady() {
            if (!scrubMobileEligible || mobileHeroReadyEmitted) return;
            mobileHeroReadyEmitted = true;
            signalHeroLoader("ready", {});
          }

          /* Readiness is the film being scrubbable, never the poster being
             decoded: the poster is preloaded in <head> and lands in tens of
             milliseconds, so releasing the veil on it handed the visitor a
             hero whose film had barely started. The only signal that releases
             the veil is primeMobileVideo() below — whole file downloaded,
             engaged, first frame painted. */

          function primeMobileVideo() {
            if (!scrubMobileEligible || mobilePlayPending) return;
            mobilePlayPending = true;
            var play = v.play();
            if (play && play.then) {
              play.then(function () {
                mobilePlayPending = false;
                mobileSequentialReady = true;
                scrubHero.setAttribute("data-scrub-sequential", "1");
                var painted = false;
                var paintFallback = 0;
                function finishPrime() {
                  if (painted) return;
                  painted = true;
                  if (paintFallback) clearTimeout(paintFallback);
                  v.pause();
                  scheduleMobilePlayback();
                  signalMobileHeroReady();
                }
                if (typeof v.requestVideoFrameCallback === "function") {
                  v.requestVideoFrameCallback(finishPrime);
                  paintFallback = setTimeout(finishPrime, 400);
                } else {
                  requestAnimationFrame(function () { requestAnimationFrame(finishPrime); });
                }
              }).catch(function () {
                mobilePlayPending = false;
                scrubHero.setAttribute("data-scrub-sequential", "0");
                requestMobileSeek(false);
                requestAnimationFrame(signalMobileHeroReady);
              });
            } else {
              mobilePlayPending = false;
              mobileSequentialReady = true;
              scrubHero.setAttribute("data-scrub-sequential", "1");
              v.pause();
              scheduleMobilePlayback();
              requestAnimationFrame(signalMobileHeroReady);
            }
          }
          v.addEventListener("loadedmetadata", function () {
            dur = playableDuration();
            try { if (v.currentTime === 0) v.currentTime = 0.001; } catch (e) {}
          }, { once: true });
          v.addEventListener("loadeddata", function () {
            if (!engaged) engageScrub();
            film.hidden = false;
            requestAnimationFrame(function () { film.classList.add("is-ready"); });
            primeMobileVideo();
          }, { once: true });
          v.addEventListener("error", function () {
            if (scrubMobileEligible) signalHeroLoader("fallback", {});
          }, { once: true });
          if (scrubMobileEligible) {
            document.addEventListener("touchstart", primeMobileVideo, { once: true, passive: true });
          }
          film.appendChild(v);
          /* The phone layout switch (sticky stage + scroll runway) now happens
             on loadeddata, while the veil still covers the page — the visitor
             cannot scroll underneath it, so the taller page arrives unseen.
             If the film never loads the runway is never added at all. */
          v.load();
        })
        .catch(function () {
          if (scrubMobileEligible) signalHeroLoader("fallback", {});
        });
    }
    if (scrubMobileEligible) loadScrubFilm();
    else window.addEventListener("load", loadScrubFilm, { once: true });
  } else if (docEl.classList.contains("hero-loading")) {
    signalHeroLoader("fallback", {});
  }

  /* ---------- ambient video (desktop only, when the scrub film is not running) ---------- */
  var amb = document.querySelector("[data-ambient]");
  if (amb && !scrubEligible && window.matchMedia("(min-width: 1280px)").matches && !reduceMotion &&
      !(navigator.connection && navigator.connection.saveData)) {
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute("aria-hidden", "true");
    v.poster = amb.getAttribute("data-ambient-poster") || "";
    v.src = amb.getAttribute("data-ambient");
    amb.appendChild(v);
    v.play().catch(function () { v.remove(); });
  }

  /* ---------- the work: scroll-linked parallax --------------------------
     Each picture drifts inside its own frame as the section passes, columns at
     slightly different depths so the grid breathes instead of sitting still.
     Travel is capped to 3.5% of the tile's height, which the 1.08 base scale in
     CSS covers on both sides — the image edge can never be exposed. Runs only
     while the section is on screen, and not at all under reduced motion. */
  /* The framed tiles pop in on their own as they enter — the shared reveal
     observer above adds .in, and the CSS for .work__grid/.gal-grid tiles turns
     that into the frame's entrance. Nothing moves the photograph itself: the
     picture holds still inside its frame at all times. */

  /* ---------- year stamp ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();

/* ---------- intro veil / mobile hero load gate ---------- */
(function () {
  var intro = document.getElementById("intro");
  if (!intro) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var gateMobileHero = document.documentElement.classList.contains("hero-loading");
  var seen = false;
  try { seen = sessionStorage.getItem("cave-intro") === "1"; } catch (e) {}
  if (reduce || (!gateMobileHero && seen)) {
    document.documentElement.classList.remove("hero-loading");
    intro.remove();
    return;
  }
  if (!gateMobileHero) {
    try { sessionStorage.setItem("cave-intro", "1"); } catch (e) {}
  }

  var status = intro.querySelector("[data-intro-status]");
  var shownAt = performance.now();
  var lifted = false;

  /* Byte progress for the phone film. A determinate bar is the difference
     between a wait that reads as craft and one that reads as a broken page;
     a response without Content-Length or streams falls back to a paced
     indeterminate sweep (p === -1). */
  var progress = intro.querySelector("[data-intro-progress]");
  var progressBar = intro.querySelector("[data-intro-progress-bar]");
  if (gateMobileHero && progress) {
    document.addEventListener("cave:hero-progress", function (e) {
      var p = e.detail && typeof e.detail.p === "number" ? e.detail.p : -1;
      progress.classList.add("on");
      if (p < 0) {
        progress.classList.add("indeterminate");
        return;
      }
      progress.classList.remove("indeterminate");
      if (progressBar) progressBar.style.transform = "scaleX(" + p.toFixed(3) + ")";
    });
  }

  function lift() {
    if (lifted) return;
    lifted = true;
    if (window.__caveHeroGateTimer) clearTimeout(window.__caveHeroGateTimer);
    /* The hero's entrance ran while the veil covered it, so its masks may be
       mid-flight at the moment of the handoff. Compose the hero first: after a
       deliberate wait, the visitor should meet a finished frame, not catch the
       headline still arriving. */
    if (gateMobileHero) {
      document.querySelectorAll(".hero .mask").forEach(function (m) { m.classList.add("in"); });
    }
    intro.classList.add("lift");
    /* Replay the desktop headline reveal so it is not wasted under the short
       brand veil. The phone film owns its own scroll-linked copy states. */
    if (!gateMobileHero) {
      document.querySelectorAll(".hero h1 .mask.in").forEach(function (m) {
        m.classList.remove("in");
        void m.offsetWidth;
        setTimeout(function () { m.classList.add("in"); }, 240);
      });
    }
    setTimeout(function () {
      document.documentElement.classList.remove("hero-loading");
      intro.remove();
    }, gateMobileHero ? 260 : 420);
  }

  intro.classList.add("on");
  if (gateMobileHero) {
    intro.setAttribute("aria-hidden", "false");
    intro.setAttribute("aria-busy", "true");
  }
  requestAnimationFrame(function () { requestAnimationFrame(function () { intro.classList.add("reveal"); }); });

  if (gateMobileHero) {
    var heroReady = false;
    document.addEventListener("cave:hero-ready", function () {
      heroReady = true;
      intro.setAttribute("aria-busy", "false");
      var wait = Math.max(0, 460 - (performance.now() - shownAt));
      setTimeout(lift, wait + 120);
    }, { once: true });
    document.addEventListener("cave:hero-fallback", function () {
      /* The budget can expire in the same tick the film becomes ready. When it
         does, the visitor is getting the film — do not relabel the veil as a
         give-up on the way out. */
      if (heroReady) return;
      if (status) status.textContent = "Opening The Cave";
      intro.setAttribute("aria-busy", "false");
      var wait = Math.max(0, 460 - (performance.now() - shownAt));
      setTimeout(lift, wait + 40);
    }, { once: true });
    return;
  }

  setTimeout(lift, 820);
  ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (ev) {
    window.addEventListener(ev, lift, { once: true, passive: true });
  });
})();
