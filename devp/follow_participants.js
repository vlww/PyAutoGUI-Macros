(() => {
  const CONFIG = {
    followDelayMs: 10,     // gap between follows
    verifyWaitMs: 20,      // wait before checking a follow registered
    maxFollows: 100000,        // safety cap for the run
    maxFailuresInARow: 3,    // stop if follows keep failing (likely rate-limited)
  };

  const FOLLOW_SELECTOR = 'button.follow-btn';
  let running = true, busy = false, followed = 0, failures = 0;
  const attempted = new WeakSet();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Status bar ----------
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40px;z-index:2147483647;background:#1F78D1;color:#fff;font:14px sans-serif;display:flex;align-items:center;justify-content:space-between;padding:0 12px;box-sizing:border-box;';
  const label = document.createElement('span');
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop';
  stopBtn.style.cssText = 'background:#fff;color:#1F78D1;border:0;padding:4px 12px;border-radius:4px;cursor:pointer;';
  bar.append(label, stopBtn);
  document.body.append(bar);
  const status = (msg) => { label.textContent = msg; console.log(msg); };

  // ---------- Follow logic ----------
  // Unfollowed "+" button: <button class="follow-btn ... follow" title="Follow"><i class="ss-plus">
  const isFollowBtn = (el) =>
    el && el.isConnected && !el.disabled &&
    el.matches(FOLLOW_SELECTOR) &&
    el.classList.contains('follow') &&
    !el.classList.contains('following') &&
    !el.classList.contains('unfollow') &&
    (el.getAttribute('title') || el.getAttribute('data-original-title') || 'Follow') === 'Follow' &&
    !!el.querySelector('.ss-plus');

  const findButtons = () =>
    [...document.querySelectorAll(FOLLOW_SELECTOR)].filter((b) => isFollowBtn(b) && !attempted.has(b));

  const nameFor = (btn) => {
    let node = btn;
    for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
      const a = node.querySelector && node.querySelector('a[href*="devpost.com/"]:not([href*="participants"])');
      if (a && !a.contains(btn)) return a.href;
    }
    return '(unknown)';
  };

  function realClick(el) {
    const o = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  }

  async function followAll() {
    if (busy || !running) return;
    busy = true;
    let buttons = findButtons();
    while (running && buttons.length) {
      for (const btn of buttons) {
        if (!running) break;
        if (followed >= CONFIG.maxFollows) { finish('Reached maxFollows cap'); break; }
        attempted.add(btn);
        if (!isFollowBtn(btn)) continue;

        const wrapper = btn.parentElement;
        const who = nameFor(btn);
        btn.scrollIntoView({ block: 'center' });
        realClick(btn);
        await sleep(CONFIG.verifyWaitMs);

        const after = (wrapper && wrapper.isConnected && wrapper.querySelector(FOLLOW_SELECTOR)) || btn;
        if (!isFollowBtn(after)) {
          followed++; failures = 0;
          status(`✅ Followed ${followed} — ${findButtons().length} left (${who})`);
        } else {
          failures++;
          console.warn('⚠️ Follow did not register for', who, after.outerHTML);
          if (failures >= CONFIG.maxFailuresInARow) {
            finish(`${failures} follows in a row failed — probably rate-limited. Wait, then run it again`);
            break;
          }
        }
        await sleep(CONFIG.followDelayMs);
      }
      buttons = findButtons(); // pick up anything that appeared meanwhile
    }
    busy = false;
    if (running && !findButtons().length) finish('Everyone on the page is followed');
  }

  // DOM watcher: if any new "+" buttons appear while running, include them
  const observer = new MutationObserver(() => { if (running && !busy && findButtons().length) followAll(); });
  observer.observe(document.body, { childList: true, subtree: true });

  function finish(msg) {
    if (!running) return;
    running = false;
    observer.disconnect();
    status(`🛑 ${msg} — Followed ${followed} in total.`);
    stopBtn.textContent = 'Close';
    stopBtn.onclick = () => bar.remove();
  }
  window.stopAutoFollow = () => finish('Stopped manually');
  stopBtn.onclick = () => window.stopAutoFollow();

  const total = document.querySelectorAll(FOLLOW_SELECTOR).length;
  status(`👀 ${total} participants, ${findButtons().length} not yet followed — starting…`);
  followAll();
})();