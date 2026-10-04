(() => {
  const CONFIG = {
    followDelayMs: 40,     // gap between follows
    verifyWaitMs: 80,      // wait before checking a follow registered
    maxFollows: 100000,    // safety cap for the run
    maxFailuresInARow: 3,  // stop if follows keep failing (likely rate-limited)
    maxFollowerCount: 0,   // only follow people with this many followers or fewer
    saveEvery: 10,         // write the list file after this many new follows
  };

  const FOLLOW_SELECTOR = 'button.follow-btn';
  const PROFILE_RE = /^https?:\/\/devpost\.com\/([^\/?#]+)\/?$/i;
  const BACKUP_KEY = 'devpostFollowedListBackup';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let running = false, busy = false, followed = 0, failures = 0, unsaved = 0;
  let skippedPrivate = 0, skippedFollowers = 0, skippedUnknown = 0, skippedInList = 0;
  const attempted = new WeakSet();
  const verdicts = new WeakMap();

  // ---------- The list ----------
  // { version: 1, updated: ISO date, people: { username: { followedAt, hackathon } } }
  let list = { version: 1, updated: null, people: {} };
  let fileHandle = null;            // File System Access handle (Chrome) — saves back into the same file
  const hasFsApi = 'showOpenFilePicker' in window;

  const listCount = () => Object.keys(list.people).length;
  const inList = (u) => Object.prototype.hasOwnProperty.call(list.people, u.toLowerCase());
  const addToList = (u) => {
    list.people[u.toLowerCase()] = { followedAt: new Date().toISOString(), hackathon: location.hostname };
  };

  function mergeIn(data) {
    if (!data || typeof data.people !== 'object') throw new Error('Not a follow-list file');
    for (const [u, info] of Object.entries(data.people)) {
      if (!inList(u)) list.people[u.toLowerCase()] = info;
    }
  }

  // Backup on this site in case the tab closes before the file is saved
  function backupLocally() {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); } catch {}
  }
  function restoreLocalBackup() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (raw) { const before = listCount(); mergeIn(JSON.parse(raw)); return listCount() - before; }
    } catch {}
    return 0;
  }

  let saveChain = Promise.resolve();
  function saveList({ final = false } = {}) {
    list.updated = new Date().toISOString();
    backupLocally();
    unsaved = 0;
    const json = JSON.stringify(list, null, 2);
    saveChain = saveChain.then(async () => {
      if (fileHandle) {
        try {
          const w = await fileHandle.createWritable();
          await w.write(json);
          await w.close();
          return;
        } catch (e) {
          console.warn('Could not write to the list file, falling back to download:', e);
          fileHandle = null;
        }
      }
      if (final) downloadList(json); // without the file API, only download once at the end
    });
    return saveChain;
  }
  function downloadList(json) {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `devpost-followed-list-${stamp}.json`;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- Status bar ----------
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;min-height:40px;z-index:2147483647;background:#1F78D1;color:#fff;font:14px sans-serif;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 12px;box-sizing:border-box;';
  const label = document.createElement('span');
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';
  bar.append(label, buttons);
  document.body.append(bar);
  const status = (msg) => { label.textContent = msg; console.log(msg); };
  function setButtons(defs) {
    buttons.replaceChildren(...defs.map(([text, fn]) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText = 'background:#fff;color:#1F78D1;border:0;padding:4px 12px;border-radius:4px;cursor:pointer;';
      b.onclick = fn;
      return b;
    }));
  }

  // ---------- Opening / creating the list file ----------
  const pickerTypes = [{ description: 'Follow list', accept: { 'application/json': ['.json'] } }];

  async function openList() {
    try {
      if (hasFsApi) {
        const [h] = await window.showOpenFilePicker({ types: pickerTypes });
        if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          return status('⚠️ Permission to save into the file was denied. Try again and click "Allow".');
        }
        mergeIn(JSON.parse(await (await h.getFile()).text()));
        fileHandle = h;
      } else {
        const file = await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.onchange = () => resolve(input.files[0]);
          input.click();
        });
        if (!file) return;
        mergeIn(JSON.parse(await file.text()));
      }
      start();
    } catch (e) {
      if (e.name !== 'AbortError') status(`⚠️ Couldn't read that file: ${e.message}`);
    }
  }

  async function createList() {
    try {
      if (hasFsApi) {
        fileHandle = await window.showSaveFilePicker({ suggestedName: 'devpost-followed-list.json', types: pickerTypes });
        await saveList();
      }
      start();
    } catch (e) {
      if (e.name !== 'AbortError') status(`⚠️ Couldn't create the file: ${e.message}`);
    }
  }

  // ---------- Follow logic ----------
  const isFollowBtn = (el) =>
    el && el.isConnected && !el.disabled &&
    el.matches(FOLLOW_SELECTOR) &&
    el.classList.contains('follow') &&
    !el.classList.contains('following') &&
    !el.classList.contains('unfollow') &&
    (el.getAttribute('title') || el.getAttribute('data-original-title') || 'Follow') === 'Follow' &&
    !!el.querySelector('.ss-plus');

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
  const usernameFor = (btn) => {
    const card = cardFor(btn);
    if (!card) return null;
    for (const a of card.querySelectorAll('a[href]')) {
      const m = a.href.match(PROFILE_RE);
      if (m) return m[1];
    }
    return null;
  };

  // Public user, 0 followers, readable username, and not already in the list
  function isEligible(btn) {
    if (verdicts.has(btn)) return verdicts.get(btn);
    let ok = false;
    const card = cardFor(btn);
    const text = card ? card.textContent.replace(/\s+/g, ' ') : '';
    const user = usernameFor(btn);

    if (!card || !user) {
      if (card && /\bprivate user\b/i.test(text)) skippedPrivate++; else skippedUnknown++;
    } else if (/\bprivate user\b/i.test(text)) {
      skippedPrivate++;
    } else if (inList(user)) {
      skippedInList++;
    } else {
      const m = text.match(/(\d[\d,]*)\s*followers?\b/i);
      if (!m) skippedUnknown++;
      else if (parseInt(m[1].replace(/,/g, ''), 10) <= CONFIG.maxFollowerCount) ok = true;
      else skippedFollowers++;
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
    let btns = findButtons();
    while (running && btns.length) {
      let remaining = btns.length;
      for (const btn of btns) {
        if (!running) break;
        if (followed >= CONFIG.maxFollows) { finish('Reached maxFollows cap'); break; }
        attempted.add(btn);
        remaining--;
        if (!isFollowBtn(btn)) continue;
        const user = usernameFor(btn);
        if (!user || inList(user)) continue;

        const wrapper = btn.parentElement;
        btn.scrollIntoView({ block: 'center' });
        realClick(btn);
        await sleep(CONFIG.verifyWaitMs);

        const after = (wrapper && wrapper.isConnected && wrapper.querySelector(FOLLOW_SELECTOR)) || btn;
        if (!isFollowBtn(after)) {
          followed++; failures = 0;
          addToList(user);
          if (++unsaved >= CONFIG.saveEvery) saveList();
          status(`✅ Followed ${followed} this run — ${remaining} left — ${listCount()} in your list (${user})`);
        } else {
          failures++;
          console.warn('⚠️ Follow did not register for', user, after.outerHTML);
          if (failures >= CONFIG.maxFailuresInARow) {
            finish(`${failures} follows in a row failed — probably rate-limited. Wait, then run it again`);
            break;
          }
        }
        await sleep(CONFIG.followDelayMs);
      }
      btns = findButtons();
    }
    busy = false;
    if (running && !findButtons().length) finish('Everyone eligible on the page is followed');
  }

  const observer = new MutationObserver((mutations) => {
    if (!running || busy) return;
    for (const m of mutations) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && (n.matches(FOLLOW_SELECTOR) || n.querySelector(FOLLOW_SELECTOR))) {
        followAll();
        return;
      }
    }
  });

  async function finish(msg) {
    if (!running) return;
    running = false;
    observer.disconnect();
    await saveList({ final: true });
    const where = fileHandle ? `saved to ${fileHandle.name}` : 'downloaded as a new file — use that file next time';
    status(`🛑 ${msg} — Followed ${followed}. List: ${listCount()} people, ${where}. ` +
      `Skipped: ${skippedInList} already in list, ${skippedFollowers} with followers, ${skippedPrivate} private, ${skippedUnknown} unreadable.`);
    setButtons([['Close', () => bar.remove()]]);
  }
  window.stopAutoFollow = () => finish('Stopped manually');

  // ---------- Start ----------
  function start() {
    const recovered = restoreLocalBackup();
    if (recovered) console.log(`Recovered ${recovered} people from an unsaved backup on this site.`);

    learnCardDepth();
    if (cardDepth === null) {
      status('❌ Could not detect the participant card layout. Nothing was followed.');
      return setButtons([['Close', () => bar.remove()]]);
    }
    running = true;
    setButtons([['💾 Save now', () => saveList({ final: !fileHandle })], ['Stop', () => window.stopAutoFollow()]]);
    observer.observe(document.body, { childList: true, subtree: true });

    const total = document.querySelectorAll(FOLLOW_SELECTOR).length;
    const eligible = findButtons().length;
    status(`👀 ${total} participants, ${listCount()} people in your list — ${eligible} to follow ` +
      `(skipping ${skippedInList} in list, ${skippedFollowers} with followers, ${skippedPrivate} private) — starting…`);
    followAll();
  }

  status('Choose your follow list to begin:');
  setButtons([
    ['📂 Open my list', openList],
    ['➕ Create new list', createList],
    ['Cancel', () => bar.remove()],
  ]);
})();