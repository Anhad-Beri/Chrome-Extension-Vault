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

    // ensure currentIndex in bounds
    currentIndex = Math.min(currentIndex, Math.max(0, getCurrentHighlights().length - 1));
    renderCard(currentIndex);
    renderDots();
    updateDots();
    updateNavButtons();
  });

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderCard(currentIndex);
      updateDots();
      updateNavButtons();
    }
  });

  nextBtn.addEventListener("click", () => {
    const list = getCurrentHighlights();
    if (currentIndex < list.length - 1) {
      currentIndex++;
      renderCard(currentIndex);
      updateDots();
      updateNavButtons();
    }
  });

  exportBtn.addEventListener("click", () => {
    const data = highlights.map(h => ({
      Text: h.text,
      Title: h.title,
      URL: h.url
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Highlights");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "highlights.xlsx";
    a.click();
  });

  searchBar.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query === "") {
      isSearching = false;
      filteredHighlights = [];
      currentIndex = 0;
      renderCard(currentIndex);
      renderDots();
      updateDots();
      updateNavButtons();
    } else {
      isSearching = true;
      filteredHighlights = highlights.filter(h =>
        (h.text && h.text.toLowerCase().includes(query)) ||
        (h.title && h.title.toLowerCase().includes(query))
      );

      currentIndex = 0;
      if (filteredHighlights.length === 0) {
        document.getElementById("carousel").innerHTML = "<p>No matches found.</p>";
        document.getElementById("dots").innerHTML = "";
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
      } else {
        renderCard(currentIndex);
        renderDots();
        updateDots();
        updateNavButtons();
      }
    }
  });
});

function renderCard(index) {
  const carousel = document.getElementById("carousel");
  const list = getCurrentHighlights();
  if (!list || list.length === 0) {
    carousel.innerHTML = "<p>No highlights saved yet.</p>";
    return;
  }

  // clamp index
  index = Math.min(Math.max(0, index), list.length - 1);
  const item = list[index];

  const card = document.createElement("div");
  card.className = "card";

  const textEl = document.createElement("strong");
  textEl.textContent = item.text;

  const link = document.createElement("a");
  link.href = `${item.url}#highlight-${encodeURIComponent(item.text)}`;
  link.target = "_blank";

  // guard title usage
  const ltitle = (item.title || "").split("|");
  if (ltitle.length > 1) {
    link.textContent = ltitle[0];
  } else {
    link.textContent = item.title || item.url;
  }

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
    // If we're currently viewing a filtered list, find the original index in 'highlights'
    const currentList = getCurrentHighlights();
    const itemToDelete = currentList[index];

    // find index in original highlights array (match by id if available, else text+url+title)
    let originalIndex = -1;
    if (itemToDelete.id) {
      originalIndex = highlights.findIndex(h => h.id === itemToDelete.id);
    }
    if (originalIndex === -1) {
      originalIndex = highlights.findIndex(h =>
        h.text === itemToDelete.text &&
        h.url === itemToDelete.url &&
        (h.title || "") === (itemToDelete.title || "")
      );
    }

    if (originalIndex !== -1) {
      highlights.splice(originalIndex, 1);
      chrome.storage.sync.set({ highlights }, () => {
        // If we were searching, update filteredHighlights to reflect deletion
        if (isSearching) {
          filteredHighlights = highlights.filter(h =>
            (h.text && h.text.toLowerCase().includes(document.getElementById("searchBar").value.toLowerCase().trim())) ||
            (h.title && h.title.toLowerCase().includes(document.getElementById("searchBar").value.toLowerCase().trim()))
          );
        }
        // adjust currentIndex
        const listAfter = getCurrentHighlights();
        if (listAfter.length === 0) {
          currentIndex = 0;
          document.getElementById("carousel").innerHTML = "<p>No highlights saved yet.</p>";
          document.getElementById("dots").innerHTML = "";
        } else {
          currentIndex = Math.min(currentIndex, listAfter.length - 1);
          renderCard(currentIndex);
          renderDots();
          updateDots();
        }
        updateNavButtons();
      });
    } else {
      // nothing found - just re-render
      renderCard(currentIndex);
      renderDots();
      updateDots();
      updateNavButtons();
    }
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
  const list = getCurrentHighlights() || [];
  for (let i = 0; i < list.length; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotsContainer.appendChild(dot);
  }
}

function updateDots() {
  const dots = document.querySelectorAll(".dot");
  const list = getCurrentHighlights() || [];
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === currentIndex);
  });
}

function getCurrentHighlights() {
  return isSearching ? filteredHighlights : highlights;
}

function updateNavButtons() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const list = getCurrentHighlights() || [];
  if (list.length <= 1) {
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  } else {
    prevBtn.style.display = currentIndex > 0 ? "inline-block" : "none";
    nextBtn.style.display = currentIndex < list.length - 1 ? "inline-block" : "none";
  }
}
