let highlights = [];
let currentIndex = 0;
let filteredHighlights = [];
let isSearching = false;

document.addEventListener("DOMContentLoaded", () => {
  const carousel = document.getElementById("carousel");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const exportBtn = document.getElementById("exportBtn");
  const searchBar = document.getElementById("searchBar");

  chrome.storage.sync.get("highlights", (data) => {
    highlights = data.highlights || [];

    if (highlights.length === 0) {
      carousel.innerHTML = "<p>No highlights saved yet.</p>";
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      return;
    }

    renderCard(currentIndex);
    renderDots();
    updateDots();
  });

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderCard(currentIndex);
      updateDots();
    }
  });

  nextBtn.addEventListener("click", () => {
    const list = getCurrentHighlights();
    if (currentIndex < list.length - 1) {
      currentIndex++;
      renderCard(currentIndex);
      updateDots();
    }
  });

  exportBtn.addEventListener("click", () => {
    const text = highlights.map(h => `"${h.text}"\n${h.title}\n${h.url}\n`).join("\n---\n");
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'highlights.txt';
    a.click();
  });

  searchBar.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query === "") {
      isSearching = false;
      filteredHighlights = [];
      renderCard(currentIndex);
      renderDots();
      updateDots();
    } else {
      isSearching = true;
      filteredHighlights = highlights.filter(h =>
        h.text.toLowerCase().includes(query) ||
        h.title.toLowerCase().includes(query)
      );

      currentIndex = 0;
      if (filteredHighlights.length === 0) {
        document.getElementById("carousel").innerHTML = "<p>No matches found.</p>";
        document.getElementById("dots").innerHTML = "";
      } else {
        renderCard(currentIndex);
        renderDots();
        updateDots();
      }
    }
  });
});

function renderCard(index) {
  const carousel = document.getElementById("carousel");
  const item = getCurrentHighlights()[index];

  const card = document.createElement("div");
  card.className = "card";

  const textEl = document.createElement("strong");
  textEl.textContent = item.text;

  const link = document.createElement("a");
  link.href = `${item.url}#highlight-${encodeURIComponent(item.text)}`;
  link.target = "_blank";
  link.textContent = item.title;

  const btnContainer = document.createElement("div");

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(item.text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1000);
    });
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    highlights.splice(index, 1);
    chrome.storage.sync.set({ highlights }, () => {
      if (currentIndex >= highlights.length) {
        currentIndex = Math.max(0, highlights.length - 1);
      }
      renderCard(currentIndex);
      renderDots();
      updateDots();
    });
  });

  btnContainer.appendChild(copyBtn);
  btnContainer.appendChild(deleteBtn);

  card.appendChild(textEl);
  card.appendChild(link);
  card.appendChild(btnContainer);

  carousel.innerHTML = "";
  carousel.appendChild(card);
}

function renderDots() {
  const dotsContainer = document.getElementById("dots");
  dotsContainer.innerHTML = "";
  const list = getCurrentHighlights();
  for (let i = 0; i < list.length; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotsContainer.appendChild(dot);
  }
}

function updateDots() {
  const dots = document.querySelectorAll(".dot");
  const list = getCurrentHighlights();
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentIndex);
  });
}

function getCurrentHighlights() {
  return isSearching ? filteredHighlights : highlights;
}
