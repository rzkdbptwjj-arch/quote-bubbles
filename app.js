const storageKey = "quote-bubble.entries.v1";

const quoteForm = document.querySelector("#quoteForm");
const quoteInput = document.querySelector("#quoteInput");
const sourceInput = document.querySelector("#sourceInput");
const tagInput = document.querySelector("#tagInput");
const previewQuote = document.querySelector("#previewQuote");
const previewSource = document.querySelector("#previewSource");
const submitLabel = document.querySelector("#submitLabel");
const editStatus = document.querySelector("#editStatus");
const cancelEditButton = document.querySelector("#cancelEditButton");
const searchInput = document.querySelector("#searchInput");
const tagFilter = document.querySelector("#tagFilter");
const quoteList = document.querySelector("#quoteList");
const emptyState = document.querySelector("#emptyState");
const resultCount = document.querySelector("#resultCount");
const totalCount = document.querySelector("#totalCount");
const sampleButton = document.querySelector("#sampleButton");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");

let quotes = loadQuotes();
let editingId = null;
let activeTag = "";

render();
updatePreview();

quoteInput.addEventListener("input", updatePreview);
sourceInput.addEventListener("input", updatePreview);
searchInput.addEventListener("input", render);
tagInput.addEventListener("input", updatePreview);

quoteForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = quoteInput.value.trim();
  if (!text) return;

  const nextQuote = {
    id: editingId || crypto.randomUUID(),
    text,
    source: sourceInput.value.trim() || "출처 없음",
    tags: parseTags(tagInput.value),
    createdAt: editingId ? findQuote(editingId)?.createdAt || now() : now(),
    updatedAt: now()
  };

  if (editingId) {
    quotes = quotes.map((quote) => quote.id === editingId ? nextQuote : quote);
  } else {
    quotes.push(nextQuote);
  }

  saveQuotes();
  resetForm();
  render();
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  render();
});

sampleButton.addEventListener("click", () => {
  quotes = [
    {
      id: crypto.randomUUID(),
      text: "삶이 있는 한 희망은 있다.",
      source: "키케로",
      tags: ["희망", "위로"],
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: crypto.randomUUID(),
      text: "천천히 가도 멈추지 않으면 된다.",
      source: "기록장",
      tags: ["꾸준함", "공부"],
      createdAt: now(),
      updatedAt: now()
    }
  ];
  saveQuotes();
  render();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quote-bubbles-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Invalid backup");
    quotes = imported
      .filter((quote) => quote.text)
      .map((quote) => ({
        id: quote.id || crypto.randomUUID(),
        text: String(quote.text),
        source: String(quote.source || "출처 없음"),
        tags: Array.isArray(quote.tags) ? quote.tags.map(String) : [],
        createdAt: quote.createdAt || now(),
        updatedAt: quote.updatedAt || now()
      }));
    saveQuotes();
    render();
  } catch {
    alert("백업 파일을 읽지 못했어요.");
  } finally {
    importInput.value = "";
  }
});

function render() {
  const filtered = filteredQuotes();
  totalCount.textContent = `${quotes.length}개`;
  resultCount.textContent = `${filtered.length}개`;
  emptyState.hidden = quotes.length > 0;
  renderTags();
  renderQuotes(filtered);
}

function renderTags() {
  const tags = [...new Set(quotes.flatMap((quote) => quote.tags))].sort((a, b) => a.localeCompare(b, "ko-KR"));
  tagFilter.innerHTML = "";

  if (!tags.length) return;

  const allButton = makeTagButton("전체", activeTag === "");
  allButton.addEventListener("click", () => {
    activeTag = "";
    render();
  });
  tagFilter.append(allButton);

  tags.forEach((tag) => {
    const button = makeTagButton(`#${tag}`, activeTag === tag);
    button.addEventListener("click", () => {
      activeTag = activeTag === tag ? "" : tag;
      render();
    });
    tagFilter.append(button);
  });
}

function renderQuotes(items) {
  quoteList.innerHTML = "";

  items.forEach((quote) => {
    const item = document.createElement("li");
    item.className = "quote-item";
    item.innerHTML = `
      <article class="quote-bubble">
        <p></p>
        <footer></footer>
      </article>
      <div class="quote-meta">
        <div class="quote-tags"></div>
        <div class="quote-actions">
          <button class="edit-button" type="button">수정</button>
          <button class="delete-button" type="button">삭제</button>
        </div>
      </div>
    `;

  item.querySelector("p").textContent = stripOuterQuotes(quote.text);
    item.querySelector("footer").textContent = quote.source;
    const tags = item.querySelector(".quote-tags");
    quote.tags.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "quote-tag";
      chip.textContent = `#${tag}`;
      tags.append(chip);
    });
    item.querySelector(".edit-button").addEventListener("click", () => startEditing(quote));
    item.querySelector(".delete-button").addEventListener("click", () => {
      quotes = quotes.filter((current) => current.id !== quote.id);
      if (editingId === quote.id) resetForm();
      saveQuotes();
      render();
    });
    quoteList.append(item);
  });
}

function filteredQuotes() {
  const keyword = normalize(searchInput.value);
  return [...quotes]
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt))
    .filter((quote) => {
      const tagMatched = !activeTag || quote.tags.includes(activeTag);
      const searchable = normalize([quote.text, quote.source, quote.tags.join(" ")].join(" "));
      const keywordMatched = !keyword || searchable.includes(keyword);
      return tagMatched && keywordMatched;
    });
}

function startEditing(quote) {
  editingId = quote.id;
  quoteInput.value = quote.text;
  sourceInput.value = quote.source;
  tagInput.value = quote.tags.join(", ");
  submitLabel.textContent = "수정 저장";
  editStatus.textContent = "수정 중";
  cancelEditButton.hidden = false;
  updatePreview();
  quoteForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  quoteInput.value = "";
  sourceInput.value = "";
  tagInput.value = "";
  submitLabel.textContent = "저장하기";
  editStatus.textContent = "새 기록";
  cancelEditButton.hidden = true;
  updatePreview();
}

function updatePreview() {
  previewQuote.textContent = stripOuterQuotes(quoteInput.value.trim()) || "인용구 말풍선 사용";
  previewSource.textContent = sourceInput.value.trim() || "출처 입력";
}

function parseTags(value) {
  return [...new Set(value
    .split(/[,#\n]+/)
    .map((tag) => tag.trim())
    .filter(Boolean))];
}

function makeTagButton(text, active) {
  const button = document.createElement("button");
  button.className = active ? "tag-chip active" : "tag-chip";
  button.type = "button";
  button.textContent = text;
  return button;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function stripOuterQuotes(value) {
  return String(value || "").trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "");
}

function findQuote(id) {
  return quotes.find((quote) => quote.id === id);
}

function now() {
  return new Date().toISOString();
}

function loadQuotes() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveQuotes() {
  localStorage.setItem(storageKey, JSON.stringify(quotes));
}
