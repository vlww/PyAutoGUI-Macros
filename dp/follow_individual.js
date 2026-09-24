(() => {
  const CONFIG = {
    followDelayMs: 50,     // gap between follows
    verifyWaitMs: 50,      // wait before checking a follow registered
    afterPageClickMs: 1000,   // wait after the new page loads
    maxFollows: 10000,        // safety cap for the whole run
    maxFailuresInARow: 3,    // stop if follows keep failing (likely rate-limited)
    pageLoadTimeoutMs: 15000,
  };

  let running = true, followed = 0, failures = 0, pages = 0;
  const attempted = new WeakSet();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const textOf = (el) => (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // ---------- Overlay UI ----------
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40px;z-index:2147483647;background:#1F78D1;color:#fff;font:14px sans-serif;display:flex;align-items:center;justify-content:space-between;padding:0 12px;box-sizing:border-box;';
  const label = document.createElement('span');
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  stopBtn.style.cssText = 'background:#fff;color:#1F78D1;border:0;padding:4px 12px;border-radius:4px;cursor:pointer;';
  bar.append(label, stopBtn);

  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;top:40px;left:0;width:100vw;height:calc(100vh - 40px);border:0;z-index:2147483646;background:#fff;';

  const status = (msg) => { label.textContent = msg; console.log(msg); };

  function finish(msg) {
    if (!running) return;
    running = false;
    status(`🛑 ${msg} — Followed ${followed} across ${pages} page(s).`);
    stopBtn.textContent = 'Close';
    stopBtn.onclick = () => { bar.remove(); frame.remove(); };
  }
  window.stopAutoFollow = () => finish('Stopped manually');
  stopBtn.onclick = () => window.stopAutoFollow();

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

  // ---------- Follow logic ----------
  const isFollowBtn = (el) => el && el.isConnected && !el.disabled && textOf(el) === 'follow';
  const findButtons = (d) =>
    [...d.querySelectorAll('button, a, input[type="submit"]')].filter((b) => isFollowBtn(b) && !attempted.has(b));

  const nameFor = (btn) => {
    let node = btn;
    for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
      const a = node.querySelector && node.querySelector('a[href*="devpost.com/"]:not([href*="followers"])');
      if (a && !a.contains(btn)) return a.href;
    }
    return '(unknown)';
  };

  async function followAllOnPage(d) {
    let buttons = findButtons(d);
    while (running && buttons.length) {
      for (const btn of buttons) {
        if (!running) return;
        if (followed >= CONFIG.maxFollows) return finish('Reached maxFollows cap');
        attempted.add(btn);
        if (!isFollowBtn(btn)) continue;

        const wrapper = btn.parentElement;
        const who = nameFor(btn);
        btn.scrollIntoView({ block: 'center' });
        realClick(btn);
        await sleep(CONFIG.verifyWaitMs);

        const after = (wrapper && wrapper.isConnected &&
          wrapper.querySelector('button, a, input[type="submit"]')) || btn;
        if (!isFollowBtn(after)) {
          followed++; failures = 0;
          status(`✅ Page ${pages} — followed ${followed} total (${who})`);
        } else {
          failures++;
          console.warn('⚠️ Follow did not register for', who, after.outerHTML);
          if (failures >= CONFIG.maxFailuresInARow) {
            return finish(`${failures} follows in a row failed — probably rate-limited. Wait, then restart from this page`);
          }
        }
        await sleep(CONFIG.followDelayMs);
      }
      buttons = findButtons(d); // catch any that loaded late
    }
  }

  // ---------- Pagination ----------
  function findNext(d) {
    const links = [...d.querySelectorAll('a[href], button')].filter(
      (a) => !a.closest('.unavailable, .disabled, [aria-disabled="true"]') && !a.disabled
    );
    const rel = d.querySelector('a[rel="next"]');
    if (rel && links.includes(rel)) return rel;

    const byText = links.find((a) => ['next', 'next ›', 'next »', '›', '»', 'next page'].includes(textOf(a)) ||
      /^next\b/.test(textOf(a)));
    if (byText) return byText;

    const cur = d.querySelector('.pagination .current, [aria-current="page"], .pagination li.active');
    const n = cur && parseInt(textOf(cur), 10);
    if (n) return links.find((a) => textOf(a) === String(n + 1));

    const urlPage = parseInt(new URL(d.location.href).searchParams.get('page') || '1', 10);
    return links.find((a) => textOf(a) === String(urlPage + 1));
  }

  const signature = (d) => {
    try {
      return d.location.href + '|' +
        [...d.querySelectorAll('a[href*="devpost.com/"]')].slice(0, 60).map((a) => a.href).join(',');
    } catch { return Math.random().toString(); }
  };

  async function waitForChange(oldSig) {
    const end = Date.now() + CONFIG.pageLoadTimeoutMs;
    while (running && Date.now() < end) {
      const d = doc();
      if (d && d.body && signature(d) !== oldSig) return true;
      await sleep(250);
    }
    return false;
  }

  // ---------- Main loop ----------
  (async () => {
    document.body.append(bar, frame);
    status('Loading followers list…');
    const firstLoad = waitForLoad();
    frame.src = location.href;
    await firstLoad;

    if (!doc() || !doc().body || doc().location.href === 'about:blank') {
      return finish('Devpost blocked loading the page in a frame — this approach won\'t work here');
    }

    while (running) {
      const d = await waitReady();
      await sleep(CONFIG.afterPageClickMs);
      await waitForStable(d);
      pages++;
      const pageNum = new URL(d.location.href).searchParams.get('page') || '?';
      status(`📄 Page ${pageNum} — following…`);

      await followAllOnPage(d);
      if (!running) break;

      const next = findNext(d);
      if (!next) return finish('No next page — reached the end');

      const sig = signature(d);
      status(`➡️ Going to next page…`);
      realClick(next);
      const moved = await waitForChange(sig);
      if (!moved) return finish('Next page did not load');
    }
  })();
})();