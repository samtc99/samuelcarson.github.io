const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const collection = fs.readFileSync(path.join(root, 'photos.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 45));
const hoverTick = () => new Promise(resolve => setTimeout(resolve, 165));

// DOM/state tests, not a substitute for reviewing native scrolling on a phone.
function fixture({ width = 390, height = 844, coarse = true, saved, data = collection, blockedStorage = false, reduced = false, originals = false, assetBase, originalBase, saveData = false, documentDeck = false } = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url:'https://samtc.me/photo/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:console });
  const w = dom.window;
  const d = w.document;
  // Retain contained-mode regression coverage alongside explicit native-page cases.
  if (documentDeck) d.documentElement.setAttribute('data-document-deck','');
  else d.documentElement.removeAttribute('data-document-deck');
  if (originals) d.documentElement.dataset.useOriginals = 'true';
  if (assetBase) d.documentElement.dataset.photoBase = assetBase;
  if (originalBase) d.documentElement.dataset.originalPhotoBase = originalBase;
  Object.defineProperty(w.navigator, 'connection', { value:{ saveData } });
  const grid = d.getElementById('grid');
  const media = new Map();
  const loaded = new WeakSet();
  const scrolls = [];
  const pending = [];
  const observers = [];
  let holdDecodes = false;
  let rejectDecodes = false;
  const mobile = () => width <= 700 || (width <= 1000 && coarse && height <= 600);
  const evaluateMedia = query => query.includes('prefers-reduced-motion') ? reduced : query.includes('hover: hover') ? !coarse : mobile();
  Object.defineProperty(w, 'innerWidth', { get:() => width });
  Object.defineProperty(w, 'innerHeight', { get:() => height });
  w.matchMedia = query => {
    if (!media.has(query)) {
      const item = new w.EventTarget();
      item.media = query;
      Object.defineProperty(item, 'matches', { get:() => evaluateMedia(query) });
      media.set(query, item);
    }
    return media.get(query);
  };
  w.ResizeObserver = class { constructor(callback) { observers.push(callback); } observe() {} disconnect() {} };
  const nativeStyle = w.getComputedStyle.bind(w);
  w.getComputedStyle = el => {
    const result = nativeStyle(el);
    if (el === grid) return { paddingLeft:mobile() ? '18px' : '0px', paddingRight:mobile() ? '18px' : '0px', getPropertyValue:key => key === '--columns' ? String(width > 1100 ? 3 : 2) : key === '--gap' ? '10px' : result.getPropertyValue(key) };
    if (el.id === 'contact-sheet') return { gridTemplateColumns:Array(width <= 700 ? 3 : width <= 1100 ? 4 : 6).fill('100px').join(' ') };
    return result;
  };
  Object.defineProperty(grid, 'clientWidth', { get:() => mobile() ? width : width - 192 });
  Object.defineProperty(grid, 'clientHeight', { get:() => mobile() ? height - 132 : parseFloat(grid.style.height) || 0 });
  Object.defineProperty(grid, 'scrollHeight', { get:() => mobile() ? Math.max(grid.clientHeight,
    [...grid.children].reduce((sum, card) => sum + (parseFloat(card.style.getPropertyValue('--card-height')) || 0) + 16, 0)) : grid.clientHeight });
  Object.defineProperty(w.HTMLElement.prototype, 'offsetTop', { get() {
    if (!this.classList.contains('card')) return 0;
    if (mobile()) {
      let top = 0;
      for (const card of grid.children) {
        if (card === this) break;
        top += (parseFloat(card.style.getPropertyValue('--card-height')) || 0) + 16;
      }
      return top;
    }
    return Number(this.style.transform.match(/, ([\d.]+)px/)?.[1] || 0);
  } });
  grid.scrollTo = options => {
    scrolls.push(options);
    const top = Math.max(0, Math.min(options.top, grid.scrollHeight - grid.clientHeight));
    if (grid.scrollTop !== top) { grid.scrollTop = top; grid.dispatchEvent(new w.Event('scroll')); }
  };
  let windowY = 0;
  Object.defineProperty(w, 'scrollY', { get:() => windowY });
  w.scrollTo = options => {
    windowY = documentDeck ? Math.max(0, Math.min(options.top, d.documentElement.scrollHeight - height)) : options.top;
    if (documentDeck) w.dispatchEvent(new w.Event('scroll'));
  };
  if (documentDeck) {
    d.querySelector('.top').getBoundingClientRect = () => ({height:68,bottom:68});
    d.querySelector('.deck-controls').getBoundingClientRect = () => ({height:64});
    grid.getBoundingClientRect = () => ({top:68-windowY});
    Object.defineProperty(d.documentElement,'scrollHeight',{get:()=>68+grid.scrollHeight+84});
  }
  w.HTMLElement.prototype.scrollIntoView = function(options) { scrolls.push({ element:this, ...options }); };
  w.HTMLDialogElement.prototype.showModal = function() {
    if (this.open) throw new Error('Dialog is already open');
    this.savedFocus = d.activeElement;
    this.setAttribute('open', '');
    this.querySelector('button')?.focus();
  };
  w.HTMLDialogElement.prototype.close = function() {
    if (!this.open) return;
    this.removeAttribute('open');
    this.savedFocus?.focus();
    queueMicrotask(() => this.dispatchEvent(new w.Event('close')));
  };
  Object.defineProperty(w.HTMLImageElement.prototype, 'naturalWidth', { get() { return loaded.has(this) ? 1080 : 0; } });
  Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { get() { return loaded.has(this); } });
  // jsdom does not reflect these browser image hints itself.
  for (const [property, attribute, fallback] of [['loading','loading','eager'], ['fetchPriority','fetchpriority','auto']]) {
    Object.defineProperty(w.HTMLImageElement.prototype, property, {
      get() { return this.getAttribute(attribute) || fallback; },
      set(value) { this.setAttribute(attribute, value); }
    });
  }
  w.HTMLImageElement.prototype.decode = function() {
    if (rejectDecodes) return Promise.reject(new Error('Image unavailable'));
    if (holdDecodes) return new Promise((resolve, reject) => pending.push({ image:this, resolve, reject }));
    return Promise.resolve();
  };
  if (saved) w.sessionStorage.setItem('samuel-carson:photo-deck:v1', JSON.stringify(saved));
  if (blockedStorage) Object.defineProperty(w, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
  w.eval(data + '\n' + app);
  return { w, d, grid, errors, scrolls, pending, close:() => w.close(),
    scrollTo(options) { grid.dispatchEvent(new w.Event('wheel')); grid.scrollTo(options); },
    async resizeObserved() { observers.forEach(callback => callback()); await tick(); },
    images:() => [...grid.querySelectorAll('img')],
    files:() => [...grid.querySelectorAll('img')].map(img => img.getAttribute('src').split('/').pop()),
    state:() => JSON.parse(w.sessionStorage.getItem('samuel-carson:photo-deck:v1')),
    load(img) { loaded.add(img); img.dispatchEvent(new w.Event('load')); },
    hold(value) { holdDecodes = value; }, reject(value) { rejectDecodes = value; },
    async viewport(nextWidth, nextHeight, nextCoarse = coarse) {
      const old = new Map([...media].map(([query, item]) => [query, item.matches]));
      width = nextWidth; height = nextHeight; coarse = nextCoarse;
      for (const [query, item] of media) if (item.matches !== old.get(query)) item.dispatchEvent(new w.Event('change'));
      observers.forEach(callback => callback());
      await tick();
    }
  };
}

test('all 106 photos appear once, including the new opening image; mobile images have optimized sources', async t => {
  const f = fixture(); t.after(f.close); await tick();
  assert.equal(f.grid.dataset.mode, 'deck');
  assert.equal(f.files().length, 106);
  assert.equal(new Set(f.files()).size, 106);
  assert.equal(f.files()[0], 'Esol-72-23.jpg');
  assert.equal(f.d.getElementById('photo-count').textContent, '01 / 106');
  assert.equal(f.images().filter(img => img.loading === 'eager').length, 2);
  for (const img of f.images()) {
    assert.ok(Number(img.getAttribute('width')) > 0);
    const source = img.closest('picture').querySelector('source');
    assert.ok(source.srcset.endsWith('.webp'));
  }
  assert.deepEqual(f.errors, []);
});

test('scrolling updates counter, current photo and saved position', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const card = f.grid.children[37];
  f.scrollTo({ top:card.offsetTop }); await tick();
  assert.equal(f.d.getElementById('photo-count').textContent, '38 / 106');
  assert.equal(card.getAttribute('aria-current'), 'true');
  assert.equal(f.state().file, f.files()[37]);
});

test('thumbnail selection jumps to the matching card; dismissing the browser preserves that position', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const files = f.files();
  f.d.querySelector('.browse-trigger').click();
  const browse = f.d.getElementById('browse');
  const sheet = f.d.getElementById('contact-sheet');
  assert.equal(browse.open, true); assert.equal(sheet.children.length, 106);
  sheet.children[95].click(); await tick();
  assert.equal(browse.open, false);
  assert.equal(f.d.activeElement, f.grid.children[95]);
  assert.equal(f.grid.scrollTop, f.grid.children[95].offsetTop);
  assert.equal(f.state().file, files[95]);
  const position = f.grid.scrollTop;
  f.d.querySelector('.browse-trigger').click();
  assert.equal(sheet.children[95].getAttribute('aria-current'), 'true');
  f.d.getElementById('browse-close').click(); await tick();
  assert.equal(f.grid.scrollTop, position);
  assert.deepEqual(f.files(), files);
  assert.deepEqual(f.errors, []);
});

