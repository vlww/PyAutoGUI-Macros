(() => {
  const CONFIG = {
    followDelayMs: 40,     // gap between follows
    verifyWaitMs: 80,      // wait before checking a follow registered
    maxFollows: 100000,    // safety cap for the run
    maxFailuresInARow: 3,  // stop if follows keep failing (likely rate-limited)
    maxFollowerCount: 0,   // only follow people with this many followers or fewer
  };

  const FOLLOW_SELECTOR = 'button.follow-btn';
  let running = true, busy = false, followed = 0, failures = 0;
  let skippedPrivate = 0, skippedFollowers = 0, skippedUnknown = 0;
  const attempted = new WeakSet();
  const verdicts = new WeakMap(); // button -> true (eligible) / false (skip), checked once
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

  // ---------- Card lookup ----------
  // The card is the biggest ancestor of a "+" button that contains only that one button.
  // Learned once from the first button, then reused for every button.
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

  const nameFor = (btn) => {
    const card = cardFor(btn);
    const a = card && card.querySelector('a[href*="devpost.com/"]:not([href*="participants"])');
    return a ? a.href : '(unknown)';
  };

  // ---------- Eligibility: public user with 0 followers ----------
  function isEligible(btn) {
    if (verdicts.has(btn)) return verdicts.get(btn);
    let ok = false;
    const card = cardFor(btn);
    const text = card ? card.textContent.replace(/\s+/g, ' ') : '';

    if (!card) {
      skippedUnknown++;
    } else if (/\bprivate user\b/i.test(text)) {
      skippedPrivate++;                       // "Private user" → never follow
    } else {
      const m = text.match(/(\d[\d,]*)\s*followers?\b/i);  // "0 FOLLOWERS" / "1 FOLLOWER"
      if (!m) {
        skippedUnknown++;                     // couldn't read the count → skip to be safe
      } else if (parseInt(m[1].replace(/,/g, ''), 10) <= CONFIG.maxFollowerCount) {
        ok = true;
      } else {
        skippedFollowers++;
      }
    }
    verdicts.set(btn, ok);
    return ok;
  }

  const findButtons = () =>
    [...document.querySelectorAll(FOLLOW_SELECTOR)]
      .filter((b) => !attempted.has(b) && isFollowBtn(b) && isEligible(b));

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
      let remaining = buttons.length;
      for (const btn of buttons) {
        if (!running) break;
        if (followed >= CONFIG.maxFollows) { finish('Reached maxFollows cap'); break; }
        attempted.add(btn);
        remaining--;
        if (!isFollowBtn(btn)) continue;

        const wrapper = btn.parentElement;
        const who = nameFor(btn);
        btn.scrollIntoView({ block: 'center' });
        realClick(btn);
        await sleep(CONFIG.verifyWaitMs);

        const after = (wrapper && wrapper.isConnected && wrapper.querySelector(FOLLOW_SELECTOR)) || btn;
        if (!isFollowBtn(after)) {
          followed++; failures = 0;
          status(`✅ Followed ${followed} — ${remaining} left (${who})`);
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
    if (running && !findButtons().length) finish('Everyone eligible on the page is followed');
  }

  // DOM watcher: only reacts when new "+" buttons are added
  const observer = new MutationObserver((mutations) => {
    if (!running || busy) return;
    for (const m of mutations) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && (n.matches(FOLLOW_SELECTOR) || n.querySelector(FOLLOW_SELECTOR))) {
        followAll();
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function finish(msg) {
    if (!running) return;
    running = false;
    observer.disconnect();
    status(`🛑 ${msg} — Followed ${followed}. Skipped: ${skippedFollowers} with followers, ${skippedPrivate} private, ${skippedUnknown} unreadable.`);
    stopBtn.textContent = 'Close';
    stopBtn.onclick = () => bar.remove();
  }
  window.stopAutoFollow = () => finish('Stopped manually');
  stopBtn.onclick = () => window.stopAutoFollow();

  learnCardDepth();
  if (cardDepth === null) {
    status('❌ Could not detect the participant card layout, so follower counts can\'t be read. Nothing was followed.');
    stopBtn.textContent = 'Close';
    stopBtn.onclick = () => bar.remove();
    running = false;
    observer.disconnect();
    return;
  }

  const total = document.querySelectorAll(FOLLOW_SELECTOR).length;
  const eligible = findButtons().length;
  status(`👀 ${total} participants — ${eligible} public with 0 followers (skipping ${skippedFollowers} with followers, ${skippedPrivate} private) — starting…`);
  followAll();
})();