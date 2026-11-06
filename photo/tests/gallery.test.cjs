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
function fixture({ width = 390, height = 844, coarse = true, saved, data = collection, blockedStorage = false, reduced = false, originals = false, assetBase, originalBase, saveData = false, animations = false } = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(html, { url:'https://samtc.me/photo/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:console });
  const w = dom.window;
  const d = w.document;
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
  const motions = [];
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
  w.scrollTo = options => { windowY = options.top; };
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
  if (animations) {
    w.HTMLElement.prototype.animate = function(frames, options) {
      let resolve, reject;
      const finished = new Promise((a, b) => { resolve = a; reject = b; });
      const animation = { element:this, frames, options, finished, cancelled:false,
        finish() { resolve(); }, cancel() { this.cancelled = true; reject(new Error('Animation canceled')); } };
      motions.push(animation);
      return animation;
    };
    d.getElementById('hover-preview').getBoundingClientRect = function() {
      const left = parseFloat(this.style.left), top = parseFloat(this.style.top);
      const width = parseFloat(this.style.width), height = parseFloat(this.style.height);
      return { left, top, width, height, right:left + width, bottom:top + height };
    };
  }
  if (saved) w.sessionStorage.setItem('samuel-carson:photo-deck:v1', JSON.stringify(saved));
  if (blockedStorage) Object.defineProperty(w, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
  w.eval(data + '\n' + app);
  return { w, d, grid, errors, scrolls, pending, motions, close:() => w.close(),
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
  assert.ok([...f.d.querySelectorAll('.thumbnail img')].every(image => image.src.includes('/feat/mobile-photo-deck/photo/thumbs/') && image.src.endsWith('.webp')));
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

test('desktop hover creates an opaque uncropped preview without moving gallery cards or covering controls', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const transforms = [...f.grid.children].map(card => card.style.transform);
  const thumbs = openDesktopOverview(f);
  const selected = thumbs[7];
  selected.getBoundingClientRect = () => ({ left:1300, top:720, width:115, height:153, right:1415, bottom:873 });
  pointer(f, selected, 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview');
  assert.equal(preview.hidden, false);
  assert.equal(preview.parentElement, f.d.getElementById('browse'));
  assert.equal(preview.dataset.index, '7');
  assert.ok(f.d.getElementById('hover-preview-img').src.endsWith(f.files()[7].replace('.jpg','.webp')));
  const left = parseFloat(preview.style.left), top = parseFloat(preview.style.top);
  assert.ok(left >= 18 && left + parseFloat(preview.style.width) <= 1440 - 18);
  assert.ok(top >= 162 && top + parseFloat(preview.style.height) <= 900 - 18);
  assert.deepEqual([...f.grid.children].map(card => card.style.transform), transforms);
  const style = f.d.createElement('style'); style.textContent = fs.readFileSync(path.join(root,'styles.css'),'utf8'); f.d.head.append(style);
  assert.equal(f.w.getComputedStyle(preview).opacity, '1');
  assert.equal(f.w.getComputedStyle(f.d.getElementById('hover-preview-img')).opacity, '1');
});

test('moving onto the raised preview keeps it open and clicking it opens its own full photograph', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f);
  pointer(f, thumbs[8], 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview');
  pointer(f, thumbs[8], 'pointerout', preview);
  pointer(f, preview, 'pointerenter', thumbs[8]); await hoverTick();
  assert.equal(preview.hidden, false);
  preview.click(); await tick();
  assert.equal(preview.hidden, true);
  assert.equal(f.d.getElementById('browse').open, true);
  assert.equal(f.d.getElementById('lightbox').open, true);
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[8]));
});

test('desktop thumbnail clicks open full-size and closing preserves the overview position and focus', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f), sheet = f.d.getElementById('contact-sheet');
  sheet.scrollTop = 777;
  const mainScroll = f.grid.scrollTop;
  thumbs[15].click(); await tick();
  assert.equal(f.d.getElementById('lightbox').open, true);
  assert.equal(f.d.getElementById('browse').open, true);
  f.d.querySelector('.lb-close').click(); await tick();
  assert.equal(f.d.getElementById('browse').open, true);
  assert.equal(sheet.scrollTop, 777);
  assert.equal(f.d.activeElement, thumbs[15]);
  assert.equal(thumbs[15].getAttribute('aria-current'), 'true');
  assert.equal(f.grid.scrollTop, mainScroll);
  assert.equal(f.d.documentElement.classList.contains('modal-open'), true);
  thumbs[15].click(); await tick();
  f.d.querySelector('.lb-next').click(); await tick();
  f.d.querySelector('.lb-close').click(); await tick();
  assert.equal(f.d.activeElement, thumbs[16]);
  assert.equal(thumbs[16].getAttribute('aria-current'), 'true');
  f.d.getElementById('browse-close').click(); await tick();
  assert.equal(f.d.documentElement.classList.contains('modal-open'), false);
  assert.deepEqual(f.errors, []);
});