test('thumbnail keyboard navigation follows rows and clamps at the collection edges', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.d.querySelector('.browse-trigger').click();
  const sheet = f.d.getElementById('contact-sheet');
  sheet.children[0].dispatchEvent(new f.w.KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
  assert.equal(f.d.activeElement, sheet.children[3]);
  sheet.children[3].dispatchEvent(new f.w.KeyboardEvent('keydown', { key:'End', bubbles:true }));
  assert.equal(f.d.activeElement, sheet.children[105]);
  sheet.children[105].dispatchEvent(new f.w.KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true }));
  assert.equal(f.d.activeElement, sheet.children[105]);
});

test('full-screen navigation wraps and returns to the photo being viewed', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.grid.children[0].click(); await tick();
  const box = f.d.getElementById('lightbox');
  assert.equal(box.open, true);
  f.d.querySelector('.lb-prev').click(); await tick();
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[105]));
  f.d.querySelector('.lb-close').click(); await tick();
  assert.equal(box.open, false);
  assert.equal(f.d.activeElement, f.grid.children[105]);
  assert.equal(f.grid.scrollTop, Math.min(f.grid.children[105].offsetTop, f.grid.scrollHeight - f.grid.clientHeight));
  assert.equal(f.d.documentElement.classList.contains('modal-open'), false);
});

