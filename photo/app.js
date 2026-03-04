const PHOTOS = [
  // Put images in /photo/images/ and keep these paths relative
  { src: "/photo/images/Esol-01.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-02.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-03.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-04.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-05.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-06.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-07.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-08.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-09.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-10.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-11.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-12.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-13.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-14.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-15.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-16.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-17.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-18.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
   { src: "/photo/images/Esol-19.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-20.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-21.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-22.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-23.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-24.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-25.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-26.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-27.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-28.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-29.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-30.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-31.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-32.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-33.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-34.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-35.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-36.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
   { src: "/photo/images/Esol-37.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-38.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-39.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-40.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-41.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-42.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-43.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-44.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-45.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-46.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-47.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-48.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-49.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-50.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-51.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-52.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-53.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-54.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
   { src: "/photo/images/Esol-55.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-56.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-57.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-58.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-59.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-60.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-61.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-62.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-63.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-64.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-65.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-66.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-67.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-68.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-69.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-70.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
  { src: "/photo/images/Esol-71.jpg", title: "Desert Light", meta: "Utah · 2024", tag: "travel", alt: "Desert landscape at golden hour" },
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
