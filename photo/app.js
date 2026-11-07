// The initial mix is stable. An optional shuffle is remembered for this tab.
const STATE_KEY = "samuel-carson:photo-deck:v1";
const MOBILE_QUERY = "(max-width: 700px), (max-width: 1000px) and (pointer: coarse) and (max-height: 600px)";
const mobileView = matchMedia(MOBILE_QUERY);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const assetBase = (document.documentElement.dataset.photoBase || "/photo").replace(/\/$/, "");
const originalBase = (document.documentElement.dataset.originalPhotoBase || assetBase).replace(/\/$/, "");
// A code-only review can reuse the site's already-published photographs.
const useOriginals = document.documentElement.dataset.useOriginals === "true";

function readSavedState() {
  try { return JSON.parse(sessionStorage.getItem(STATE_KEY)) || {}; }
  catch { return {}; }
}
const savedState = readSavedState();
let shuffleSeed = Number.isInteger(savedState.seed) ? savedState.seed >>> 0 : 0;
let shuffleRotation = Number.isInteger(savedState.rotation) ? savedState.rotation : 0;

function photoHash(photo) {
  let hash = 2166136261 ^ shuffleSeed;
  for (const char of photo.file) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
function interleave(groups) {
  return groups.flatMap(group => group.map((photo, i) => ({ photo, position: (i + .5) / group.length })))
    .sort((a, b) => a.position - b.position || photoHash(a.photo) - photoHash(b.photo)).map(entry => entry.photo);
}
function groupBy(photos, key) {
  const groups = new Map();
  for (const photo of photos) {
    const name = photo[key] || photo.shoot;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(photo);
  }
  return [...groups.values()];
}
function mixLooks(photos) {
  const queues = groupBy(photos, "look").map(look => [...look].sort((a, b) => photoHash(a) - photoHash(b)));
  const mixed = [];
  let previous;
  while (queues.some(queue => queue.length)) {
    const available = queues.filter(queue => queue.length)
      .sort((a, b) => b.length - a.length || photoHash(a[0]) - photoHash(b[0]));
    const queue = available.find(group => (group[0].look || group[0].shoot) !== previous) || available[0];
    const photo = queue.shift();
    mixed.push(photo);
    previous = photo.look || photo.shoot;
  }
  return mixed;
}
function mixPhotos(photos) {
  const shoots = groupBy(photos, "shoot").map(mixLooks).sort((a, b) => b.length - a.length);
  return shoots.length > 1 ? interleave([shoots[0], interleave(shoots.slice(1))]) : interleave(shoots);
}
function buildPhotos() {
  const mixed = mixPhotos(PHOTO_COLLECTION).map(photo => {
    const title = photo.title || photo.file.replace(/\.[^.]+$/, "").replace(/-/g, " ");
    const rendition = photo.file.replace(/\.[^.]+$/, ".webp");
    return { ...photo, title, alt: photo.alt || title,
      src: `${originalBase}/images/${photo.file}`,
      preview: useOriginals ? `${originalBase}/images/${photo.file}` : `${assetBase}/previews/${rendition}`,
      thumb: useOriginals ? `${originalBase}/images/${photo.file}` : `${assetBase}/thumbs/${rendition}` };
  });
  const shift = mixed.length ? ((shuffleRotation % mixed.length) + mixed.length) % mixed.length : 0;
  return [...mixed.slice(shift), ...mixed.slice(0, shift)];
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
}

const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const grid = document.getElementById("grid");
const counter = document.getElementById("photo-count");
const status = document.getElementById("gallery-status");
const browse = document.getElementById("browse");
const sheet = document.getElementById("contact-sheet");
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
let photos = buildPhotos();
let cards = [];
const cardNodes = new Map();
const decodeVersions = new WeakMap();
let activeIndex = Math.max(0, photos.findIndex(photo => photo.file === savedState.file));
let layoutFrame = 0;
let scrollFrame = 0;
let wasMobile;
let lastWidth = 0;
let lastStageHeight = 0;
let deckOffsets = [];
let lastDesktopWidth = 0;
let lastDesktopColumns = 0;
let lightboxRequest = 0;
let browseSelection = null;
let browseTrigger = null;
let sheetDirty = true;
let requestedIndex = null;
let viewerReturn = null;
let shuffleLabelTimer;
let overviewReturn = null;
let browseIndex = 0;
let browseMemory = null;
let pulledCard = null;
let extraction = null;
function dragBounds(state) {
  const rect = state.card.getBoundingClientRect();
  const top = browse.querySelector(".browse-header").getBoundingClientRect().bottom + 12;
  return {
    minX:state.dragX + 18 - rect.left,
    maxX:state.dragX + window.innerWidth - 18 - rect.right,
    minY:state.dragY + top - rect.top,
    maxY:state.dragY + window.innerHeight - 18 - rect.bottom
  };
}
function paintCardDrag(state) {
  state.dragFrame = 0;
  if (extraction !== state || state.returning) return;
  state.dragX = state.nextDragX;
  state.dragY = state.nextDragY;
  state.card.style.transform = `translate(${state.dragX}px, ${state.dragY}px) rotate(-2deg)`;
}
function queueCardMove(state,x,y,bounds) {
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  state.nextDragX = clamp(x,bounds.minX,bounds.maxX);
  state.nextDragY = clamp(y,bounds.minY,bounds.maxY);
  if (!state.dragFrame) state.dragFrame = requestAnimationFrame(() => paintCardDrag(state));
}
function moveCardDrag(state, event) {
  const drag = state.drag;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx,dy) < 6) return;
  drag.moved = true;
  state.card.classList.add("is-dragging");
  queueCardMove(state,drag.originX + dx,drag.originY + dy,drag.bounds);
}
function endCardDrag(state, { cancelled = false } = {}) {
  if (!state.drag) return;
  cancelAnimationFrame(state.dragFrame);
  if (state.drag.moved) paintCardDrag(state);
  const {id,moved} = state.drag;
  state.drag = null;
  state.card.classList.remove("is-dragging");
  if (state.card.hasPointerCapture?.(id)) state.card.releasePointerCapture(id);
  if (moved && !cancelled) {
    // Consume the click generated by this pointer release, not the next real click.
    state.suppressClick = true;
    clearTimeout(state.clickResetTimer);
    state.clickResetTimer = setTimeout(() => { state.suppressClick = false; },0);
  }
}
browse.addEventListener("pointerdown", event => {
  const state = extraction;
  if (!state || !state.settled || state.returning || state.drag || event.button !== 0 || event.isPrimary === false || event.pointerType === "touch" || !state.card.contains(event.target)) return;
  state.drag = {id:event.pointerId,x:event.clientX,y:event.clientY,originX:state.dragX,originY:state.dragY,bounds:dragBounds(state),moved:false};
  state.nextDragX = state.dragX;
  state.nextDragY = state.dragY;
  state.card.setPointerCapture?.(event.pointerId);
});
browse.addEventListener("pointermove", event => {
  const state = extraction;
  if (!state?.drag || state.drag.id !== event.pointerId) return;
  moveCardDrag(state,event);
  if (state.drag.moved) event.preventDefault();
});
browse.addEventListener("pointerup", event => {
  const state = extraction;
  if (!state?.drag || state.drag.id !== event.pointerId) return;
  moveCardDrag(state,event);
  endCardDrag(state);
});
for (const type of ["pointercancel","lostpointercapture"]) {
  browse.addEventListener(type,event => {
    const state = extraction;
    if (state?.drag?.id === event.pointerId) endCardDrag(state,{cancelled:true});
  });
}
browse.addEventListener("dragstart", event => {
  if (event.target.closest(".is-extracted")) event.preventDefault();
});
function extractCard(card) {
  if (extraction) return;
  const rect = card.getBoundingClientRect();
  const bounds = sheet.getBoundingClientRect();
  const columns = getComputedStyle(sheet).gridTemplateColumns.split(" ").length || 6;
  const next = sheet.children[Number(card.dataset.index) + columns];
  const frontTop = next ? next.getBoundingClientRect().top : rect.bottom;
  const visible = Math.max(1, Math.min(rect.height, frontTop - rect.top));
  const placeholder = card.cloneNode(true);
  placeholder.classList.remove("is-pulled");
  placeholder.style.visibility = "hidden";
  placeholder.tabIndex = -1;
  placeholder.setAttribute("aria-hidden", "true");
  const style = card.getAttribute("style");
  card.replaceWith(placeholder);
  browse.append(card);
  card.classList.remove("is-pulled");
  card.classList.add("is-extracted");
  const topEdge = browse.querySelector(".browse-header").getBoundingClientRect().bottom + 12;
  const targetTop = Math.max(topEdge, Math.min(rect.top - 120, window.innerHeight - rect.height - 18));
  const targetLeft = Math.max(18, Math.min(rect.left + 18, window.innerWidth - rect.width - 18));
  Object.assign(card.style, {left:`${targetLeft}px`,top:`${targetTop}px`,width:`${rect.width}px`,height:`${rect.height}px`});
  card.setAttribute("aria-label", `Move photograph with arrow keys; Enter returns it to the deck: ${photos[Number(card.dataset.index)].title}`);
  const surface = document.createElement("span");
  surface.className = "extraction-surface";
  surface.append(...card.childNodes);
  card.append(surface);
  const state = {card,placeholder,style,surface,motion:null,maskMotion:null,homeMotion:null,dragX:0,dragY:0,drag:null,dragFrame:0,settled:false};
  extraction = state;
  if (!reducedMotion.matches && typeof card.animate === "function") {
    const startX = rect.left - targetLeft, startY = rect.top - targetTop;
    const clipTop = Math.max(0, bounds.top - rect.top);
    const timing = {duration:780,easing:"cubic-bezier(.25,.65,.3,1)",fill:"backwards"};
    state.motion = card.animate([
      {transform:`translate(${startX}px, ${startY}px) rotate(0deg)`,offset:0},
      {transform:`translate(${startX}px, ${Math.min(startY-100,-35)}px) rotate(-2deg)`,offset:.65},
      {transform:"translate(0px, 0px) rotate(-2deg)",offset:1}
    ], timing);
    // Clip only the card surface. The outer shadow stays outside that mask.
    if (typeof surface.animate === "function") {
      state.maskMotion = surface.animate([
        {clipPath:`inset(${clipTop}px 0 ${Math.max(0,rect.height-visible)}px 0 round 8px)`,offset:0},
        {clipPath:"inset(0px 0px 0px 0px round 8px)",offset:.65},
        {clipPath:"inset(0px 0px 0px 0px round 8px)",offset:1}
      ], timing);
      const now = document.timeline?.currentTime;
      if (now != null) state.motion.startTime = state.maskMotion.startTime = now;
    }
  }
  const ready = () => {
    if (extraction !== state || state.returning) return;
    state.settled = true;
    card.classList.add("is-draggable");
    card.title = "Drag or use arrow keys to move · click or Enter to return";
  };
  if (state.motion?.finished) Promise.resolve(state.motion.finished).then(ready).catch(() => {});
  else ready();
  // The overview already uses optimized detail; reuse decoded pixels when ready.
  const image = surface.querySelector("img");
  if (image.complete && image.naturalWidth) {
    card.focus({preventScroll:true});
    return;
  }
  const detail = new Image();
  detail.decoding = "async";
  detail.fetchPriority = "high";
  detail.src = photos[Number(card.dataset.index)].preview;
  detail.decode().then(() => {
    if (extraction === state && !state.returning && card.isConnected) image.src = detail.src;
  }).catch(() => { /* The thumbnail remains visible when detail loading fails. */ });
  card.focus({preventScroll:true});
}
function restoreExtractedCard(state, { slideBack = false, focus = false } = {}) {
  if (extraction !== state) return;
  const {card,placeholder,style,surface,motion,maskMotion} = state;
  endCardDrag(state,{cancelled:true});
  cancelAnimationFrame(state.dragFrame);
  clearTimeout(state.clickResetTimer);
  extraction = null;
  state.homeMotion?.cancel();
  motion?.cancel();
  maskMotion?.cancel();
  surface.replaceWith(...surface.childNodes);
  card.classList.remove("is-extracted","is-draggable","is-dragging");
  card.removeAttribute("title");
  if (style === null) card.removeAttribute("style"); else card.setAttribute("style",style);
  card.setAttribute("aria-label", overviewCardLabel(Number(card.dataset.index)));
  if (slideBack) {
    // Rejoin the deck at the exact 80px-raised endpoint of the reverse pull.
    // Commit that pose before allowing the original slide transition to run back.
    card.style.transition = "none";
    card.classList.add("is-pulled");
  }
  placeholder.replaceWith(card);
  if (slideBack) {
    card.getBoundingClientRect();
    if (style === null) card.removeAttribute("style"); else card.setAttribute("style",style);
    if (pulledCard === card) pulledCard = null;
    card.classList.remove("is-pulled");
    card.setAttribute("aria-expanded", "false");
  }
  if (focus && card.isConnected) card.focus({preventScroll:true});
}
function reverseCardPull(state, focus) {
  const time = state.motion.currentTime;
  state.motion.reverse();
  state.maskMotion?.reverse();
  if (state.maskMotion && time != null) state.maskMotion.currentTime = time;
  Promise.resolve(state.motion.finished).then(() => {
    if (extraction === state && state.returning) restoreExtractedCard(state, {slideBack:true,focus});
  }).catch(() => { /* Lifecycle cancellation restores the card synchronously. */ });
}
function returnExtractedCard({ animate = false, focus = false } = {}) {
  if (!extraction) return false;
  const state = extraction;
  if (animate && !reducedMotion.matches && typeof state.motion?.reverse === "function") {
    if (state.returning) return true;
    endCardDrag(state,{cancelled:true});
    state.returning = true;
    state.card.classList.remove("is-draggable");
    if (Math.hypot(state.dragX,state.dragY) > .5) {
      // Glide from the dropped position to the extraction path before reversing it.
      state.homeMotion = state.card.animate([
        {transform:state.card.style.transform},
        {transform:"translate(0px, 0px) rotate(-2deg)"}
      ], {duration:Math.min(450,Math.max(220,Math.hypot(state.dragX,state.dragY)*.45)),easing:"cubic-bezier(.22,.61,.36,1)",fill:"forwards"});
      Promise.resolve(state.homeMotion.finished).then(() => {
        if (extraction !== state || !state.returning) return;
        state.card.style.removeProperty("transform");
        state.dragX = state.dragY = 0;
        state.homeMotion.cancel();
        state.homeMotion = null;
        reverseCardPull(state,focus);
      }).catch(() => {});
    } else reverseCardPull(state,focus);
    return true;
  }
  restoreExtractedCard(state);
  return false;
}
function clearPulledCard({ focus = false, animate = false } = {}) {
  const card = pulledCard;
  if (returnExtractedCard({animate,focus})) return;
  pulledCard = null;
  if (!card) return;
  card.classList.remove("is-pulled");
  card.setAttribute("aria-expanded", "false");
  if (focus && card.isConnected) card.focus({preventScroll:true});
}
sheet.addEventListener("scroll", () => {
  if (!browse.open) return;
  clearPulledCard();
}, {passive:true});
window.addEventListener("resize", () => clearPulledCard());
window.addEventListener("blur", () => clearPulledCard());
finePointer.addEventListener("change", () => clearPulledCard());
browse.addEventListener("click", event => {
  if (event.composedPath().includes(sheet)) return;
  if (event.target.closest(".is-extracted")) {
    if (extraction?.suppressClick && event.detail !== 0) return;
    clearPulledCard({animate:true,focus:true});
  } else if (!event.target.closest(".thumbnail")) clearPulledCard();
});
browse.addEventListener("keydown", event => {
  const state = extraction;
  const directions = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if (state?.settled && !state.returning && !state.drag && state.card.contains(event.target) && directions[event.key] && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    const [x,y] = directions[event.key], step = event.shiftKey ? 36 : 12;
    queueCardMove(state,(state.nextDragX ?? state.dragX) + x*step,(state.nextDragY ?? state.dragY) + y*step,dragBounds(state));
    return;
  }
  if (event.key === "Escape" && pulledCard) {
    event.preventDefault();event.stopPropagation();
    if (state?.returning) {
      clearPulledCard();
      closeBrowse();
    } else clearPulledCard({focus:true,animate:true});
  }
});