test('late image decodes cannot replace a later selection or a reopened viewer', async t => {
  const f = fixture(); t.after(f.close); await tick(); f.hold(true);
  f.grid.children[0].click(); f.d.querySelector('.lb-next').click();
  assert.equal(f.pending.length, 2);
  f.pending[1].resolve(); await tick();
  const chosen = f.d.getElementById('lb-img').src;
  f.pending[0].resolve(); await tick();
  assert.equal(f.d.getElementById('lb-img').src, chosen);
  f.d.querySelector('.lb-close').click(); await tick();
  f.grid.children[4].click(); f.pending.at(-1).resolve(); await tick();
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[4]));
});

test('random jump preserves the balanced deck and session reload preserves its order and place', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const before = f.files();
  const current = f.state().file;
  f.d.getElementById('shuffle').click(); await tick();
  const after = f.files();
  assert.deepEqual(after, before);
  assert.notEqual(f.state().file, current);
  assert.deepEqual([...after].sort(), [...before].sort());
  assert.equal(new Set(after).size, 106);
  f.scrollTo({ top:f.grid.children[60].offsetTop }); await tick();
  const next = fixture({ saved:f.state() }); t.after(next.close); await tick();
  assert.deepEqual(next.files(), after);
  assert.equal(next.state().file, after[60]);
  assert.equal(next.grid.scrollTop, next.grid.children[60].offsetTop);
});

test('resizing and phone landscape preserve nodes, order and selected photo', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.scrollTo({ top:f.grid.children[14].offsetTop }); await tick();
  const cards = [...f.grid.children], files = f.files();
  await f.viewport(1440, 1000, false);
  assert.equal(f.grid.dataset.mode, 'masonry');
  assert.ok(parseFloat(f.grid.style.height) > 1000);
  assert.ok(cards.every(card => card.style.width && card.style.transform));
  assert.equal(f.state().file, files[14]);
  await f.viewport(844, 390, true);
  assert.equal(f.grid.dataset.mode, 'deck');
  assert.ok(cards.every(card => !card.style.width && !card.style.transform));
  assert.equal(f.grid.scrollTop, cards[14].offsetTop);
  await f.viewport(390, 844);
  assert.deepEqual([...f.grid.children], cards);
  assert.deepEqual(f.files(), files);
  assert.deepEqual(f.errors, []);
});

test('progressive images stay hidden until decode; loading does not change card layout', async t => {
  const f = fixture({ width:1440, height:1000, coarse:false }); t.after(f.close); await tick();
  const positions = [...f.grid.children].map(card => card.style.cssText);
  const image = f.images()[0]; f.hold(true); f.load(image);
  assert.equal(image.closest('.card').classList.contains('is-loaded'), false);
  f.pending[0].resolve(); await tick();
  assert.equal(image.closest('.card').classList.contains('is-loaded'), true);
  assert.deepEqual([...f.grid.children].map(card => card.style.cssText), positions);
});

test('failed mobile copy falls back to the original; missing originals get a readable error', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const image = f.images()[0];
  image.dispatchEvent(new f.w.Event('error'));
  assert.equal(image.closest('picture').querySelector('source'), null);
  assert.ok(image.src.endsWith(f.files()[0]));
  image.dispatchEvent(new f.w.Event('error'));
  assert.equal(image.closest('.card').classList.contains('is-error'), true);
  f.d.querySelector('.browse-trigger').click();
  const thumbnail = f.d.querySelector('.thumbnail img');
  thumbnail.dispatchEvent(new f.w.Event('error'));
  assert.ok(thumbnail.src.endsWith(f.files()[0]));
});

test('failed full-size images allow navigation to another photo', async t => {
  const f = fixture(); t.after(f.close); await tick(); f.reject(true);
  f.grid.children[0].click(); await tick();
  assert.match(f.d.getElementById('lb-cap').textContent, /couldn’t load/);
  f.reject(false); f.d.querySelector('.lb-next').click(); await tick();
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[1]));
});

test('reduced motion disables smooth programmatic movement', async t => {
  const f = fixture({ reduced:true }); t.after(f.close); await tick();
  f.grid.children[0].dispatchEvent(new f.w.KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
  assert.equal(f.scrolls.at(-1).behavior, 'instant');
  assert.equal(f.d.activeElement, f.grid.children[1]);
});

test('blocked storage, invalid saved state and an empty collection remain usable', async t => {
  const blocked = fixture({ blockedStorage:true }); t.after(blocked.close); await tick();
  assert.equal(blocked.files().length, 106); assert.deepEqual(blocked.errors, []);
  const stale = fixture({ saved:{ seed:'invalid', file:'missing.jpg' } }); t.after(stale.close); await tick();
  assert.equal(stale.d.getElementById('photo-count').textContent, '01 / 106');
  const empty = fixture({ data:'const PHOTO_COLLECTION = [];' }); t.after(empty.close); await tick();
  assert.equal(empty.d.getElementById('photo-count').textContent, '00 / 0');
  assert.equal(empty.d.getElementById('shuffle').disabled, true);
  assert.equal(empty.d.querySelector('.browse-trigger').disabled, true);
});

test('photo labels are escaped rather than interpreted as HTML', async t => {
  const data = collection.replace('title: "Engagement 23"', 'title: "<img id=unexpected> & \\"quoted\\""');
  const f = fixture({ data }); t.after(f.close); await tick();
  assert.equal(f.files().length, 106);
  assert.equal(f.d.getElementById('unexpected'), null);
  assert.match(f.grid.children[0].getAttribute('aria-label'), /<img id=unexpected>/);
});

test('every manifest photo has its original and both reviewable renditions', () => {
  const files = [...collection.matchAll(/file:\s*"([^"]+)"/g)].map(match => match[1]);
  assert.equal(files.length, 106);
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, 'images', file)));
    const rendition = file.replace(/\.[^.]+$/, '.webp');
    for (const folder of ['previews', 'thumbs']) assert.ok(fs.statSync(path.join(root, folder, rendition)).size > 0);
  }
});

