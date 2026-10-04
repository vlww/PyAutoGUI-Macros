(() => {
  const CONFIG = {
    unfollowDelayMs: 50,     // gap between unfollows
    verifyWaitMs: 50,        // wait before checking an unfollow registered
    afterPageLoadMs: 500,    // wait after the page loads
    maxUnfollows: 100000,     // safety cap for the whole run
    maxFailuresInARow: 3,    // stop if unfollows keep failing (likely rate-limited)
    pageLoadTimeoutMs: 15000,
    loadRetries: 2,          // times to re-load a page that fails
  };

  let running = true, unfollowed = 0, failures = 0, pagesLoaded = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const textOf = (el) => (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // ---------- Overlay UI ----------
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40px;z-index:2147483647;background:#C0392B;color:#fff;font:14px sans-serif;display:flex;align-items:center;justify-content:space-between;padding:0 12px;box-sizing:border-box;';
  const label = document.createElement('span');
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  stopBtn.style.cssText = 'background:#fff;color:#C0392B;border:0;padding:4px 12px;border-radius:4px;cursor:pointer;';
  bar.append(label, stopBtn);

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:40px;left:0;width:100vw;height:calc(100vh - 40px);border:0;z-index:2147483646;background:#fff;';

  const status = (msg) => { label.textContent = msg; console.log(msg); };

  function finish(msg) {
    if (!running) return;
    running = false;
    status(`🛑 ${msg} — Unfollowed ${unfollowed} in total.`);
    stopBtn.textContent = 'Close';
    stopBtn.onclick = () => { bar.remove(); frame.remove(); };
  }
  window.stopAutoUnfollow = () => finish('Stopped manually');
  stopBtn.onclick = () => window.stopAutoUnfollow();

  // ---------- Frame helpers ----------
  const doc = () => { try { return frame.contentDocument; } catch { return null; } };
  const win = () => frame.contentWindow;

  const waitForLoad = () => new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), CONFIG.pageLoadTimeoutMs);
    frame.addEventListener('load', () => { clearTimeout(t); resolve(true); }, { once: true });
  });

  async function waitReady() {
    const end = Date.now() + CONFIG.pageLoadTimeoutMs;
    while (Date.now() < end) {
      const d = doc();
      if (d && d.readyState === 'complete' && d.body) return d;
      await sleep(200);
    }
    return doc();
  }

  // DOM watcher: resolves once the page stops changing (lazy content finished)
  const waitForStable = (d, quietMs = 800, maxMs = 5000) => new Promise((resolve) => {
    let quiet;
    const obs = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(done, quietMs); });
    const done = () => { obs.disconnect(); clearTimeout(cap); resolve(); };
    const cap = setTimeout(done, maxMs);
    obs.observe(d.body, { childList: true, subtree: true });
    quiet = setTimeout(done, quietMs);
  });

  function realClick(el) {
    const w = win();
    const o = { bubbles: true, cancelable: true, view: w };
    el.dispatchEvent(new w.PointerEvent('pointerdown', o));
    el.dispatchEvent(new w.MouseEvent('mousedown', o));
    el.dispatchEvent(new w.PointerEvent('pointerup', o));
    el.dispatchEvent(new w.MouseEvent('mouseup', o));
    el.dispatchEvent(new w.MouseEvent('click', o));
  }

  // ---------- Unfollow logic ----------
  // Matches buttons that say "Unfollow" (also handles buttons holding both
  // "Following" and a hover label "Unfollow"). Short text only, so big containers never match.
  const isUnfollowBtn = (el) => {
    if (!el || !el.isConnected || el.disabled) return false;
    const t = textOf(el);
    return t.length <= 25 && /\bunfollow\b/.test(t);
  };
  const findButtons = (d, attempted) =>
    [...d.querySelectorAll('button, a, input[type="submit"]')].filter((b) => isUnfollowBtn(b) && !attempted.has(b));

  const nameFor = (btn) => {
    let node = btn;
    for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
      const a = node.querySelector && node.querySelector('a[href*="devpost.com/"]:not([href*="following"]):not([href*="followers"])');
      if (a && !a.contains(btn)) return a.href;
    }
    return '(unknown)';
  };

  // Returns how many were unfollowed on this load of the page
  async function unfollowAllOnPage(d, pageNum) {
    const attempted = new WeakSet();
    let doneHere = 0;
    let buttons = findButtons(d, attempted);
    while (running && buttons.length) {
      for (const btn of buttons) {
        if (!running) return doneHere;
        if (unfollowed >= CONFIG.maxUnfollows) { finish('Reached maxUnfollows cap'); return doneHere; }
        attempted.add(btn);
        if (!isUnfollowBtn(btn)) continue;

        const wrapper = btn.parentElement;
        const who = nameFor(btn);
        btn.scrollIntoView({ block: 'center' });
        realClick(btn);
        await sleep(CONFIG.verifyWaitMs);

        const after = (wrapper && wrapper.isConnected &&
          wrapper.querySelector('button, a, input[type="submit"]')) || btn;
        if (!isUnfollowBtn(after)) {
          unfollowed++; doneHere++; failures = 0;
          status(`✅ Page ${pageNum} — unfollowed ${unfollowed} total (${who})`);
        } else {
          failures++;
          console.warn('⚠️ Unfollow did not register for', who, after.outerHTML);
          if (failures >= CONFIG.maxFailuresInARow) {
            finish(`${failures} unfollows in a row failed — probably rate-limited. Wait, then restart from page ${pageNum}`);
            return doneHere;
          }
        }
        await sleep(CONFIG.unfollowDelayMs);
      }
      buttons = findButtons(d, attempted); // catch any that loaded late
    }
    return doneHere;
  }

  // ---------- Pagination (by URL: ?page=N) ----------
  const pageUrl = (n) => {
    const u = new URL(location.href);
    u.searchParams.set('page', n);
    return u.toString();
  };

  // Count follow-related buttons to detect an empty page (past the end of the list)
  const personButtons = (d) =>
    [...d.querySelectorAll('button, a, input[type="submit"]')]
      .filter((b) => { const t = textOf(b); return t.length <= 25 && /\b(follow|following|unfollow)\b/.test(t); }).length;

  // Load a page into the frame (fresh load = refresh); retry if it doesn't load
  async function loadPage(n) {
    for (let attempt = 1; attempt <= CONFIG.loadRetries + 1 && running; attempt++) {
      const loaded = waitForLoad();
      frame.src = pageUrl(n) + `&_r=${Date.now()}`; // always a fresh copy
      const ok = await loaded;
      const d = doc();
      if (ok && d && d.body && d.location.href !== 'about:blank') return d;
      status(`⚠️ Page ${n} didn't load (attempt ${attempt}) — retrying…`);
      await sleep(2000);
    }
    return null;
  }

  // ---------- Main loop ----------
  (async () => {
    document.body.append(bar, frame);
    let page = parseInt(new URL(location.href).searchParams.get('page') || '1', 10);

    while (running) {
      status(`📄 Loading page ${page}…`);
      const loaded = await loadPage(page);
      if (!loaded) return finish(`Page ${page} wouldn't load after retries (or Devpost blocks framing)`);

      const d = await waitReady();
      await sleep(CONFIG.afterPageLoadMs);
      await waitForStable(d);
      pagesLoaded++;

      if (personButtons(d) === 0) return finish(`Page ${page} is empty — reached the end`);

      if (findButtons(d, new WeakSet()).length === 0) {
        page++;               // nothing to unfollow here → next page
        continue;
      }

      status(`📄 Page ${page} — unfollowing…`);
      const doneHere = await unfollowAllOnPage(d, page);
      if (!running) break;

      // Unfollowed people disappear from your own Following list on reload and
      // later people shift onto this page — so reload the same page to check.
      // If nothing could be unfollowed on this load, move on to avoid looping.
      if (doneHere === 0) page++;
    }
  })();
})();