// The initial mix is stable. An optional shuffle is remembered for this tab.
const STATE_KEY = "samuel-carson:photo-deck:v1";
const MOBILE_QUERY = "(max-width: 700px), (max-width: 1000px) and (pointer: coarse) and (max-height: 600px)";
const mobileView = matchMedia(MOBILE_QUERY);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
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

const grid = document.getElementById("grid");
const counter = document.getElementById("photo-count");
const status = document.getElementById("gallery-status");
const browse = document.getElementById("browse");
const sheet = document.getElementById("contact-sheet");
const lightbox = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
const hoverPreview = document.getElementById("hover-preview");
const hoverImg = document.getElementById("hover-preview-img");
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
let lightboxRequest = 0;
let browseSelection = null;
let browseTrigger = null;
let sheetDirty = true;
let requestedIndex = null;
let viewerReturn = null;
let shuffleLabelTimer;
let overviewReturn = null;
let hoverCandidate = null;
let hoverRequest = 0;
let hoverTimer;
let hoverCloseTimer;
let keyboardNavigation = false;
let hoverBlockedUntil = 0;
let hoverOrigin = null;
let hoverAnimation = null;
let hoverClosing = false;

function desktopPreviewEnabled() {
  return finePointer.matches && !mobileView.matches;
}
function cancelHoverMotion() {
  const animation = hoverAnimation;
  hoverAnimation = null;
  hoverClosing = false;
  animation?.cancel();
}
function hoverBox() {
  return { left:parseFloat(hoverPreview.style.left), top:parseFloat(hoverPreview.style.top),
    width:parseFloat(hoverPreview.style.width), height:parseFloat(hoverPreview.style.height) };
}
function cardTransform(rect, box) {
  // A single scale keeps the photograph's proportions intact throughout motion.
  const scale = Math.max(.01, Math.min(rect.width / box.width, rect.height / box.height));
  const x = rect.left + (rect.width - box.width * scale) / 2 - box.left;
  const y = rect.top + (rect.height - box.height * scale) / 2 - box.top;
  return `translate(${x}px, ${y}px) scale(${scale})`;
}
function hideHoverPreview({ animate = false } = {}) {
  clearTimeout(hoverTimer);
  clearTimeout(hoverCloseTimer);
  hoverRequest++;
  hoverCandidate = null;
  if (animate && !hoverPreview.hidden && hoverOrigin?.isConnected && !reducedMotion.matches && typeof hoverPreview.animate === "function") {
    const current = hoverPreview.getBoundingClientRect();
    const origin = hoverOrigin.getBoundingClientRect();
    const box = hoverBox();
    cancelHoverMotion();
    hoverClosing = true;
    const animation = hoverPreview.animate([
      { transform:cardTransform(current, box) },
      { transform:cardTransform(origin, box) }
    ], { duration:180, easing:"cubic-bezier(.4,0,.7,.2)", fill:"forwards" });
    hoverAnimation = animation;
    Promise.resolve(animation.finished).then(() => {
      if (hoverAnimation !== animation || !hoverClosing) return;
      hoverPreview.hidden = true;
      hoverOrigin = null;
      cancelHoverMotion();
    }).catch(() => {});
    return;
  }
  cancelHoverMotion();
  hoverPreview.hidden = true;
  hoverOrigin = null;
}
function positionHoverPreview(origin, photo, rect = origin.getBoundingClientRect()) {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 18;
  const topEdge = Math.min(viewportHeight - 100, Math.max(margin, browse.querySelector(".browse-header").getBoundingClientRect().bottom + 12));
  const availableHeight = viewportHeight - topEdge - margin - 46;
  if (availableHeight < 100 || viewportWidth < 200) return false;
  const imageHeight = Math.min(600, availableHeight);
  const imageWidth = Math.max(1, Math.min(420, viewportWidth - margin * 2 - 16, imageHeight * photo.width / photo.height));
  const width = imageWidth + 16;
  const height = imageWidth * photo.height / photo.width + 46;
  const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - margin));
  const top = Math.max(topEdge, Math.min(rect.top + rect.height / 2 - height / 2 - 8, viewportHeight - height - margin));
  Object.assign(hoverPreview.style, { width:`${width}px`, height:`${height}px`, left:`${left}px`, top:`${top}px` });
  return true;
}
function presentHoverPreview(origin, photo, index, source) {
  // A sharper image can replace its cached thumbnail without replaying the pull.
  if (!hoverPreview.hidden && hoverOrigin === origin && !hoverClosing) {
    hoverImg.src = source;
    return;
  }
  const originRect = origin.getBoundingClientRect();
  const start = hoverClosing && hoverOrigin === origin ? hoverPreview.getBoundingClientRect() : originRect;
  cancelHoverMotion();
  if (hoverPreview.parentElement !== browse) browse.append(hoverPreview);
  if (!positionHoverPreview(origin, photo, originRect)) return;
  hoverOrigin = origin;
  hoverImg.src = source;
  hoverPreview.dataset.index = String(index);
  hoverPreview.setAttribute("aria-label", `View full photograph: ${photo.title}`);
  hoverPreview.hidden = false;
  if (!reducedMotion.matches && typeof hoverPreview.animate === "function") {
    const animation = hoverPreview.animate([
      { transform:cardTransform(start, hoverBox()) },
      { transform:"translate(0px, 0px) scale(1)" }
    ], { duration:300, easing:"cubic-bezier(.16,1,.3,1)", fill:"none" });
    hoverAnimation = animation;
    Promise.resolve(animation.finished).then(() => {
      if (hoverAnimation === animation) hoverAnimation = null;
    }).catch(() => {});
  }
}
function loadHoverDetail(origin, photo, index, request) {
  const image = new Image();
  image.src = photo.preview;
  image.decode().then(() => {
    if (request !== hoverRequest || hoverCandidate !== origin || !desktopPreviewEnabled() || !browse.open || lightbox.open) return;
    presentHoverPreview(origin, photo, index, photo.preview);
  }).catch(() => { /* The cached thumbnail remains usable if its larger copy fails. */ });
}
function scheduleHoverPreview(origin, delay = 70) {
  if (!desktopPreviewEnabled() || !browse.open || lightbox.open || performance.now() < hoverBlockedUntil) return;
  clearTimeout(hoverTimer);
  clearTimeout(hoverCloseTimer);
  if (hoverCandidate === origin && !hoverPreview.hidden) return;
  hoverCandidate = origin;
  const request = ++hoverRequest;
  hoverTimer = setTimeout(() => {
    const index = Number(origin.dataset.index);
    const photo = photos[index];
    if (!photo || hoverCandidate !== origin) return;
    // Start with the already-decoded thumbnail instead of waiting on the network.
    const thumb = origin.querySelector("img");
    if (thumb.complete && thumb.naturalWidth) presentHoverPreview(origin, photo, index, thumb.currentSrc || thumb.src);
    loadHoverDetail(origin, photo, index, request);
  }, delay);
}
function deferHoverClose() {
  clearTimeout(hoverTimer);
  clearTimeout(hoverCloseTimer);
  hoverRequest++;
  if (hoverPreview.hidden) {
    hoverCandidate = null;
    return;
  }
  hoverCloseTimer = setTimeout(() => hideHoverPreview({ animate:true }), 90);
}

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
function scrollToPhoto(index, { focus = false, smooth = false, centerDesktop = false } = {}) {
  if (!photos.length) return;
  setActive(index);
  const card = cards[activeIndex];
  const behavior = smooth && !reducedMotion.matches ? "smooth" : "instant";
  if (mobileView.matches) {
    requestedIndex = activeIndex;
    scrollDeckTo(card.offsetTop, behavior);
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
function scrollDeckTo(top, behavior = "instant") {
  const end = Math.max(0, grid.scrollHeight - grid.clientHeight);
  const target = Math.max(0, Math.min(top, end));
  if (Math.abs(target - grid.scrollTop) > .5) grid.scrollTo({ top: target, behavior });
}
function capturePosition(index = activeIndex) {
  return { file: photos[index]?.file, offset: grid.scrollTop - (cards[index]?.offsetTop || 0),
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
    scrollDeckTo(cards[index].offsetTop + offset);
  } else window.scrollTo({ top: position.windowY, behavior: "instant" });
  if (focus) cards[index].focus({ preventScroll: true });
}
function layoutGallery({ force = false, preservePosition = true } = {}) {
  if (mobileView.matches) {
    const style = getComputedStyle(grid);
    const width = grid.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const height = grid.clientHeight;
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
    if (position) restorePosition(position, { scale: width !== lastWidth, retainSelection: requestedIndex !== null });
    else if (preservePosition) {
      requestedIndex = activeIndex;
      scrollDeckTo(cards[activeIndex]?.offsetTop || 0);
    }
    lastWidth = width;
    lastStageHeight = height;
  } else {
    grid.dataset.mode = "masonry";
    const style = getComputedStyle(grid);
    const columns = Number(style.getPropertyValue("--columns")) || 3;
    const gap = parseFloat(style.getPropertyValue("--gap")) || 10;
    const width = (grid.clientWidth - gap * (columns - 1)) / columns;
    if (width <= 0) return;
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
    img.closest("picture").querySelector("source")?.remove();
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
  let closest = 0;
  let distance = Infinity;
  cards.forEach((card, i) => {
    const delta = Math.abs(card.offsetTop - grid.scrollTop);
    if (delta < distance) { closest = i; distance = delta; }
  });
  const end = Math.max(0, grid.scrollHeight - grid.clientHeight);
  if (requestedIndex !== null) closest = requestedIndex;
  else if (end > 0 && grid.scrollTop >= end - 2) closest = cards.length - 1;
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
for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) {
  grid.addEventListener(type, () => { requestedIndex = null; }, { passive: true });
}

function syncModalState() {
  document.documentElement.classList.toggle("modal-open", browse.open || lightbox.open);
}
function openBrowse(trigger) {
  if (!photos.length) return;
  hideHoverPreview();
  browseTrigger = trigger;
  browseSelection = null;
  if (sheetDirty) {
    sheet.innerHTML = photos.map((photo, i) => `<button class="thumbnail" type="button" data-index="${i}" aria-label="Jump to photo ${i + 1}: ${escapeHTML(photo.title)}"><img src="${escapeHTML(photo.thumb)}" alt="" width="300" height="400" loading="lazy" decoding="async" fetchpriority="low" /></button>`).join("");
    sheet.querySelectorAll("img").forEach((img, i) => img.addEventListener("error", () => { img.src = photos[i].src; }, { once: true }));
    sheetDirty = false;
  }
  Array.from(sheet.children).forEach((button, i) => button.setAttribute("aria-current", String(i === activeIndex)));
  document.getElementById("browse-count").textContent = `${photos.length} photographs · choose one to continue`;
  browse.showModal();
  syncModalState();
  const selected = sheet.children[activeIndex];
  selected.focus({ preventScroll: true });
  selected.scrollIntoView({ block: "center", behavior: "instant" });
}
document.querySelectorAll(".browse-trigger").forEach(button => button.addEventListener("click", () => openBrowse(button)));
document.getElementById("browse-close").addEventListener("click", () => browse.close());
sheet.addEventListener("click", event => {
  const button = event.target.closest(".thumbnail");
  if (!button) return;
  if (desktopPreviewEnabled()) {
    openLightbox(Number(button.dataset.index));
    return;
  }
  browseSelection = Number(button.dataset.index);
  browse.close();
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
  hideHoverPreview();
  syncModalState();
  if (browseSelection !== null) {
    scrollToPhoto(browseSelection, { focus: true });
    status.textContent = `Photo ${activeIndex + 1} of ${photos.length}. ${photos[activeIndex].title}.`;
  } else browseTrigger?.focus({ preventScroll: true });
});

function openLightbox(index) {
  if (!photos.length) return;
  hideHoverPreview();
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

document.addEventListener("keydown", event => {
  if (["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) keyboardNavigation = true;
  if (event.key === "Escape") hideHoverPreview();
}, true);
document.addEventListener("pointerdown", () => { keyboardNavigation = false; }, true);
sheet.addEventListener("pointerover", event => {
  if (event.pointerType === "touch") return;
  const button = event.target.closest(".thumbnail");
  if (button && !button.contains(event.relatedTarget)) scheduleHoverPreview(button);
});
sheet.addEventListener("pointerout", event => {
  const button = event.target.closest(".thumbnail");
  if (!button || button.contains(event.relatedTarget) || hoverPreview.contains(event.relatedTarget)) return;
  deferHoverClose();
});
sheet.addEventListener("pointermove", event => {
  if (event.pointerType === "touch" || !hoverPreview.hidden) return;
  const button = event.target.closest(".thumbnail");
  // Scrolling can move a card under a stationary pointer while hover is blocked.
  // A subsequent mouse movement should work without leaving and re-entering it.
  if (button && hoverCandidate !== button) scheduleHoverPreview(button);
});
sheet.addEventListener("focusin", event => {
  const button = event.target.closest(".thumbnail");
  if (button && keyboardNavigation) scheduleHoverPreview(button, 0);
});
sheet.addEventListener("focusout", event => {
  if (!hoverPreview.contains(event.relatedTarget)) deferHoverClose();
});
hoverPreview.addEventListener("pointerenter", () => {
  clearTimeout(hoverCloseTimer);
  if (hoverClosing && hoverOrigin) {
    const origin = hoverOrigin;
    const index = Number(hoverPreview.dataset.index);
    hoverCandidate = origin;
    const request = ++hoverRequest;
    presentHoverPreview(origin, photos[index], index, hoverImg.src);
    if (hoverImg.src !== photos[index].preview) loadHoverDetail(origin, photos[index], index, request);
  }
});
hoverPreview.addEventListener("pointerleave", event => {
  // A growing card can uncover its source near a clamped viewport edge.
  // Treat the source and raised preview as one continuous hover area.
  if (hoverOrigin?.contains(event.relatedTarget)) {
    clearTimeout(hoverCloseTimer);
    return;
  }
  deferHoverClose();
});
hoverPreview.addEventListener("click", () => {
  if (!hoverPreview.hidden) openLightbox(Number(hoverPreview.dataset.index));
});
sheet.addEventListener("scroll", () => {
  hideHoverPreview();
  hoverBlockedUntil = performance.now() + 160;
}, { passive:true });
window.addEventListener("resize", hideHoverPreview);
window.addEventListener("blur", hideHoverPreview);
finePointer.addEventListener("change", hideHoverPreview);
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
render();
requestAnimationFrame(() => {
  layoutGallery();
  if (savedState.file && photos.some(photo => photo.file === savedState.file)) scrollToPhoto(activeIndex);
  updateScrollPosition();
});