test('code-only review reuses existing photos for both deck and contact sheet', async t => {
  const f = fixture({ originals:true }); t.after(f.close); await tick();
  for (const img of f.images()) {
    assert.equal(img.closest('picture').querySelector('source').getAttribute('srcset'), img.getAttribute('src'));
    assert.equal(img.closest('picture').querySelector('source').getAttribute('type'), null);
  }
  f.d.querySelector('.browse-trigger').click();
  const thumbs = [...f.d.querySelectorAll('.thumbnail img')];
  assert.equal(thumbs.length, 106);
  assert.deepEqual(thumbs.map(img => img.getAttribute('src')), f.images().map(img => img.getAttribute('src')));
});

test('landscapes reserve only their image height with a consistent 16px gap at several phone sizes', async t => {
  for (const width of [320, 390, 430]) {
    const f = fixture({ width }); t.after(f.close); await tick();
    const cards = [...f.grid.children];
    let landscapes = 0;
    for (let i = 0; i < cards.length; i++) {
      const img = cards[i].querySelector('img');
      const w = Number(img.getAttribute('width')), h = Number(img.getAttribute('height'));
      const actual = parseFloat(cards[i].style.getPropertyValue('--card-height'));
      const expected = Math.min((width - 36) * h / w, f.grid.clientHeight - 32);
      assert.ok(Math.abs(actual - expected) < .001);
      if (w > h) { landscapes++; assert.ok(actual < f.grid.clientHeight / 2); }
      if (cards[i + 1]) assert.ok(Math.abs(cards[i + 1].offsetTop - cards[i].offsetTop - actual - 16) < .001);
    }
    assert.ok(landscapes > 0);
  }
});

test('shuffle jumps to a different photo without replacing images or clearing decoded state', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.images().forEach(image => f.load(image)); await tick();
  const originalNodes = new Map(f.images().map(image => [image.getAttribute('src'), image]));
  f.scrollTo({ top:f.grid.children[41].offsetTop + 57 }); await tick();
  const selected = f.state().file;
  const oldOrder = f.files();
  f.d.getElementById('shuffle').click(); await tick();
  assert.notEqual(f.state().file, selected);
  const target = f.files().indexOf(f.state().file);
  assert.equal(f.d.getElementById('photo-count').textContent, `${String(target + 1).padStart(2, '0')} / 106`);
  assert.equal(f.grid.scrollTop, Math.min(f.grid.children[target].offsetTop, f.grid.scrollHeight - f.grid.clientHeight));
  assert.deepEqual(f.files(), oldOrder);
  for (const image of f.images()) {
    assert.equal(image, originalNodes.get(image.getAttribute('src')));
    assert.equal(image.closest('.card').classList.contains('is-loaded'), true);
  }
  const next = fixture({ saved:f.state() }); t.after(next.close); await tick();
  assert.deepEqual(next.files(), f.files());
});

test('repeated random jumps preserve collection balance and never return the currently viewed photo', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const expected = [...f.files()].sort();
  f.scrollTo({ top:f.grid.children[28].offsetTop }); await tick();
  for (let n = 0; n < 12; n++) {
    const selected = f.state().file;
    f.d.getElementById('shuffle').click();
    assert.deepEqual([...f.files()].sort(), expected);
    assert.notEqual(f.state().file, selected);
    let run = 0;
    for (const file of f.files()) {
      const number = Number(file.match(/^Esol-(\d+)\.jpg$/)?.[1]);
      run = number > 0 && number <= 51 ? run + 1 : 0;
      assert.ok(run <= 1, 'studio photos should remain interleaved with other shoots');
    }
  }
});

test('height-only resizing preserves a partial scroll offset; unchanged observers do not scroll', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.scrollTo({ top:f.grid.children[36].offsetTop + 64 }); await tick();
  const count = f.scrolls.length;
  await f.resizeObserved(); await f.resizeObserved();
  assert.equal(f.scrolls.length, count);
  await f.viewport(390, 824);
  assert.equal(f.state().file, f.files()[36]);
  assert.ok(Math.abs(f.grid.scrollTop - f.grid.children[36].offsetTop - 64) < .001);
});

test('closing the same photograph restores the partial position, on mobile and desktop', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.scrollTo({ top:f.grid.children[47].offsetTop + 65 }); await tick();
  const before = f.grid.scrollTop;
  f.grid.children[47].click(); await tick();
  f.d.querySelector('.lb-close').click(); await tick();
  assert.equal(f.grid.scrollTop, before);
  await f.viewport(1440, 1000, false);
  f.w.scrollTo({ top:1234 });
  f.grid.children[47].click(); await tick();
  f.d.querySelector('.lb-close').click(); await tick();
  assert.equal(f.w.scrollY, 1234);
  assert.deepEqual(f.errors, []);
});