function saveState() {
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ seed: shuffleSeed, rotation: shuffleRotation, file: photos[activeIndex]?.file })); }
  catch { /* Gallery navigation also works when browser storage is unavailable. */ }
}
function setActive(index) {
  const previous = cards[activeIndex];
  activeIndex = Math.max(0, Math.min(index, photos.length - 1));
  const count = photos.length ? activeIndex + 1 : 0;
  counter.textContent = `${String(count).padStart(2, "0")} / ${photos.length}`;
  counter.setAttribute("aria-label", `Photo ${count} of ${photos.length}`);
  if (previous && previous !== cards[activeIndex]) previous.setAttribute("aria-current", "false");
  if (cards[activeIndex]?.getAttribute("aria-current") !== "true") cards[activeIndex]?.setAttribute("aria-current", "true");
  saveState();
}
function photoTop(index) {
  return (mobileView.matches ? deckOffsets[index] : undefined) ?? cards[index]?.offsetTop ?? 0;
}
function nearestDeckPhoto(top) {
  let low = 0, high = deckOffsets.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (deckOffsets[mid] < top) low = mid + 1; else high = mid;
  }
  if (!low) return 0;
  return top - deckOffsets[low - 1] <= deckOffsets[low] - top ? low - 1 : low;
}
function scrollToPhoto(index, { focus = false, smooth = false, centerDesktop = false } = {}) {
  if (!photos.length) return;
  setActive(index);
  const card = cards[activeIndex];
  const behavior = smooth && !reducedMotion.matches ? "smooth" : "instant";
  if (mobileView.matches) {
    requestedIndex = activeIndex;
    scrollDeckTo(photoTop(activeIndex), behavior);
  }
  else if (centerDesktop) {
    // Center the photograph in the usable viewport below the sticky header.
    // Use its reserved aspect ratio even before a lazy image has decoded.
    const rect = card.getBoundingClientRect();
    const photo = photos[activeIndex];
    const height = rect.width * photo.height / photo.width;
    const headerBottom = document.querySelector(".top").getBoundingClientRect().bottom;
    const viewportCenter = (headerBottom + window.innerHeight) / 2;
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top + height / 2 - viewportCenter), behavior });
  }
  else card.scrollIntoView({ block: "center", behavior });
  if (focus) card.focus({ preventScroll: true });
}
function documentDeck() {
  return mobileView.matches && document.documentElement.hasAttribute("data-document-deck");
}
function deckStart() {
  return grid.getBoundingClientRect().top + window.scrollY - document.querySelector(".top").getBoundingClientRect().height;
}
function deckScrollTop() {
  return documentDeck() ? window.scrollY - deckStart() : grid.scrollTop;
}
function deckScrollEnd() {
  return documentDeck() ? Math.max(0, document.documentElement.scrollHeight - window.innerHeight - deckStart()) : Math.max(0, grid.scrollHeight - grid.clientHeight);
}
function scrollDeckTo(top, behavior = "instant") {
  const end = deckScrollEnd();
  const target = Math.max(0, Math.min(top, end));
  if (Math.abs(target - deckScrollTop()) <= .5) return;
  if (documentDeck()) window.scrollTo({ top: target + deckStart(), behavior });
  else grid.scrollTo({ top: target, behavior });
}
function capturePosition(index = activeIndex) {
  return { file: photos[index]?.file, offset: deckScrollTop() - photoTop(index),
    height: parseFloat(cards[index]?.style.getPropertyValue("--card-height")) || 1,
    windowY: window.scrollY };
}
function restorePosition(position, { focus = false, scale = false, retainSelection = true } = {}) {
  const index = photos.findIndex(photo => photo.file === position?.file);
  if (index < 0) return;
  setActive(index);
  if (mobileView.matches) {
    const height = parseFloat(cards[index].style.getPropertyValue("--card-height")) || position.height;
    const offset = position.offset * (scale ? height / position.height : 1);
    requestedIndex = retainSelection ? index : null;
    scrollDeckTo(photoTop(index) + offset);
  } else window.scrollTo({ top: position.windowY, behavior: "instant" });
  if (focus) cards[index].focus({ preventScroll: true });
}
function layoutGallery({ force = false, preservePosition = true } = {}) {
  if (mobileView.matches) {
    const style = getComputedStyle(grid);
    const width = grid.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const stageHeight = documentDeck() ? Math.max(100, window.innerHeight - document.querySelector(".top").getBoundingClientRect().height - document.querySelector(".deck-controls").getBoundingClientRect().height) : grid.clientHeight;
    // Browser-bar animation must not resize cards and shift the document under a gesture.
    const height = documentDeck() && wasMobile === true && width === lastWidth ? lastStageHeight : stageHeight;
    if (!force && wasMobile === true && width === lastWidth && height === lastStageHeight) return;
    const position = wasMobile === true && preservePosition ? capturePosition() : null;
    grid.style.height = "";
    grid.dataset.mode = "deck";
    cards.forEach((card, i) => {
      card.style.width = "";
      card.style.transform = "";
      // Reserve the actual image height, capped only for tall portraits.
      const cardHeight = Math.min(Math.max(1, width) * photos[i].height / photos[i].width, Math.max(100, height - 32));
      card.style.setProperty("--card-height", `${cardHeight}px`);
    });
    // Read actual rounded browser positions once after layout, never per scroll frame.
    deckOffsets = cards.map(card => card.offsetTop);
    if (position) restorePosition(position, { scale: width !== lastWidth, retainSelection: requestedIndex !== null });
    else if (preservePosition) {
      requestedIndex = activeIndex;
      scrollDeckTo(photoTop(activeIndex));
    }
    lastWidth = width;
    lastStageHeight = height;
  } else {
    const style = getComputedStyle(grid);
    const columns = Number(style.getPropertyValue("--columns")) || 3;
    const gap = parseFloat(style.getPropertyValue("--gap")) || 10;
    const galleryWidth = grid.clientWidth;
    const width = (galleryWidth - gap * (columns - 1)) / columns;
    if (width <= 0) return;
    if (!force && wasMobile === false && galleryWidth === lastDesktopWidth && columns === lastDesktopColumns) return;
    grid.dataset.mode = "masonry";
    lastDesktopWidth = galleryWidth;
    lastDesktopColumns = columns;
    const heights = Array(columns).fill(0);
    const previousLooks = Array(columns).fill("");
    const shootCounts = Array.from({ length: columns }, () => new Map());
    cards.forEach((card, i) => {
      const photo = photos[i];
      const look = `${photo.shoot}/${photo.look || ""}`;
      const shortest = Math.min(...heights);
      const candidates = heights.map((_, column) => column).filter(column => heights[column] <= shortest + width * 1.5);
      candidates.sort((a, b) => Number(previousLooks[a] === look) - Number(previousLooks[b] === look) ||
        (shootCounts[a].get(photo.shoot) || 0) - (shootCounts[b].get(photo.shoot) || 0) || heights[a] - heights[b]);
      const column = candidates[0];
      card.style.width = `${width}px`;
      card.style.transform = `translate(${column * (width + gap)}px, ${heights[column]}px)`;
      heights[column] += width * photo.height / photo.width + gap;
      previousLooks[column] = look;
      shootCounts[column].set(photo.shoot, (shootCounts[column].get(photo.shoot) || 0) + 1);
    });
    grid.style.height = `${Math.max(0, ...heights) - (photos.length ? gap : 0)}px`;
    if (wasMobile === true) cards[activeIndex]?.scrollIntoView({ block: "center", behavior: "instant" });
  }
  wasMobile = mobileView.matches;
}
function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => layoutGallery());
}
function revealPhoto(img) {
  const version = (decodeVersions.get(img) || 0) + 1;
  decodeVersions.set(img, version);
  const source = img.currentSrc || img.src;
  const decoded = typeof img.decode === "function" ? img.decode() : Promise.resolve();
  decoded.then(() => {
    if (!img.isConnected || decodeVersions.get(img) !== version || (img.currentSrc || img.src) !== source || !img.naturalWidth) return;
    img.closest(".card").classList.remove("is-error");
    img.closest(".card").classList.add("is-loaded");
  }).catch(() => { /* Source switches can abort decode; only an error event is definitive. */ });
}
function imageFailed(img, photo) {
  if (!img.dataset.originalFallback) {
    img.dataset.originalFallback = "true";
    img.closest("picture").querySelectorAll("source").forEach(source => source.remove());
    img.src = photo.src;
  } else img.closest(".card").classList.add("is-error");
}
function render() {
  sheetDirty = true;
  document.querySelectorAll(".shuffle-trigger").forEach(button => { button.disabled = photos.length < 2; });
  document.querySelectorAll(".browse-trigger").forEach(button => { button.disabled = !photos.length; });
  const nextCards = photos.map((photo, i) => {
    let card = cardNodes.get(photo.file);
    if (!card) {
      const template = document.createElement("template");
      template.innerHTML = `
    <button class="card" type="button" data-index="${i}" aria-label="View photo ${i + 1} of ${photos.length}: ${escapeHTML(photo.title)}">
      <picture class="photo-picture">
        <source media="${MOBILE_QUERY}" srcset="${escapeHTML(photo.preview)}" ${useOriginals ? "" : 'type="image/webp"'} />
        <source srcset="${escapeHTML(useOriginals || photo.width <= 1080 ? `${photo.src} ${photo.width}w` : `${photo.preview} 1080w, ${photo.src} ${photo.width}w`)}" sizes="(max-width: 1100px) calc((100vw - 202px) / 2), calc((100vw - 212px) / 3)" />
        <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt)}" width="${photo.width}" height="${photo.height}"
          loading="${i < (mobileView.matches ? 2 : 6) ? "eager" : "lazy"}" decoding="async" fetchpriority="${i === activeIndex ? "high" : "auto"}" />
      </picture>
      <span class="photo-error">This photograph couldn’t load. Tap to try the original.</span>
    </button>`;
      card = template.content.firstElementChild;
      const img = card.querySelector("img");
      img.addEventListener("load", () => revealPhoto(img));
      img.addEventListener("error", () => imageFailed(img, photo));
      cardNodes.set(photo.file, card);
    }
    card.dataset.index = i;
    card.setAttribute("aria-label", `View photo ${i + 1} of ${photos.length}: ${photo.title}`);
    return card;
  });
  // Move connected cards rather than rebuilding images and clearing decoded frames.
  nextCards.forEach((card, i) => {
    const before = grid.children[i] || null;
    if (before === card) return;
    if (typeof grid.moveBefore === "function" && card.isConnected) grid.moveBefore(card, before);
    else grid.insertBefore(card, before);
  });
  cards = nextCards;
  layoutGallery({ force: true, preservePosition: false });
  cards.forEach(card => {
    const img = card.querySelector("img");
    if (img.complete && !card.classList.contains("is-loaded")) {
      if (img.naturalWidth) revealPhoto(img);
      else if (img.currentSrc) imageFailed(img, photos[Number(card.dataset.index)]);
    }
  });
  setActive(activeIndex);
}
function updateScrollPosition() {
  scrollFrame = 0;
  if (!mobileView.matches || browse.open || lightbox.open || !cards.length) return;
  const scrollTop = deckScrollTop();
  let closest = requestedIndex ?? nearestDeckPhoto(scrollTop);
  const end = deckScrollEnd();
  if (requestedIndex === null && end > 0 && scrollTop >= end - 2) closest = cards.length - 1;
  if (closest !== activeIndex) setActive(closest);
  // Prioritize the chosen photo; warm only small, immediate neighbors.
  const neighbors = navigator.connection?.saveData || useOriginals ? [closest] : [closest, closest - 1, closest + 1];
  for (const i of neighbors) {
    if (!cards[i]) continue;
    const image = cards[i].querySelector("img");
    if (image.loading !== "eager") image.loading = "eager";
    image.fetchPriority = i === closest ? "high" : "low";
  }
}
grid.addEventListener("scroll", () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollPosition);
}, { passive: true });
window.addEventListener("scroll", () => {
  if (documentDeck() && !scrollFrame) scrollFrame = requestAnimationFrame(updateScrollPosition);
}, { passive:true });
window.addEventListener("resize", () => { if (documentDeck()) scheduleLayout(); });
for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
  grid.addEventListener(type, () => { requestedIndex = null; }, { passive: true });
}

