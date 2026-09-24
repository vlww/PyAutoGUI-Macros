(() => {
  const CONFIG = {
    maxFollows: 10000,     // hard cap per run
    minDelayMs: 20,    // random delay between follows
    maxDelayMs: 50,
    autoScroll: true,   // scroll to load more participants
    idleStopMs: 20000,  // stop if no clickable buttons appear for this long
  };

  const SELECTOR = 'button.follow-btn';
  const clickedIds = new Set();      // people already clicked (by profile URL)
  const clickedBtns = new WeakSet(); // fallback when a card has no link
  let followed = 0;
  let running = true;
  let lastActivity = Date.now();
  let lastDiag = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const randDelay = () =>
    CONFIG.minDelayMs + Math.random() * (CONFIG.maxDelayMs - CONFIG.minDelayMs);

  const isUnfollowed = (btn) => {
    const title = btn.getAttribute('title') || btn.getAttribute('data-original-title') || '';
    return btn.classList.contains('follow') &&
      !/following|unfollow/i.test(title) &&
      !btn.classList.contains('following') &&
      !btn.classList.contains('unfollow') &&
      !btn.disabled;
  };

  // The person's card = the largest ancestor that still contains only this one follow button
  const cardFor = (btn) => {
    let card = btn;
    while (card.parentElement && card.parentElement.querySelectorAll(SELECTOR).length === 1) {
      card = card.parentElement;
    }
    return card;
  };

  const idFor = (btn) => {
    const link = cardFor(btn).querySelector('a[href*="devpost.com/"]');
    return link ? link.href : null;
  };

  const labelFor = (btn) => {
    const link = cardFor(btn).querySelector('a[href*="devpost.com/"]');
    return (link && link.innerText.trim()) || (link && link.href) || '(no profile link)';
  };

  const alreadyClicked = (btn) => {
    const id = idFor(btn);
    return clickedBtns.has(btn) || (id && clickedIds.has(id));
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

  // Always read the live page, so re-rendered buttons are never stale
  const nextButton = () =>
    [...document.querySelectorAll(SELECTOR)].find((btn) => isUnfollowed(btn) && !alreadyClicked(btn));

  // Explains why nothing is clickable (printed at most every 5s while waiting)
  function diagnose() {
    if (Date.now() - lastDiag < 5000) return;
    lastDiag = Date.now();
    const all = [...document.querySelectorAll(SELECTOR)];
    const followedLooking = all.filter((b) => !isUnfollowed(b) && !b.disabled).length;
    const disabled = all.filter((b) => b.disabled).length;
    const clickedAlready = all.filter((b) => isUnfollowed(b) && alreadyClicked(b)).length;
    console.log(`🔎 Waiting — ${all.length} buttons on page: ${followedLooking} look already followed, ${disabled} disabled, ${clickedAlready} already clicked this run.`);
  }

  // DOM watcher: any page change counts as activity
  const observer = new MutationObserver(() => { lastActivity = Date.now(); });
  observer.observe(document.body, { childList: true, subtree: true });

  function finish(msg) {
    if (!running) return;
    running = false;
    observer.disconnect();
    console.log(`🛑 ${msg} Total followed: ${followed}`);
  }
  window.stopAutoFollow = () => finish('Stopped manually.');

  (async () => {
    console.log('👀 Running. Call stopAutoFollow() to stop.');
    while (running && followed < CONFIG.maxFollows) {
      const btn = nextButton();
      if (btn) {
        const id = idFor(btn);
        if (id) clickedIds.add(id);
        clickedBtns.add(btn);
        btn.scrollIntoView({ block: 'center' });
        realClick(btn);
        followed++;
        lastActivity = Date.now();
        console.log(`✅ Followed #${followed}: ${labelFor(btn)}`);
        await sleep(randDelay());
      } else {
        diagnose();
        if (Date.now() - lastActivity > CONFIG.idleStopMs) return finish('No more follow buttons.');
        if (CONFIG.autoScroll) window.scrollTo(0, document.body.scrollHeight);
        await sleep(500);
      }
    }
    if (followed >= CONFIG.maxFollows) finish('Reached maxFollows cap.');
  })();
})();