test('mobile touch keeps thumbnail-to-deck behavior and never enables hover previews', async t => {
  const f = fixture(); t.after(f.close); await tick();
  f.d.querySelector('.browse-trigger').click();
  const thumb = f.d.querySelectorAll('.thumbnail')[9];
  pointer(f, thumb, 'pointerover', null, 'touch'); await hoverTick();
  assert.equal(f.d.getElementById('hover-preview').hidden, true);
  thumb.click(); await tick();
  assert.equal(f.d.getElementById('browse').open, false);
  assert.equal(f.d.getElementById('lightbox').open, false);
  assert.equal(f.state().file, f.files()[9]);
});

test('passing over a card quickly does not open a preview after the pointer leaves', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f);
  pointer(f, thumbs[0], 'pointerover');
  pointer(f, thumbs[0], 'pointerout', f.d.body);
  await hoverTick();
  assert.equal(f.d.getElementById('hover-preview').hidden, true);
});

test('late hover decodes cannot display a card that the pointer already left', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); f.hold(true);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  pointer(f, thumbs[0], 'pointerout', thumbs[1]);
  pointer(f, thumbs[1], 'pointerover', thumbs[0]); await hoverTick();
  assert.equal(f.pending.length, 2);
  f.pending[1].resolve(); await tick();
  const preview = f.d.getElementById('hover-preview');
  assert.equal(preview.dataset.index, '1');
  f.pending[0].resolve(); await tick();
  assert.equal(preview.dataset.index, '1');
  pointer(f, preview, 'pointerleave', f.d.body); await hoverTick();
  assert.equal(preview.hidden, true);
});

test('scrolling, resizing and closing the overview dismiss raised previews', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f), preview = f.d.getElementById('hover-preview');
  pointer(f, thumbs[2], 'pointerover'); await hoverTick();
  f.d.getElementById('contact-sheet').dispatchEvent(new f.w.Event('scroll'));
  assert.equal(preview.hidden, true);
  await hoverTick();
  pointer(f, thumbs[3], 'pointerover'); await hoverTick();
  assert.equal(preview.hidden, false);
  f.w.dispatchEvent(new f.w.Event('resize'));
  assert.equal(preview.hidden, true);
  pointer(f, thumbs[4], 'pointermove'); await hoverTick();
  assert.equal(preview.hidden, false);
  f.d.getElementById('browse-close').click(); await tick();
  assert.equal(preview.hidden, true);
});

test('keyboard focus can preview and open a desktop card without a mouse', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f);
  assert.equal(f.d.getElementById('hover-preview').hidden, true);
  f.d.dispatchEvent(new f.w.KeyboardEvent('keydown', { key:'Tab', bubbles:true }));
  thumbs[3].focus(); await tick();
  assert.equal(f.d.getElementById('hover-preview').hidden, false);
  thumbs[3].click(); await tick();
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[3]));
});

test('hover image failures leave thumbnail click navigation available', async t => {
  const f = fixture({ width:1440, height:900, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); f.reject(true);
  pointer(f, thumbs[4], 'pointerover'); await hoverTick();
  assert.equal(f.d.getElementById('hover-preview').hidden, true);
  f.reject(false); thumbs[4].click(); await tick();
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[4]));
  assert.deepEqual(f.errors, []);
});

test('very short desktop windows keep controls available instead of overflowing a hover preview', async t => {
  const f = fixture({ width:1440, height:240, coarse:false }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  assert.equal(f.d.getElementById('hover-preview').hidden, true);
  thumbs[0].click(); await tick();
  assert.equal(f.d.getElementById('lightbox').open, true);
});

function motionOrigin(thumb) {
  const rect = { left:400, top:330, width:150, height:200, right:550, bottom:530 };
  thumb.getBoundingClientRect = () => rect;
  return rect;
}
function assertFitsOrigin(transform, preview, origin) {
  const values = transform.match(/^translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)$/);
  assert.ok(values, 'the pull uses a translation and a single uniform scale');
  const [, x, y, scale] = values.map(Number);
  const width = parseFloat(preview.style.width), height = parseFloat(preview.style.height);
  assert.ok(scale > 0 && scale < 1);
  assert.ok(width * scale <= origin.width + .001);
  assert.ok(height * scale <= origin.height + .001);
  assert.ok(Math.abs(parseFloat(preview.style.left) + x + width * scale / 2 - origin.left - origin.width / 2) < .001);
  assert.ok(Math.abs(parseFloat(preview.style.top) + y + height * scale / 2 - origin.top - origin.height / 2) < .001);
}

