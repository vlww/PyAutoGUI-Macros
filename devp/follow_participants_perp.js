(() => {
  const CONFIG = {
    followDelayMs: 10,       // gap between follows
    verifyWaitMs: 20,        // wait before checking a follow registered
    maxFollows: 100000,      // safety cap for the whole session
    maxFailuresInARow: 3,    // end the current pass if follows keep failing
    repeatEveryMs: 3000,     // wait between passes
  };

  // If an older copy is still running, stop it first
  if (typeof window.stopAutoFollow === 'function') window.stopAutoFollow();

  const FOLLOW_SELECTOR = 'button.follow-btn';
  let stopped = false, followed = 0, pass = 0;
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
  const status = (msg) => { label.textContent = msg; };

  window.stopAutoFollow = () => {
    if (stopped) return;
    stopped = true;
    status(`🛑 Stopped — followed ${followed} in total over ${pass} pass(es).`);
    console.log(`🛑 Stopped — followed ${followed} in total.`);
    stopBtn.textContent = 'Close';
    stopBtn.onclick = () => bar.remove();
  };
  stopBtn.onclick = () => window.stopAutoFollow();

  // ---------- Helpers ----------
  const isFollowBtn = (el) =>
    el && el.isConnected && !el.disabled &&
    el.matches(FOLLOW_SELECTOR) &&
    el.classList.contains('follow') &&
    !el.classList.contains('following') &&
    !el.classList.contains('unfollow') &&
    (el.getAttribute('title') || el.getAttribute('data-original-title') || 'Follow') === 'Follow' &&
    !!el.querySelector('.ss-plus');

  // Learn once how many levels up from a "+" button its card is
  let cardDepth = null;
  function learnCardDepth() {
    const btns = document.querySelectorAll(FOLLOW_SELECTOR);
    if (btns.length < 2) return;
    let node = btns[0], depth = 0;
    while (node.parentElement && node.parentElement !== document.body &&
           node.parentElement.querySelectorAll(FOLLOW_SELECTOR).length === 1) {
      node = node.parentElement; depth++;
    }
    let n2 = btns[1];
    for (let i = 0; i < depth && n2; i++) n2 = n2.parentElement;
    if (n2 && n2 !== node && n2.querySelectorAll(FOLLOW_SELECTOR).length === 1) cardDepth = depth;
  }
  const cardFor = (btn) => {
    if (cardDepth === null) return null;
    let n = btn;
    for (let i = 0; i < cardDepth && n; i++) n = n.parentElement;
    return n;
  };
  const removeCard = (btn) => {
    const card = cardFor(btn);
    if (card && card.isConnected) card.remove();
  };
  const nameFor = (btn) => {
    const card = cardFor(btn) || btn.parentElement;
    const a = card && card.querySelector('a[href*="devpost.com/"]:not([href*="participants"])');
    return a ? a.href : '(unknown)';
  };

  function realClick(el) {
    const o = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  }

  // One scan: queue unfollowed buttons, remove cards of people already followed
  function collect() {
    const queue = [], toRemove = [];
    for (const b of document.querySelectorAll(FOLLOW_SELECTOR)) {
      (isFollowBtn(b) ? queue : toRemove).push(b);
    }
    toRemove.forEach(removeCard);
    return queue;
  }

  // ---------- One pass (same as pasting the script once) ----------
  async function runPass() {
    if (cardDepth === null) learnCardDepth();
    const queue = collect();
    let remaining = queue.length, failures = 0, followedThisPass = 0;
    status(`🔁 Pass ${pass}: ${remaining} not yet followed`);

    for (const btn of queue) {
      if (stopped) return;
      if (followed >= CONFIG.maxFollows) { window.stopAutoFollow(); return; }
      remaining--;
      if (!isFollowBtn(btn)) { removeCard(btn); continue; }

      const wrapper = btn.parentElement;
      btn.scrollIntoView({ block: 'center' });
      realClick(btn);
      await sleep(CONFIG.verifyWaitMs);

      const after = (wrapper && wrapper.isConnected && wrapper.querySelector(FOLLOW_SELECTOR)) || btn;
      if (!isFollowBtn(after)) {
        followed++; followedThisPass++; failures = 0;
        status(`✅ Pass ${pass}: followed ${followed} total — ${remaining} left this pass`);
        removeCard(after);
      } else {
        failures++;
        console.warn('⚠️ Follow did not register for', nameFor(btn));
        if (failures >= CONFIG.maxFailuresInARow) {
          console.log(`Pass ${pass}: ${failures} failures in a row — ending this pass early.`);
          break;
        }
      }
      await sleep(CONFIG.followDelayMs);
    }
    console.log(`Pass ${pass} done — followed ${followedThisPass} this pass, ${followed} total.`);
  }

  // ---------- Repeat forever: run, wait 3s, run again ----------
  (async () => {
    while (!stopped) {
      pass++;
      await runPass();
      if (stopped) break;
      for (let s = CONFIG.repeatEveryMs / 1000; s > 0 && !stopped; s--) {
        status(`⏳ Pass ${pass} finished (${followed} followed total) — next pass in ${s}s`);
        await sleep(1000);
      }
    }
  })();
})();