test('full-screen viewer holds its decoded image while loading the next photo', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.grid.children[0].click(); await tick();
  const image = f.d.getElementById('lb-img');
  const source = image.src;
  f.hold(true); f.d.querySelector('.lb-next').click();
  assert.equal(image.src, source);
  assert.equal(image.classList.contains('is-pending'), false);
  assert.equal(f.d.getElementById('lightbox').getAttribute('aria-busy'), 'true');
  f.pending[0].resolve(); await tick();
  assert.ok(image.src.endsWith(f.files()[1]));
  assert.equal(f.d.getElementById('lightbox').getAttribute('aria-busy'), 'false');
});

test('scrolling to the end selects the last photo and thumbnail jumps honor browser scroll limits', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.scrollTo({ top:Infinity }); await tick();
  assert.equal(f.d.getElementById('photo-count').textContent, '106 / 106');
  f.d.querySelector('.browse-trigger').click();
  f.d.getElementById('contact-sheet').children[105].click(); await tick();
  assert.equal(f.grid.scrollTop, f.grid.scrollHeight - f.grid.clientHeight);
  assert.equal(f.state().file, f.files()[105]);
  const short = fixture({ data:'const PHOTO_COLLECTION = Array.from({length:4},(_,i)=>({file:`landscape-${i}.jpg`,width:3000,height:2000,shoot:"scene"}));' });
  t.after(short.close); await tick();
  short.d.querySelector('.browse-trigger').click();
  short.d.getElementById('contact-sheet').children[2].click(); await tick();
  assert.equal(short.d.getElementById('photo-count').textContent, '03 / 4');
  assert.equal(short.d.activeElement, short.grid.children[2]);
});

test('image fallback stays bound to its filename after reordering', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const image = f.images()[7], source = image.src;
  f.d.getElementById('shuffle').click(); await tick();
  image.dispatchEvent(new f.w.Event('error'));
  assert.equal(image.src, source);
});

test('aborted image decode does not create an error overlay and a successful retry clears errors', async t => {
  const f = fixture(); t.after(f.close); await tick();
  const image = f.images()[0]; f.hold(true); f.load(image);
  f.pending[0].reject(new Error('Source changed')); await tick();
  assert.equal(image.closest('.card').classList.contains('is-error'), false);
  image.dispatchEvent(new f.w.Event('error'));
  image.dispatchEvent(new f.w.Event('error'));
  assert.equal(image.closest('.card').classList.contains('is-error'), true);
  f.hold(false); f.load(image); await tick();
  assert.equal(image.closest('.card').classList.contains('is-error'), false);
  assert.equal(image.closest('.card').classList.contains('is-loaded'), true);
});

test('viewport changes during a gesture do not lock the counter during subsequent momentum', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.scrollTo({ top:f.grid.children[20].offsetTop + 20 }); await tick();
  await f.viewport(390, 824);
  // Continue the same gesture: no new pointer/touch event to clear navigation state.
  f.grid.scrollTo({ top:f.grid.children[21].offsetTop + 20 }); await tick();
  assert.equal(f.state().file, f.files()[21]);
});

test('shuffle samples the first and last other photo and handles a two-photo deck', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.w.crypto.getRandomValues = array => { array[0] = 4294967295; return array; };
  f.d.getElementById('shuffle').click(); await tick();
  assert.equal(f.state().file, f.files()[105]);
  assert.equal(f.d.getElementById('photo-count').textContent, '106 / 106');
  const image = f.grid.children[105].querySelector('img');
  assert.equal(image.loading, 'eager');
  assert.equal(image.fetchPriority, 'high');
  f.w.crypto.getRandomValues = array => { array[0] = 0; return array; };
  f.d.getElementById('shuffle').click(); await tick();
  assert.equal(f.state().file, f.files()[0]);
  const two = fixture({ data:'const PHOTO_COLLECTION = [{file:"one.jpg",width:2000,height:3000,shoot:"one"},{file:"two.jpg",width:2000,height:3000,shoot:"two"}];' });
  t.after(two.close); await tick();
  const first = two.state().file;
  two.d.getElementById('shuffle').click();
  assert.notEqual(two.state().file, first);
  two.d.getElementById('shuffle').click();
  assert.equal(two.state().file, first);
});

test('the overview reuses loaded thumbnail nodes across close, shuffle and reopen', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.d.querySelector('.browse-trigger').click();
  const images = [...f.d.querySelectorAll('.thumbnail img')];
  f.d.getElementById('browse-close').click(); await tick();
  f.d.getElementById('shuffle').click(); await tick();
  f.d.querySelector('.browse-trigger').click();
  assert.deepEqual([...f.d.querySelectorAll('.thumbnail img')], images);
  assert.ok(images.every(image => image.loading === 'lazy' && image.getAttribute('fetchpriority') === 'low'));
});

test('optimized review serves small assets separately while keeping full-size originals on the live site', async t => {
  const f = fixture({ assetBase:'https://raw.githubusercontent.com/samtc99/samuelcarson.github.io/feat/mobile-photo-deck/photo', originalBase:'https://samtc.me/photo' });
  t.after(f.close); await tick();
  const images = f.images();
  for (const image of images) {
    assert.ok(image.src.startsWith('https://samtc.me/photo/images/'));
    const source = image.closest('picture').querySelector('source');
    assert.ok(source.srcset.includes('/feat/mobile-photo-deck/photo/previews/'));
    assert.equal(source.type, 'image/webp');
  }
  f.d.querySelector('.browse-trigger').click();
  assert.ok([...f.d.querySelectorAll('.thumbnail img')].every(image => image.src.includes('/feat/mobile-photo-deck/photo/previews/') && image.src.endsWith('.webp')));
});

