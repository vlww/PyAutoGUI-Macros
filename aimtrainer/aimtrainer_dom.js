(function () {
  const TARGET_SELECTOR = '[data-aim-target="true"]';
  const CONTAINER_SELECTOR = '.desktop-only';
  const MAX_CLICKS = 31;

  let clickCount = 0;
  let lastSignature = null;

  const container = document.querySelector(CONTAINER_SELECTOR) || document.body;

  function simulateClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };

    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  function signatureFor(el) {
    return (el.getAttribute('style') || '') + '|' + el.className;
  }

  function checkAndClick() {
    if (clickCount >= MAX_CLICKS) return;

    const el = container.querySelector(TARGET_SELECTOR);
    if (!el) return;

    const sig = signatureFor(el);
    if (sig !== lastSignature) {
      simulateClick(el);
      clickCount++;
      lastSignature = sig;
      console.log(`click ${clickCount}/${MAX_CLICKS}`);
      if (clickCount >= MAX_CLICKS) {
        observer.disconnect();
        console.log('ez pz');
      }
    }
  }

  const observer = new MutationObserver(checkAndClick);
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  checkAndClick();
})();