function syncModalState() {
  pauseAutoScroll();
  document.documentElement.classList.toggle("modal-open", browse.open || lightbox.open);
}
function rememberBrowse() {
  // Capture while the dialog is visible, before native close hides its scroller.
  browseMemory = mobileView.matches ? null : {file:photos[browseIndex]?.file,feedFile:photos[activeIndex]?.file,top:sheet.scrollTop,width:window.innerWidth};
}
function closeBrowse() {
  rememberBrowse();
  browse.close();
}
browse.addEventListener("cancel",rememberBrowse);
function overviewCardLabel(index) {
  const action = finePointer.matches && !mobileView.matches ? "Select photograph" : "Jump to photo";
  return `${action} ${index+1}: ${photos[index].title}`;
}
function selectBrowseCard(index) {
  const selected = sheet.children[index];
  if (!selected) return;
  if (browseIndex !== index) sheet.children[browseIndex]?.setAttribute("aria-current","false");
  browseIndex = index;
  if (selected.getAttribute("aria-current") !== "true") selected.setAttribute("aria-current","true");
}
sheet.addEventListener("focusin",event => {
  const card = event.target.closest(".thumbnail");
  if (card) selectBrowseCard(Number(card.dataset.index));
});
function openBrowse(trigger) {
  if (!photos.length) return;
  clearPulledCard();
  browseTrigger = trigger;
  browseSelection = null;
  if (sheetDirty) {
    sheet.innerHTML = photos.map((photo, i) => `<button class="thumbnail" type="button" data-index="${i}" aria-label="${escapeHTML(overviewCardLabel(i))}"><img src="${escapeHTML(photo.preview)}" alt="" width="300" height="400" loading="lazy" decoding="async" fetchpriority="low" /></button>`).join("");
    sheet.querySelectorAll("img").forEach((img, i) => img.addEventListener("error", () => { img.src = photos[i].src; }, { once: true }));
    sheetDirty = false;
  }
  const memory = !mobileView.matches && browseMemory?.feedFile === photos[activeIndex]?.file ? browseMemory : null;
  const remembered = memory ? photos.findIndex(photo => photo.file === memory.file) : -1;
  browseIndex = remembered >= 0 ? remembered : activeIndex;
  Array.from(sheet.children).forEach((button, i) => {
    button.setAttribute("aria-current",String(i === browseIndex));
    button.setAttribute("aria-label",overviewCardLabel(i));
  });
  document.getElementById("browse-count").textContent = `${photos.length} photographs · choose one to continue`;
  browse.showModal();
  syncModalState();
  const selected = sheet.children[browseIndex];
  selected.focus({ preventScroll: true });
  if (memory && remembered >= 0 && memory.width === window.innerWidth) sheet.scrollTop = memory.top;
  else selected.scrollIntoView({ block: "center", behavior: "instant" });
}
document.querySelectorAll(".browse-trigger").forEach(button => button.addEventListener("click", () => openBrowse(button)));
document.getElementById("browse-close").addEventListener("click", closeBrowse);
sheet.addEventListener("click", event => {
  const button = event.target.closest(".thumbnail");
  if (!button) return;
  selectBrowseCard(Number(button.dataset.index));
  const image = button.querySelector("img");
  image.loading = "eager";
  image.fetchPriority = "high";
  if (finePointer.matches && !mobileView.matches) {
    if (pulledCard === button) extractCard(button);
    else {
      clearPulledCard();
      pulledCard = button;
      button.classList.add("is-pulled");
      button.setAttribute("aria-expanded", "true");
    }
    return;
  }
  browseSelection = Number(button.dataset.index);
  closeBrowse();
});
sheet.addEventListener("keydown", event => {
  const button = event.target.closest(".thumbnail");
  if (!button) return;
  const columns = getComputedStyle(sheet).gridTemplateColumns.split(" ").length || 3;
  const index = Number(button.dataset.index);
  const destinations = { ArrowLeft:index - 1, ArrowRight:index + 1, ArrowUp:index - columns, ArrowDown:index + columns, Home:0, End:photos.length - 1 };
  if (!(event.key in destinations)) return;
  event.preventDefault();
  sheet.children[Math.max(0, Math.min(destinations[event.key], photos.length - 1))].focus();
});
browse.addEventListener("close", () => {
  if (browse.open) return;
  clearPulledCard();
  syncModalState();
  if (browseSelection !== null) {
    scrollToPhoto(browseSelection, { focus: true, centerDesktop: true });
    status.textContent = `Photo ${activeIndex + 1} of ${photos.length}. ${photos[activeIndex].title}.`;
  } else browseTrigger?.focus({ preventScroll: true });
});