test('data-saving mode loads the chosen photo without eagerly warming offscreen neighbors', async t => {
  const f = fixture({ saveData:true }); t.after(f.close); await tick();
  f.scrollTo({ top:f.grid.children[50].offsetTop }); await tick();
  assert.equal(f.images()[50].loading, 'eager');
  assert.equal(f.images()[49].loading, 'lazy');
  assert.equal(f.images()[51].loading, 'lazy');
});

function pointer(f, target, type, relatedTarget = null, pointerType = 'mouse') {
  const event = new f.w.MouseEvent(type, { bubbles:true, relatedTarget });
  Object.defineProperty(event, 'pointerType', { value:pointerType });
  target.dispatchEvent(event);
}
function openDesktopOverview(f) {
  f.d.querySelector('.browse-trigger').click();
  const header = f.d.querySelector('.browse-header');
  header.getBoundingClientRect = () => ({ left:0, top:0, width:f.w.innerWidth, height:150, bottom:150, right:f.w.innerWidth });
  return [...f.d.querySelectorAll('.thumbnail')];
}

test('second click pulls the same card out and requests detail while holding its thumbnail', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const thumbs=openDesktopOverview(f),card=thumbs[15],image=card.querySelector('img'),src=image.src;
 const sheet=f.d.getElementById('contact-sheet');sheet.getBoundingClientRect=()=>({top:160});
 card.getBoundingClientRect=()=>({left:400,top:300,width:200,height:267,bottom:567});
 thumbs[21].getBoundingClientRect=()=>({top:410});
 let motion;card.animate=(frames,options)=>{motion={frames,options,cancelled:false,cancel(){this.cancelled=true}};return motion};
 f.hold(true);card.click();assert.equal(card.classList.contains('is-pulled'),true);card.click();await tick();
 assert.equal(card.classList.contains('is-extracted'),true);assert.equal(card.parentElement,f.d.getElementById('browse'));
 assert.equal(card.querySelector('img'),image);assert.equal(image.src,src);assert.equal(f.pending.length,1);
 assert.equal(card.style.width,'200px');assert.equal(card.style.height,'267px');
 assert.equal(motion.options.duration,780);assert.ok(motion.frames.every(frame=>!frame.transform.includes('scale')));
 assert.equal(motion.frames[0].clipPath,undefined);assert.ok(card.querySelector('.extraction-surface'));
 assert.equal(f.d.getElementById('lightbox').open,false);assert.equal(sheet.children.length,106);
 card.click();await tick();assert.equal(sheet.children[15],card);assert.equal(card.classList.contains('is-extracted'),false);assert.equal(motion.cancelled,true);
 assert.equal(sheet.children.length,106);assert.deepEqual(f.errors,[]);
});

test('selecting another card, Escape and scrolling reset the pulled-card state without leaving Browse', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const thumbs=openDesktopOverview(f);thumbs[2].click();thumbs[3].click();
 assert.equal(thumbs[2].classList.contains('is-pulled'),false);assert.equal(thumbs[3].classList.contains('is-pulled'),true);
 thumbs[3].dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(thumbs[3].classList.contains('is-pulled'),false);assert.equal(f.d.getElementById('browse').open,true);
 thumbs[4].click();f.d.getElementById('contact-sheet').dispatchEvent(new f.w.Event('scroll'));assert.equal(thumbs[4].classList.contains('is-pulled'),false);
 assert.deepEqual(f.errors,[]);
});

test('mobile touch keeps thumbnail-to-deck behavior and never enables hover previews', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.d.querySelector('.browse-trigger').click();
  const thumb = f.d.querySelectorAll('.thumbnail')[9];
  pointer(f, thumb, 'pointerover', null, 'touch'); await hoverTick();
  assert.equal(f.d.getElementById('hover-preview'), null);
  thumb.click(); await tick();
  assert.equal(f.d.getElementById('browse').open, false);
  assert.equal(f.d.getElementById('lightbox').open, false);
  assert.equal(f.state().file, f.files()[9]);
});
test('desktop shuffle sits beside Browse and jumps past currently visible photos', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const button = f.d.querySelector('.desktop-shuffle');
  assert.equal(button.nextElementSibling, f.d.querySelector('.top-actions .browse-trigger'));
  assert.equal(button.getAttribute('aria-controls'), 'grid');
  const nodes = [...f.grid.children], files = f.files();
  f.d.querySelector('.top').getBoundingClientRect = () => ({ bottom:68 });
  nodes.forEach((card, i) => { card.getBoundingClientRect = () => ({ left:100, right:400, width:300, top:i < 3 ? 100 : 1100, bottom:i < 3 ? 550 : 1550 }); });
  f.w.crypto.getRandomValues = array => { array[0] = 0; return array; };
  button.click(); await tick();
  assert.equal(f.state().file, files[3]);
  const photo = nodes[3].querySelector('img');
  const expected = 1100 + 300 * Number(photo.height) / Number(photo.width) / 2 - (68 + 900) / 2;
  assert.equal(f.w.scrollY, expected);
  assert.equal(nodes[3].querySelector('img').loading, 'eager');
  assert.equal(nodes[3].querySelector('img').fetchPriority, 'high');
  button.click(); await tick();
  assert.equal(f.state().file, files[4]);
  assert.deepEqual([...f.grid.children], nodes);
  assert.deepEqual(f.files(), files);
});