test('the pull grows from the actual thumbnail bounds with uniform, fully opaque motion', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f), origin = motionOrigin(thumbs[0]);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview');
  assert.equal(f.motions.length, 1);
  const motion = f.motions[0];
  assertFitsOrigin(motion.frames[0].transform, preview, origin);
  assert.equal(motion.frames[1].transform, 'translate(0px, 0px) scale(1)');
  assert.ok(motion.frames.every(frame => Object.keys(frame).every(key => key === 'transform')));
  assert.equal(preview.hidden, false);
});

test('cached thumbnail starts the pull before detail download and sharper pixels do not restart it', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); motionOrigin(thumbs[0]);
  const thumbImg = thumbs[0].querySelector('img'); f.load(thumbImg); f.hold(true);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview'), image = f.d.getElementById('hover-preview-img');
  assert.equal(preview.hidden, false);
  assert.equal(image.src, thumbImg.src);
  assert.equal(f.motions.length, 1);
  assert.equal(f.pending.length, 1);
  f.pending[0].resolve(); await tick();
  assert.ok(image.src.includes('/previews/'));
  assert.equal(f.motions.length, 1);
});

test('leaving returns the card toward its thumbnail before hiding', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f), origin = motionOrigin(thumbs[0]);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  f.motions[0].finish(); await tick();
  const preview = f.d.getElementById('hover-preview');
  pointer(f, preview, 'pointerleave', f.d.body); await hoverTick();
  assert.equal(preview.hidden, false);
  assert.equal(f.motions.length, 2);
  assertFitsOrigin(f.motions[1].frames[1].transform, preview, origin);
  f.motions[1].finish(); await tick();
  assert.equal(preview.hidden, true);
});

test('reentering a returning card cancels stale completion and reverses from the current visual bounds', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); motionOrigin(thumbs[0]);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  f.motions[0].finish(); await tick();
  const preview = f.d.getElementById('hover-preview');
  pointer(f, preview, 'pointerleave', f.d.body); await hoverTick();
  const returning = f.motions[1];
  preview.getBoundingClientRect = () => ({ left:410, top:340, width:120, height:180 });
  returning.finish();
  pointer(f, preview, 'pointerenter', f.d.body); await tick();
  assert.equal(returning.cancelled, true);
  assert.equal(preview.hidden, false);
  assert.equal(f.motions.length, 3);
  assertFitsOrigin(f.motions[2].frames[0].transform, preview, { left:410, top:340, width:120, height:180 });
});

test('scroll and modal entry cancel motion immediately instead of leaving floating cards', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); motionOrigin(thumbs[0]);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview'), first = f.motions[0];
  f.d.getElementById('contact-sheet').dispatchEvent(new f.w.Event('scroll'));
  assert.equal(first.cancelled, true);
  assert.equal(preview.hidden, true);
  first.finish(); await tick();
  assert.equal(preview.hidden, true);
  await hoverTick();
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  const next = f.motions.at(-1);
  preview.click(); await tick();
  assert.equal(next.cancelled, true);
  assert.equal(preview.hidden, true);
  assert.equal(f.d.getElementById('lightbox').open, true);
});

test('reduced motion bypasses both pull and return animations', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true, reduced:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); motionOrigin(thumbs[0]);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview');
  assert.equal(preview.hidden, false);
  assert.equal(f.motions.length, 0);
  pointer(f, preview, 'pointerleave', f.d.body); await hoverTick();
  assert.equal(preview.hidden, true);
  assert.equal(f.motions.length, 0);
});

test('a moving preview uncovering its source at viewport edges does not oscillate closed', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); motionOrigin(thumbs[0]);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  const preview = f.d.getElementById('hover-preview');
  pointer(f, preview, 'pointerleave', thumbs[0]); await hoverTick();
  assert.equal(preview.hidden, false);
  assert.equal(f.motions.length, 1);
});

test('a cached preview stays usable when its high-resolution detail fails', async t => {
  const f = fixture({ width:1440, height:900, coarse:false, animations:true }); t.after(f.close); await tick();
  const thumbs = openDesktopOverview(f); motionOrigin(thumbs[0]);
  const image = thumbs[0].querySelector('img'); f.load(image); f.reject(true);
  pointer(f, thumbs[0], 'pointerover'); await hoverTick();
  assert.equal(f.d.getElementById('hover-preview').hidden, false);
  assert.equal(f.d.getElementById('hover-preview-img').src, image.src);
  f.reject(false); f.d.getElementById('hover-preview').click(); await tick();
  assert.ok(f.d.getElementById('lb-img').src.endsWith(f.files()[0]));
  assert.deepEqual(f.errors, []);
});