function openLightbox(index) {
  if (!photos.length) return;
  clearPulledCard();
  if (!lightbox.open) {
    viewerReturn = capturePosition(index);
    overviewReturn = browse.open ? { file: photos[index].file, scrollTop:sheet.scrollTop } : null;
  }
  setActive(index);
  const photo = photos[activeIndex];
  const request = ++lightboxRequest;
  const caption = `${photo.title}${photo.meta ? " — " + photo.meta : ""} · ${activeIndex + 1} / ${photos.length}`;
  // Keep the previous decoded frame until the next one is ready to paint.
  if (!lbImg.hasAttribute("src")) {
    lbImg.classList.add("is-pending");
    lbCap.textContent = "";
  }
  lightbox.setAttribute("aria-busy", "true");
  if (!lightbox.open) lightbox.showModal();
  syncModalState();
  const image = new Image();
  image.src = photo.src;
  image.decode().then(() => {
    if (request !== lightboxRequest || !lightbox.open) return;
    lbImg.src = photo.src;
    lbImg.alt = photo.alt;
    lbCap.textContent = caption;
    lbImg.classList.remove("is-pending");
    lightbox.setAttribute("aria-busy", "false");
  }).catch(() => {
    if (request === lightboxRequest && lightbox.open) {
      lbCap.textContent = "This photograph couldn’t load. Try the next photo.";
      lightbox.setAttribute("aria-busy", "false");
    }
  });
}
function stepLightbox(direction) {
  if (photos.length) openLightbox((activeIndex + direction + photos.length) % photos.length);
}
document.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
document.querySelector(".lb-prev").addEventListener("click", () => stepLightbox(-1));
document.querySelector(".lb-next").addEventListener("click", () => stepLightbox(1));
lightbox.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    stepLightbox(event.key === "ArrowLeft" ? -1 : 1);
  }
});
lightbox.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
lightbox.addEventListener("close", () => {
  if (lightbox.open) return;
  lightboxRequest++;
  lbImg.removeAttribute("src");
  lightbox.setAttribute("aria-busy", "false");
  syncModalState();
  if (browse.open && overviewReturn) {
    browseSelection = activeIndex;
    Array.from(sheet.children).forEach((button, i) => button.setAttribute("aria-current", String(i === activeIndex)));
    const selected = sheet.children[activeIndex];
    selected.focus({ preventScroll:true });
    if (overviewReturn.file === photos[activeIndex]?.file) sheet.scrollTop = overviewReturn.scrollTop;
    else selected.scrollIntoView({ block:"nearest", behavior:"instant" });
  }
  else if (viewerReturn?.file === photos[activeIndex]?.file) restorePosition(viewerReturn, { focus: true });
  else scrollToPhoto(activeIndex, { focus: true });
  viewerReturn = null;
  overviewReturn = null;
});

