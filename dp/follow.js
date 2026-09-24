(() => {
  const CONFIG = {
    maxFollows: 3000,     // hard cap per run
    minDelayMs: 5,   // random delay between follows
    maxDelayMs: 10,
    autoScroll: true,  // all participants already load on this page
  };

  const SELECTOR = 'button.follow-btn';
  const queue = [];
  const seen = new WeakSet();
  let followed = 0;
  let skipped = 0;
  let running = true;
  let busy = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randDelay = () =>
    CONFIG.minDelayMs + Math.random() * (CONFIG.maxDelayMs - CONFIG.minDelayMs);

  // Snapshot of the button's state, used to detect whether a click worked
  const stateOf = (btn) =>
    `${btn.className}|${btn.getAttribute('title') || ''}|${btn.getAttribute('data-original-title') || ''}|${btn.innerHTML}`;

  const isUnfollowed = (btn) => {
    const title = btn.getAttribute('title') || btn.getAttribute('data-original-title') || '';
    return btn.classList.contains('follow') &&
      !/following|unfollow/i.test(title) &&
      !btn.classList.contains('following') &&
      !btn.classList.contains('unfollow') &&
      !btn.disabled;
  };

  const nameFor = (btn) => {
    let el = btn;
    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      const link = el.querySelector && el.querySelector('a[href*="devpost.com/"]');
      if (link && link.innerText.trim()) return link.innerText.trim();
    }
    return '(unknown)';
  };

  // Full mouse sequence — some handlers ignore a bare .click()
  function realClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  function scan(root = document) {
    let added = 0;
    root.querySelectorAll(SELECTOR).forEach((btn) => {
      if (!seen.has(btn) && isUnfollowed(btn)) {
        seen.add(btn);
        queue.push(btn);
        added++;
      }
    });
    if (added) console.log(`➕ Queued ${added} (queue: ${queue.length})`);
    processQueue();
  }

  async function processQueue() {
    if (busy) return;
    busy = true;
    while (running && queue.length && followed < CONFIG.maxFollows) {
      const btn = queue.shift();
      if (!document.contains(btn) || !isUnfollowed(btn)) continue;

      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(100);

      const before = stateOf(btn);
      const who = nameFor(btn);
      realClick(btn);
      await sleep(100);

      // The button may be replaced after following, so check both
      const changed = !document.contains(btn) || stateOf(btn) !== before;
      if (changed) {
        followed++;
        console.log(`✅ Followed #${followed}: ${who}`);
      } else {
        skipped++;
        console.warn(`⚠️ No change for ${who}, skipping (${skipped} skipped so far)`);
      }
      await sleep(randDelay());
    }
    busy = false;
    if (followed >= CONFIG.maxFollows) return finish('Reached maxFollows cap.');
    if (running && !queue.length) {
      if (CONFIG.autoScroll) window.scrollTo(0, document.body.scrollHeight);
      else finish('No more unfollowed buttons on the page.');
    }
  }

  // DOM watcher: picks up follow buttons if more participants load
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) { scan(n.parentElement || n); return; }
      }
    }
  });

  function finish(msg) {
    if (!running) return;
    running = false;
    observer.disconnect();
    console.log(`🛑 ${msg} Total followed: ${followed}`);
  }

  window.stopAutoFollow = () => finish('Stopped manually.');

  const all = document.querySelectorAll(SELECTOR);
  console.log(`👀 Found ${all.length} follow buttons, ${[...all].filter(isUnfollowed).length} not yet followed. Call stopAutoFollow() to stop.`);
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();