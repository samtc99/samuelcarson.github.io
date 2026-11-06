// A stable shuffle: the same collection has the same order on every visit.
function photoHash(photo) {
  let hash = 2166136261;
  for (const char of photo.file) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// Merge evenly spaced positions, keeping smaller groups spread from top to bottom.
function interleave(groups) {
  return groups.flatMap(group => group.map((photo, i) => ({
    photo, position: (i + 0.5) / group.length
  }))).sort((a, b) => a.position - b.position || photoHash(a.photo) - photoHash(b.photo))
    .map(entry => entry.photo);
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
  const queues = groupBy(photos, "look").map(look =>
    [...look].sort((a, b) => photoHash(a) - photoHash(b))
  );
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
  const shoots = groupBy(photos, "shoot").map(mixLooks)
    .sort((a, b) => b.length - a.length);

  // A large session must not crowd out all the smaller shoots at either end.
  if (shoots.length > 1) {
    return interleave([shoots[0], interleave(shoots.slice(1))]);
  }
  return interleave(shoots);
}

const PHOTOS = mixPhotos(PHOTO_COLLECTION).map(photo => {
  const title = photo.title || photo.file.replace(/\.[^.]+$/, "").replace(/-/g, " ");
  return {
    ...photo,
    src: `/photo/images/${photo.file}`,
    title,
    meta: photo.meta || "",
    tag: photo.tag || "portraits",
    alt: photo.alt || title
  };
});

const grid = document.getElementById("grid");
const chips = Array.from(document.querySelectorAll(".chip"));

const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbCap = document.getElementById("lb-cap");
const btnClose = document.querySelector(".lb-close");
const btnPrev = document.querySelector(".lb-prev");
const btnNext = document.querySelector(".lb-next");

let active = "all";
let visible = [...PHOTOS];
let currentIndex = 0;

function layoutGallery() {
  const style = getComputedStyle(grid);
  const columns = Number(style.getPropertyValue("--columns"));
  const gap = parseFloat(style.getPropertyValue("--gap"));
  const width = (grid.clientWidth - gap * (columns - 1)) / columns;
  const heights = Array(columns).fill(0);
  const previousLooks = Array(columns).fill("");
  const shootCounts = Array.from({ length: columns }, () => new Map());

  // Place cards using known dimensions, never image-load events. CSS columns
  // rebalance as lazy images arrive, moving photos that were already on screen.
  Array.from(grid.children).forEach((card, i) => {
    const photo = visible[i];
    const look = `${photo.shoot}/${photo.look || ""}`;
    const shortest = Math.min(...heights);
    // Among columns within one portrait's height, avoid repeating a look and
    // spread each shoot across the columns instead of creating vertical blocks.
    const candidates = heights.map((_, column) => column)
      .filter(column => heights[column] <= shortest + width * 1.5);
    candidates.sort((a, b) =>
      Number(previousLooks[a] === look) - Number(previousLooks[b] === look) ||
      (shootCounts[a].get(photo.shoot) || 0) - (shootCounts[b].get(photo.shoot) || 0) ||
      heights[a] - heights[b]
    );
    const column = candidates[0];
    card.style.width = `${width}px`;
    card.style.transform = `translate(${column * (width + gap)}px, ${heights[column]}px)`;
    heights[column] += width * photo.height / photo.width + gap;
    previousLooks[column] = look;
    shootCounts[column].set(photo.shoot, (shootCounts[column].get(photo.shoot) || 0) + 1);
  });
  grid.style.height = `${Math.max(0, ...heights) - (visible.length ? gap : 0)}px`;
}

function revealPhoto(img) {
  // Keep progressive/partially decoded frames hidden; reveal each image once.
  img.decode().catch(() => {}).then(() => {
    img.closest(".card").classList.add(img.naturalWidth ? "is-loaded" : "is-error");
  });
}

function render() {
  visible = PHOTOS.filter(p => active === "all" || p.tag === active);

  grid.innerHTML = visible.map((p, i) => `
  <article class="card" role="button" tabindex="0" data-index="${i}" aria-label="${p.title}">
    <img src="${p.src}" alt="${p.alt}" width="${p.width}" height="${p.height}"
      loading="${i < 6 ? "eager" : "lazy"}" decoding="async" fetchpriority="${i < 3 ? "high" : "auto"}" />
  </article>
`).join("");

  layoutGallery();
  grid.querySelectorAll("img").forEach(img => {
    // Wait for load before decode so off-screen images remain lazy-loaded.
    if (img.complete) revealPhoto(img);
    else {
      img.addEventListener("load", () => revealPhoto(img), { once: true });
      img.addEventListener("error", () => img.closest(".card").classList.add("is-error"), { once: true });
    }
  });
}

new ResizeObserver(layoutGallery).observe(grid);

function setChipActive(chip){
  chips.forEach(c => {
    const isActive = c === chip;
    c.classList.toggle("is-active", isActive);
    c.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

let lightboxRequest = 0;

function openLightbox(i){
  const request = ++lightboxRequest;
  currentIndex = i;
  const p = visible[currentIndex];
  lbImg.style.visibility = "hidden";
  lbCap.textContent = `${p.title}${p.meta ? " — " + p.meta : ""}`;
  lb.classList.add("is-open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const image = new Image();
  image.src = p.src;
  image.decode().catch(() => {}).then(() => {
    // Ignore an old download if the visitor has navigated or closed the viewer.
    if (request !== lightboxRequest) return;
    lbImg.src = p.src;
    lbImg.alt = p.alt;
    lbImg.style.visibility = "visible";
  });
}

function closeLightbox(){
  lightboxRequest++;
  lb.classList.remove("is-open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  lbImg.removeAttribute("src");
}

function prev(){
  if (!visible.length) return;
  openLightbox((currentIndex - 1 + visible.length) % visible.length);
}
function next(){
  if (!visible.length) return;
  openLightbox((currentIndex + 1) % visible.length);
}

chips.forEach(chip => {
  chip.addEventListener("click", () => {
    active = chip.dataset.filter;
    setChipActive(chip);
    render();
  });
});

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  openLightbox(Number(card.dataset.index));
});

grid.addEventListener("keydown", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openLightbox(Number(card.dataset.index));
  }
});

btnClose.addEventListener("click", closeLightbox);
btnPrev.addEventListener("click", prev);
btnNext.addEventListener("click", next);

lb.addEventListener("click", (e) => {
  // click backdrop to close
  if (e.target === lb) closeLightbox();
});

window.addEventListener("keydown", (e) => {
  if (!lb.classList.contains("is-open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") prev();
  if (e.key === "ArrowRight") next();
});

render();
