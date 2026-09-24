(() => {
  const IDLE_STOP_MS = 20000; // stop after this long with nothing new loading
  const SCROLL_EVERY_MS = 1500;

  const container = document.querySelector('#search-results') || document.body;
  const countPeople = () => container.querySelectorAll('.follow-actions, button.follow-btn').length;

  let lastActivity = Date.now();
  let lastCount = countPeople();

  // DOM watcher: any new content counts as progress and resets the idle timer
  const observer = new MutationObserver(() => { lastActivity = Date.now(); });
  observer.observe(container, { childList: true, subtree: true });

  const timer = setInterval(() => {
    window.scrollTo(0, document.body.scrollHeight);

    const count = countPeople();
    if (count !== lastCount) {
      console.log(`⬇️ Loaded ${count} people so far...`);
      lastCount = count;
      lastActivity = Date.now();
    }

    const idleFor = Date.now() - lastActivity;
    if (idleFor > IDLE_STOP_MS) stop(`✅ Done — nothing new for ${IDLE_STOP_MS / 1000}s. Total loaded: ${count}`);
  }, SCROLL_EVERY_MS);

  function stop(msg) {
    clearInterval(timer);
    observer.disconnect();
    console.log(msg || '🛑 Stopped manually.');
  }

  window.stopAutoScroll = () => stop();
  console.log(`👀 Auto-scrolling (starting with ${lastCount} people). Call stopAutoScroll() to stop.`);
})();