grid.addEventListener("click", event => {
  const card = event.target.closest(".card");
  if (card) openLightbox(Number(card.dataset.index));
});
grid.addEventListener("keydown", event => {
  if (!mobileView.matches || !event.target.closest(".card")) return;
  const directions = { ArrowDown:1, ArrowRight:1, ArrowUp:-1, ArrowLeft:-1 };
  if (!(event.key in directions) && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  const index = event.key === "Home" ? 0 : event.key === "End" ? photos.length - 1 : activeIndex + directions[event.key];
  scrollToPhoto(index, { focus: true, smooth: true });
});
function randomPhotoIndex(excluded = new Set([activeIndex])) {
  if (photos.length < 2) return activeIndex;
  let candidates = photos.map((_, i) => i).filter(index => !excluded.has(index));
  if (!candidates.length) candidates = photos.map((_, i) => i).filter(index => index !== activeIndex);
  const sample = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return candidates[Math.floor(sample * candidates.length)];
}
function shuffleToPhoto() {
  if (photos.length < 2) return;
  const excluded = new Set([activeIndex]);
  if (!mobileView.matches) {
    const top = document.querySelector(".top").getBoundingClientRect().bottom;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const viewportCenter = (top + window.innerHeight) / 2;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const centeredY = window.scrollY + rect.top + rect.width * photos[i].height / photos[i].width / 2 - viewportCenter;
      // Avoid end-of-page targets that the browser cannot center.
      if (maxScroll > 0 && (centeredY < 0 || centeredY > maxScroll)) excluded.add(i);
      if (rect.width > 0 && rect.bottom > top && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth) excluded.add(i);
    });
  }
  const index = randomPhotoIndex(excluded);
  const image = cards[index].querySelector("img");
  image.loading = "eager";
  image.fetchPriority = "high";
  // A random jump needs no reordering or image-node replacement.
  scrollToPhoto(index, { centerDesktop: true });
  updateScrollPosition();
  status.textContent = `Random photograph ${activeIndex + 1} of ${photos.length}. ${photos[activeIndex].title}.`;
  const label = document.querySelector("#shuffle span");
  label.textContent = "Shuffled";
  clearTimeout(shuffleLabelTimer);
  shuffleLabelTimer = setTimeout(() => { label.textContent = "Shuffle"; }, 1400);
}
document.querySelectorAll(".shuffle-trigger").forEach(button => button.addEventListener("click", shuffleToPhoto));