test('desktop shuffle falls back to another photo if every card is already visible', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, data:'const PHOTO_COLLECTION = [{file:"one.jpg",width:2000,height:3000,shoot:"one"},{file:"two.jpg",width:2000,height:3000,shoot:"two"}];' });
  t.after(f.close); await tick();
  for (const card of f.grid.children) card.getBoundingClientRect = () => ({ left:100,right:400,width:300,top:100,bottom:550 });
  const first = f.state().file;
  f.d.querySelector('.desktop-shuffle').click();
  assert.notEqual(f.state().file, first);
});

test('both shuffle controls are disabled for a single photograph', async t => {
  const f = fixture({ data:'const PHOTO_COLLECTION = [{file:"one.jpg",width:2000,height:3000,shoot:"one"}];' });
  t.after(f.close); await tick();
  assert.ok([...f.d.querySelectorAll('.shuffle-trigger')].every(button => button.disabled));
});

test('desktop shuffle centers the selected image below the header before decoding, from an existing scroll position', async t => {
  for (const height of [700, 1100]) {
    const f = fixture({ width:1440, height, coarse:false }); t.after(f.close); await tick();
    f.w.scrollTo({top:1800});
    f.d.querySelector('.top').getBoundingClientRect = () => ({bottom:72});
    [...f.grid.children].forEach(card => { card.getBoundingClientRect = () => ({left:100,right:500,width:400,top:1500,bottom:2100}); });
    f.w.crypto.getRandomValues = array => { array[0] = 0; return array; };
    f.d.querySelector('.desktop-shuffle').click();
    const selected = f.grid.querySelector('[aria-current="true"] img');
    const imageCenter = 1800 + 1500 + 400 * selected.height / selected.width / 2;
    assert.equal(imageCenter - f.w.scrollY, (72 + height) / 2);
    assert.deepEqual(f.errors, []);
  }
});

test('desktop shuffle skips page-edge photographs that cannot be centered', async t => {
  const f = fixture({width:1440,height:900,coarse:false}); t.after(f.close); await tick();
  Object.defineProperty(f.d.documentElement, 'scrollHeight', {value:5000});
  f.d.querySelector('.top').getBoundingClientRect = () => ({bottom:68});
  const nodes = [...f.grid.children];
  nodes.forEach((card,i) => { card.getBoundingClientRect = () => ({left:100,right:400,width:300,top:i < 3 ? 4900 : 1500,bottom:i < 3 ? 5350 : 1950}); });
  f.w.crypto.getRandomValues = array => {array[0]=0;return array;};
  f.d.querySelector('.desktop-shuffle').click();
  assert.equal(f.state().file,f.files()[3]);
  assert.ok(f.w.scrollY > 0 && f.w.scrollY < 4100);
});

test('native-page deck keeps shuffle, Browse jumps, counter and viewer return on document scrolling', async t => {
 const f=fixture({documentDeck:true});t.after(f.close);await tick();
 f.w.crypto.getRandomValues=a=>{a[0]=2147483648;return a;};
 f.d.getElementById('shuffle').click();await tick();
 const selected=f.grid.querySelector('[aria-current="true"]');
 assert.ok(f.w.scrollY>0);assert.equal(f.w.scrollY,selected.offsetTop);assert.equal(f.grid.scrollTop,0);
 f.d.querySelector('.browse-trigger').click();f.d.querySelectorAll('.thumbnail')[12].click();await tick();
 assert.equal(f.state().file,f.files()[12]);assert.equal(f.w.scrollY,f.grid.children[12].offsetTop);
 f.grid.dispatchEvent(new f.w.Event('touchstart'));f.w.scrollTo({top:f.grid.children[12].offsetTop+40});await tick();
 const before=f.w.scrollY;f.grid.children[12].click();await tick();f.d.querySelector('.lb-close').click();await tick();
 assert.equal(f.w.scrollY,before);assert.equal(f.state().file,f.files()[12]);assert.deepEqual(f.errors,[]);
});
test('native-page deck holds card sizes and position while browser bar height changes', async t => {
 const f=fixture({documentDeck:true});t.after(f.close);await tick();
 const heights=[...f.grid.children].map(c=>c.style.getPropertyValue('--card-height'));
 f.grid.dispatchEvent(new f.w.Event('touchstart'));f.w.scrollTo({top:f.grid.children[20].offsetTop+55});await tick();const before=f.w.scrollY;
 await f.viewport(390,940);assert.equal(f.w.scrollY,before);
 assert.deepEqual([...f.grid.children].map(c=>c.style.getPropertyValue('--card-height')),heights);
 assert.equal(f.state().file,f.files()[20]);assert.deepEqual(f.errors,[]);
});

test('production entry enables document scrolling and its review keeps the live asset base', () => {
 assert.match(html, /<html[^>]*data-document-deck/);
 const review=fs.readFileSync(path.join(root,'../review/mobile-deck.html'),'utf8');
 assert.match(review, /<html[^>]*data-document-deck/);
 assert.match(review, /data-photo-base="https:\/\/samtc.me\/photo"/);
});

