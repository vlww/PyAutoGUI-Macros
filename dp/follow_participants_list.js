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
  let saveBlocked = false; // true when Chrome withdrew permission and a click is needed

  // Merge in what other tabs saved, then write. Retries if another tab is mid-write.
  async function writeToFile() {
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const before = listCount();
        const current = (await (await fileHandle.getFile()).text()).trim();
        if (current) {
          try { mergeIn(JSON.parse(current)); }
          catch { /* file caught mid-write by another tab — retry */ throw Object.assign(new Error('partial file'), { name: 'RetryError' }); }
        }
        const fromOthers = listCount() - before;
        if (fromOthers > 0) console.log(`Merged ${fromOthers} people saved by another tab.`);

        list.updated = new Date().toISOString();
        const w = await fileHandle.createWritable();
        await w.write(JSON.stringify(list, null, 2));
        await w.close();
        saveBlocked = false;
        return true;
      } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
          saveBlocked = true;
          console.warn('Chrome withdrew permission to save into the list file.');
          return false;
        }
        // Busy (another tab writing) or a transient error — wait and retry
        console.warn(`Save attempt ${attempt} failed (${e.name}) — retrying…`);
        await sleep(300 * attempt + Math.random() * 300);
      }
    }
    return false;
  }

  function saveList({ final = false } = {}) {
    unsaved = 0;
    saveChain = saveChain.then(async () => {
      backupLocally(); // always keep a copy on this site first
      if (fileHandle) {
        const ok = await writeToFile();
        backupLocally();
        if (!ok) showAllowSaving();
        return;      // never fall back to a download while we have the file
      }
      // Only browsers without the file API (not Chrome) get a download, once at the end
      list.updated = new Date().toISOString();
      if (final) downloadList(JSON.stringify(list, null, 2));
    });
    return saveChain;
  }

  // If permission was withdrawn, offer a one-click fix (Chrome requires a click to re-allow)
  function showAllowSaving() {
    if (!saveBlocked || buttons.querySelector('[data-allow-save]')) return;
    status(`⚠️ Chrome needs permission to save into ${fileHandle.name}. Click "Allow saving" — nothing is lost meanwhile.`);
    const b = document.createElement('button');
    b.dataset.allowSave = '1';
    b.textContent = '🔓 Allow saving';
    b.style.cssText = 'background:#FFD54F;color:#000;border:0;padding:4px 12px;border-radius:4px;cursor:pointer;';
    b.onclick = async () => {
      try {
        if ((await fileHandle.requestPermission({ mode: 'readwrite' })) === 'granted') {
          b.remove();
          saveBlocked = false;
          await saveList();
          status(`💾 Saved to ${fileHandle.name} — ${listCount()} people in your list.`);
        }
      } catch (e) {
        console.warn('Permission request failed:', e);
      }
    };
    buttons.prepend(b);
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

  // Remember the chosen file (per hackathon site) so it can be reused automatically
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('devpostFollowList', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const idbGet = async (k) => {
    const db = await idb();
    return new Promise((res, rej) => {
      const q = db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  };
  const idbSet = async (k, v) => {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  };

  async function useHandle(h) {
    const text = await (await h.getFile()).text();
    if (text.trim()) mergeIn(JSON.parse(text));
    fileHandle = h;
    try { await idbSet('handle', h); } catch {}
    start();
  }

  async function openList() {
    try {
      if (hasFsApi) {
        const [h] = await window.showOpenFilePicker({ types: pickerTypes, startIn: 'documents' });
        if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          return status('⚠️ Permission to save into the file was denied. Try again and choose "Allow on every visit".');
        }
        await useHandle(h);
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
        start();
      }
    } catch (e) {
      if (e.name !== 'AbortError') status(`⚠️ Couldn't read that file: ${e.message}`);
    }
  }

  async function createList() {
    try {
      if (hasFsApi) {
        fileHandle = await window.showSaveFilePicker({ suggestedName: 'followed.json', startIn: 'documents', types: pickerTypes });
        if ((await fileHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          return status('⚠️ Permission to save into the file was denied.');
        }
        await saveList();
        try { await idbSet('handle', fileHandle); } catch {}
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
    const where = !fileHandle ? 'downloaded as a new file — use that file next time'
      : saveBlocked ? `NOT yet saved to ${fileHandle.name} — click "Allow saving"`
      : `saved to ${fileHandle.name}`;
    status(`🛑 ${msg} — Followed ${followed}. List: ${listCount()} people, ${where}. ` +
      `Skipped: ${skippedInList} already in list, ${skippedFollowers} with followers, ${skippedPrivate} private, ${skippedUnknown} unreadable.`);
    setButtons([['Close', () => bar.remove()]]);
    if (saveBlocked) showAllowSaving();
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

  function askForFile(msg = 'Choose Documents/followed.json to begin:') {
    status(msg);
    setButtons([
      ['📂 Open followed.json', openList],
      ['➕ Create followed.json', createList],
      ['Cancel', () => bar.remove()],
    ]);
  }

  // Use the remembered file automatically when Chrome still allows it
  (async () => {
    if (!hasFsApi) return askForFile('This browser can\'t remember files — choose your list file:');
    let saved = null;
    try { saved = await idbGet('handle'); } catch {}
    if (!saved) return askForFile();

    let perm = 'prompt';
    try { perm = await saved.queryPermission({ mode: 'readwrite' }); } catch {}

    if (perm === 'granted') {
      try {
        status(`📂 Using ${saved.name}…`);
        return await useHandle(saved);
      } catch (e) {
        return askForFile(`⚠️ Couldn't open ${saved.name} (moved or deleted?) — choose it again:`);
      }
    }

    // Chrome needs one click to re-allow access (skipped if "Allow on every visit" was chosen)
    status(`📂 Remembered ${saved.name} — click Start to allow access (choose "Allow on every visit" to skip this next time).`);
    setButtons([
      ['▶ Start', async () => {
        try {
          if ((await saved.requestPermission({ mode: 'readwrite' })) === 'granted') await useHandle(saved);
          else askForFile('⚠️ Access not allowed — choose the file again:');
        } catch (e) {
          askForFile(`⚠️ Couldn't open ${saved.name} — choose it again:`);
        }
      }],
      ['📂 Different file', openList],
      ['Cancel', () => bar.remove()],
    ]);
  })();
})();