new ResizeObserver(scheduleLayout).observe(grid);
mobileView.addEventListener("change", scheduleLayout);

// Native scroll positions may round to whole pixels. Carry their fractional
// remainder in a composited transform so 10px/sec still moves on every frame.
const autoScrollButton = document.getElementById("auto-scroll");
let autoScrollFrame = 0;
let autoScrollPlaying = false;
let autoScrollEnabled = false;
let autoScrollResumePending = false;
let autoScrollResumeTimer = 0;
let autoScrollPointerHeld = false;
let autoScrollTouchHeld = false;
let autoScrollTime = null;
let autoScrollPosition = 0;
let autoScrollEnd = 0;
let autoScrollInterrupted = false;
function syncAutoScrollButton() {
  autoScrollButton.setAttribute("aria-pressed", String(autoScrollEnabled));
  autoScrollButton.querySelector(".auto-scroll-label").textContent = autoScrollEnabled ? "Pause" : "Play";
  autoScrollButton.firstElementChild.textContent = autoScrollEnabled ? "Ⅱ" : "▶";
  autoScrollButton.disabled = reducedMotion.matches;
  autoScrollButton.title = reducedMotion.matches ? "Auto-scroll is off for reduced motion" : "Slowly scroll through photographs";
}
function pauseAutoScroll({ temporary = false } = {}) {
  autoScrollInterrupted = true;
  clearTimeout(autoScrollResumeTimer);
  autoScrollResumeTimer = 0;
  autoScrollResumePending = temporary && autoScrollEnabled;
  if (!temporary) {
    autoScrollEnabled = false;
    autoScrollPointerHeld = false;
    autoScrollTouchHeld = false;
  }
  autoScrollPlaying = false;
  cancelAnimationFrame(autoScrollFrame);
  autoScrollFrame = 0;
  autoScrollTime = null;
  grid.style.transform = "";
  grid.style.willChange = "";
  syncAutoScrollButton();
}
function scheduleAutoScrollResume() {
  clearTimeout(autoScrollResumeTimer);
  if (!autoScrollResumePending || !autoScrollEnabled || autoScrollPointerHeld || autoScrollTouchHeld) return;
  autoScrollResumeTimer = setTimeout(() => {
    autoScrollResumeTimer = 0;
    if (autoScrollResumePending && autoScrollEnabled) startAutoScroll();
  }, 1200);
}
function yieldAutoScroll() {
  if (!autoScrollEnabled) return;
  pauseAutoScroll({ temporary:true });
  scheduleAutoScrollResume();
}
function autoScrollTick(time) {
  autoScrollFrame = 0;
  if (!autoScrollPlaying) return;
  if (document.hidden || reducedMotion.matches || browse.open || lightbox.open) {
    pauseAutoScroll();
    return;
  }
  if (autoScrollTime !== null) {
    // Never catch up after a stalled frame with a visible jump.
    autoScrollPosition = Math.min(autoScrollEnd, autoScrollPosition + Math.min(50, Math.max(0, time - autoScrollTime)) * .01);
    const contained = mobileView.matches && !documentDeck();
    if (contained) grid.scrollTo({ top:autoScrollPosition, behavior:"instant" });
    else window.scrollTo({ top:autoScrollPosition, behavior:"instant" });
    const actual = contained ? grid.scrollTop : window.scrollY;
    grid.style.transform = `translate3d(0, ${actual - autoScrollPosition}px, 0)`;
  }
  autoScrollTime = time;
  if (autoScrollPosition >= autoScrollEnd) pauseAutoScroll();
  else autoScrollFrame = requestAnimationFrame(autoScrollTick);
}
function startAutoScroll() {
  if (autoScrollPlaying || reducedMotion.matches || document.hidden || browse.open || lightbox.open || !photos.length) return;
  const contained = mobileView.matches && !documentDeck();
  autoScrollPosition = contained ? grid.scrollTop : window.scrollY;
  autoScrollEnd = contained ? grid.scrollHeight - grid.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
  if (autoScrollPosition >= autoScrollEnd - 1) { pauseAutoScroll(); return; }
  clearTimeout(autoScrollResumeTimer);
  autoScrollResumeTimer = 0;
  autoScrollResumePending = false;
  autoScrollEnabled = true;
  autoScrollPlaying = true;
  autoScrollTime = null;
  grid.style.willChange = "transform";
  syncAutoScrollButton();
  autoScrollFrame = requestAnimationFrame(autoScrollTick);
}
autoScrollButton.addEventListener("click", () => {
  autoScrollInterrupted = true;
  if (autoScrollEnabled) pauseAutoScroll();
  else startAutoScroll();
});
const autoScrollInputOptions = { capture:true, passive:true };
document.addEventListener("wheel", yieldAutoScroll, autoScrollInputOptions);
document.addEventListener("touchstart", event => {
  if (autoScrollButton.contains(event.target)) return;
  autoScrollTouchHeld = true;
  yieldAutoScroll();
}, autoScrollInputOptions);
for (const type of ["touchend", "touchcancel"]) {
  document.addEventListener(type, event => {
    autoScrollTouchHeld = (event.touches?.length || 0) > 0;
    scheduleAutoScrollResume();
  }, autoScrollInputOptions);
}
document.addEventListener("pointerdown", event => {
  if (autoScrollButton.contains(event.target)) return;
  autoScrollPointerHeld = true;
  yieldAutoScroll();
}, autoScrollInputOptions);
for (const type of ["pointerup", "pointercancel"]) {
  document.addEventListener(type, () => {
    autoScrollPointerHeld = false;
    scheduleAutoScrollResume();
  }, autoScrollInputOptions);
}
document.addEventListener("keydown", event => {
  if (autoScrollButton.contains(event.target)) return;
  if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) yieldAutoScroll();
  else pauseAutoScroll();
}, autoScrollInputOptions);
// Scroll events keep extending the quiet period through trackpad/touch momentum.
window.addEventListener("scroll", scheduleAutoScrollResume, { passive:true });
grid.addEventListener("scroll", scheduleAutoScrollResume, { passive:true });
window.addEventListener("blur", pauseAutoScroll);
window.addEventListener("pagehide", pauseAutoScroll);
window.addEventListener("resize", yieldAutoScroll);
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseAutoScroll(); });
reducedMotion.addEventListener("change", pauseAutoScroll);
mobileView.addEventListener("change", pauseAutoScroll);
syncAutoScrollButton();
render();
requestAnimationFrame(() => {
  layoutGallery();
  if (savedState.file && photos.some(photo => photo.file === savedState.file)) scrollToPhoto(activeIndex);
  updateScrollPosition();
  if (!mobileView.matches && !autoScrollInterrupted) startAutoScroll();
});
