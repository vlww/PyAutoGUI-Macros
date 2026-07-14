(function () {
  const idMap = {"path30":"Utah","path42":"South Dakota","path134":"New York","path152":"West Virginia","path36":"New Mexico","path116":"Tennessee","path122":"Mississippi","path74":"Louisiana","path164":"New Hampshire","path167":"Massachusetts","path45":"Texas","path140":"Kentucky","path119":"Michigan","path56":"Minnesota","path143":"Ohio","path128":"Illinois","path33":"Colorado","path65":"Arkansas","path4":"Washington","path27":"Nevada","path53":"Iowa","path10":"Oregon","path146":"Virginia","path110":"Alabama","path107":"Georgia","path48":"Nebraska","path59":"Wisconsin","path71":"Kansas","path113":"North Carolina","path21":"Idaho","path15":"Wyoming","path68":"Oklahoma","path161":"Vermont","path125":"Indiana","path18":"Montana","path39":"North Dakota","path62":"Missouri","path131":"South Carolina","path158":"Maine","path7":"California"};

  const bboxMap = [{"name":"Maryland","tag":"ellipse","bbox":{"x":735.7620239257812,"y":264.125,"width":27.444000244140625,"height":34.79999923706055}},{"name":"New Jersey","tag":"circle","bbox":{"x":776.5999755859375,"y":239.89999389648438,"width":32.79999923706055,"height":32.79999923706055}},{"name":"Pennsylvania","tag":"polygon","bbox":{"x":679.2000122070312,"y":215.34100341796875,"width":95.12200927734375,"height":62.865997314453125}},{"name":"Rhode Island","tag":"circle","bbox":{"x":805.9000244140625,"y":199.89999389648438,"width":23.600000381469727,"height":23.600000381469727}},{"name":"Connecticut","tag":"ellipse","bbox":{"x":786.7999877929688,"y":214.09999084472656,"width":16.101999282836914,"height":13.289999961853027}},{"name":"Hawaii","tag":"ellipse","bbox":{"x":204.70001220703125,"y":540.2999877929688,"width":130.3000030517578,"height":136.23399353027344}},{"name":"Delaware","tag":"circle","bbox":{"x":766.9000244140625,"y":271.20001220703125,"width":24.600000381469727,"height":24.600000381469727}},{"name":"Alaska","tag":"ellipse","bbox":{"x":1.6999969482421875,"y":491,"width":203,"height":204.98599243164062}},{"name":"Arizona","tag":"polygon","bbox":{"x":120.0999984741211,"y":327.6000061035156,"width":111.5999984741211,"height":132.19998168945312}},{"name":"Florida","tag":"circle","bbox":{"x":649.2000122070312,"y":455.70001220703125,"width":135,"height":135}}];

  function getPromptText() {
    const all = document.querySelectorAll('div,span,p,h1,h2,h3');
    for (const el of all) {
      const t = el.textContent.trim();
      if (t.startsWith('Click on ') && t.length < 60) {
        const rest = t.replace('Click on ', '');
        const half = rest.slice(0, Math.ceil(rest.length / 2));
        return rest === half + half ? half : rest;
      }
    }
    return null;
  }

  function findShapeByName(name) {
    const id = Object.keys(idMap).find(k => idMap[k] === name);
    if (id) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    const entry = bboxMap.find(b => b.name === name);
    if (!entry) return null;
    const candidates = document.querySelectorAll(entry.tag);
    let best = null, bestDist = Infinity;
    for (const c of candidates) {
      let b;
      try { b = c.getBBox(); } catch (e) { continue; }
      const dist = Math.abs(b.x - entry.bbox.x) + Math.abs(b.y - entry.bbox.y) +
                   Math.abs(b.width - entry.bbox.width) + Math.abs(b.height - entry.bbox.height);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return bestDist < 5 ? best : null; 
  }

  function clickShape(shape) {
    const rect = shape.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
    shape.dispatchEvent(new MouseEvent('mousedown', opts));
    shape.dispatchEvent(new MouseEvent('mouseup', opts));
    shape.dispatchEvent(new MouseEvent('click', opts));
  }

  let last = null;

  function handleChange() {
    const name = getPromptText();
    if (name && name !== last) {
      last = name;
      const shape = findShapeByName(name);
      if (shape) clickShape(shape);
      else console.warn('No shape found for', name);
    }
  }

  const promptObserver = new MutationObserver(handleChange);
  promptObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  handleChange(); 

  console.log('Auto-clicker running. Call clearInterval(' + 'window.__autoClickerTimer' + ') to stop.');
  window.__autoClickerTimer = timer;
})();