const PHOTOS = [
  // Put images in /photo/images/ and keep these paths relative
  { src: "./images/EsolB&W-1.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "./images/EsolB&W-2.jpg", title: "Window Portrait", meta: "Seattle · 2025", tag: "portraits", alt: "Portrait by window light" },
  { src: "./images/EsolB&W-3.jpg", title: "Rain Study", meta: "Tokyo · 2023", tag: "bw", alt: "Street scene in rain, black and white" },
   { src: "./images/EsolB&W-4.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "./images/EsolB&W-5.2.jpg", title: "Window Portrait", meta: "Seattle · 2025", tag: "portraits", alt: "Portrait by window light" },
  { src: "./images/EsolB&W-5.jpg", title: "Rain Study", meta: "Tokyo · 2023", tag: "bw", alt: "Street scene in rain, black and white" },
];

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

function render() {
  visible = PHOTOS.filter(p => active === "all" || p.tag === active);

  grid.innerHTML = visible.map((p, i) => `
    <article class="card" role="button" tabindex="0" data-index="${i}">
      <img src="${p.src}" alt="${p.alt || p.title}" loading="lazy" />
      <div class="overlay">
        <div class="caption">
          <div class="name">${p.title}</div>
          <div class="meta">${p.meta || ""}</div>
        </div>
        <div class="pill">${active === "all" ? p.tag : "view"}</div>
      </div>
    </article>
  `).join("");
}

function setChipActive(chip){
  chips.forEach(c => {
    const isActive = c === chip;
    c.classList.toggle("is-active", isActive);
    c.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function openLightbox(i){
  currentIndex = i;
  const p = visible[currentIndex];
  lbImg.src = p.src;
  lbImg.alt = p.alt || p.title;
  lbCap.textContent = `${p.title}${p.meta ? " — " + p.meta : ""}`;
  lb.classList.add("is-open");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox(){
  lb.classList.remove("is-open");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setTimeout(() => { lbImg.src = ""; }, 80);
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
  if (e.key === "Enter" || e.key === " ") openLightbox(Number(card.dataset.index));
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
