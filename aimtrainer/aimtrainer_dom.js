(function () {
  const TARGET_SELECTOR = '[data-aim-target="true"]';
  const CONTAINER_SELECTOR = '.desktop-only';
  const MAX_CLICKS = 31;

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

  const container = document.querySelector(CONTAINER_SELECTOR) || document.body;

  for (let i = 0; i < MAX_CLICKS; i++) {
    const el = container.querySelector(TARGET_SELECTOR);
    if (el) simulateClick(el);
  }
})();