test('hovering and focusing thumbnails never starts detail decodes or creates a floating photo', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const thumbs=openDesktopOverview(f);f.hold(true);
 const nodes=[...f.grid.children],srcs=thumbs.map(t=>t.querySelector('img').src);
 for(const thumb of thumbs.slice(0,12)){pointer(f,thumb,'pointerover');thumb.focus();pointer(f,thumb,'pointerout',f.d.body);}
 await hoverTick();assert.equal(f.pending.length,0);assert.equal(f.d.getElementById('hover-preview'),null);
 assert.deepEqual([...f.grid.children],nodes);assert.deepEqual(thumbs.map(t=>t.querySelector('img').src),srcs);assert.deepEqual(f.errors,[]);
});

test('Escape and resize restore an extracted card to its exact slot', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const thumbs=openDesktopOverview(f),sheet=f.d.getElementById('contact-sheet'),card=thumbs[8];
 card.click();card.click();assert.equal(card.classList.contains('is-extracted'),true);
 card.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(sheet.children[8],card);assert.equal(card.classList.contains('is-extracted'),false);assert.equal(f.d.getElementById('browse').open,true);
 card.click();card.click();f.w.dispatchEvent(new f.w.Event('resize'));
 assert.equal(sheet.children[8],card);assert.equal(sheet.children.length,106);assert.equal(card.hasAttribute('style'),false);assert.deepEqual(f.errors,[]);
});

test('second-click detail swaps only after decode and does not alter card geometry or restart motion', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const card=openDesktopOverview(f)[10],image=card.querySelector('img'),thumb=image.src;
 f.hold(true);card.click();assert.equal(f.pending.length,0);card.click();
 const geometry=card.getAttribute('style');assert.equal(f.pending.length,1);assert.equal(image.src,thumb);
 assert.equal(f.pending[0].image.fetchPriority,'high');
 f.pending[0].resolve();await tick();assert.ok(image.src.includes('/previews/'));assert.equal(card.getAttribute('style'),geometry);
 assert.equal(card.querySelector('img'),image);assert.equal(card.classList.contains('is-extracted'),true);assert.deepEqual(f.errors,[]);
});
test('late or failed detail loads leave returned and newly extracted cards intact', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const thumbs=openDesktopOverview(f),first=thumbs[4],second=thumbs[5],image=first.querySelector('img'),src=image.src;
 f.hold(true);first.click();first.click();first.click();second.click();second.click();
 f.pending[0].resolve();await tick();assert.equal(image.src,src);assert.equal(second.classList.contains('is-extracted'),true);
 const secondImage=second.querySelector('img'),secondSrc=secondImage.src;f.pending[1].reject(new Error('offline'));await tick();
 assert.equal(secondImage.src,secondSrc);assert.equal(second.classList.contains('is-extracted'),true);assert.deepEqual(f.errors,[]);
});

function reverseMotionFixture(f) {
 const motions=[];
 f.w.HTMLElement.prototype.animate=function(frames,options){
  let resolve;
  const motion={element:this,frames,options,currentTime:240,reversed:false,cancelled:false,
   finished:new Promise(r=>{resolve=r}),reverse(){this.reversed=true},cancel(){this.cancelled=true},finishReverse(){resolve()}};
  motions.push(motion);return motion;
 };
 return motions;
}
test('third click reverses both live extraction animations before sliding the original card back into its slot', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const motions=reverseMotionFixture(f),card=openDesktopOverview(f)[7],sheet=f.d.getElementById('contact-sheet');
 card.click();card.click();assert.equal(motions.length,2);
 card.click();assert.ok(motions.every(m=>m.reversed));assert.equal(motions[1].currentTime,240);
 assert.equal(card.classList.contains('is-extracted'),true);assert.equal(card.parentElement,f.d.getElementById('browse'));
 card.click();assert.equal(motions.length,2); // repeated clicks do not restart the return
 motions[0].finishReverse();await tick();
 assert.equal(sheet.children[7],card);assert.equal(card.classList.contains('is-extracted'),false);assert.equal(card.classList.contains('is-pulled'),false);
 assert.equal(card.hasAttribute('style'),false);assert.equal(card.getAttribute('aria-expanded'),'false');assert.equal(f.d.activeElement,card);
 assert.ok(motions.every(m=>m.cancelled));assert.deepEqual(f.errors,[]);
});
test('a cancelled reverse cannot restore an old card over a newer selection', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const motions=reverseMotionFixture(f),thumbs=openDesktopOverview(f),sheet=f.d.getElementById('contact-sheet');
 thumbs[7].click();thumbs[7].click();thumbs[7].click();
 thumbs[9].click();assert.equal(sheet.children[7],thumbs[7]);assert.equal(thumbs[9].classList.contains('is-pulled'),true);
 motions[0].finishReverse();await tick();
 assert.equal(thumbs[9].classList.contains('is-pulled'),true);assert.equal(sheet.children.length,106);assert.deepEqual(f.errors,[]);
});

test('every overview card starts with the optimized higher-resolution source and retains lazy loading', async t => {
 const f=fixture({width:1440,height:900,coarse:false});t.after(f.close);await tick();
 const thumbs=openDesktopOverview(f);
 assert.equal(thumbs.length,106);
 for(const card of thumbs){const image=card.querySelector('img');assert.ok(image.src.includes('/previews/'));assert.equal(image.loading,'lazy');assert.equal(image.getAttribute('decoding'),'async');}
 const card=thumbs[7],image=card.querySelector('img');f.load(image);const src=image.src;f.hold(true);
 card.click();card.click();assert.equal(f.pending.length,0);assert.equal(image.src,src);assert.deepEqual(f.errors,[]);
});
