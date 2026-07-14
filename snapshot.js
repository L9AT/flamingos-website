const form = document.querySelector("#jobForm");
const bulkForm = document.querySelector("#bulkForm");
const input = document.querySelector("#collectionUrl");
const bulkUrls = document.querySelector("#bulkUrls");
const chainMode = document.querySelector("#chainMode");
const minHoldings = document.querySelector("#minHoldings");
const airdropAmount = document.querySelector("#airdropAmount");
const excludeList = document.querySelector("#excludeList");
const startBtn = document.querySelector("#startBtn");
const bulkBtn = document.querySelector("#bulkBtn");
const statePill = document.querySelector("#statePill");
const stepText = document.querySelector("#stepText");
const countText = document.querySelector("#countText");
const contractText = document.querySelector("#contractText");
const progressBar = document.querySelector("#progressBar");
const resultBox = document.querySelector("#resultBox");
const downloadLink = document.querySelector("#downloadLink");
const manualBox = document.querySelector("#manualBox");
const manualLink = document.querySelector("#manualLink");
const logList = document.querySelector("#logList");
const clearBtn = document.querySelector("#clearBtn");
const historyList = document.querySelector("#historyList");
const allCsvBtn = document.querySelector("#allCsvBtn");
const allTxtBtn = document.querySelector("#allTxtBtn");
const allExportStatus = document.querySelector("#allExportStatus");
const snapshotIntro = document.querySelector("#snapshot-intro");
const snapshotEnter = document.querySelector("#snapshot-enter");

contractText?.addEventListener("click", copyContractAddress);
contractText?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    copyContractAddress();
  }
});

const API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "5177"
  ? `${location.protocol}//${location.hostname}:5177`
  : "";
const apiUrl = (path) => `${API_BASE}${path}`;

snapshotEnter?.addEventListener("click", () => {
  snapshotIntro.classList.add("is-leaving");
  document.body.classList.remove("snapshot-intro-open");
  window.setTimeout(() => {
    snapshotIntro.hidden = true;
    input.focus();
  }, 560);
});

let pollTimer = null;

async function copyContractAddress() {
  const contract = contractText.textContent.trim();
  if (!contract || contract === "-") return;

  try {
    await navigator.clipboard.writeText(contract);
  } catch {
    const copyField = document.createElement("textarea");
    copyField.value = contract;
    copyField.setAttribute("readonly", "");
    copyField.style.position = "fixed";
    copyField.style.opacity = "0";
    document.body.append(copyField);
    copyField.select();
    document.execCommand("copy");
    copyField.remove();
  }

  contractText.classList.add("copied");
  contractText.setAttribute("aria-label", "Contract address copied");
  window.setTimeout(() => {
    contractText.classList.remove("copied");
    contractText.setAttribute("aria-label", "Copy contract address");
  }, 1600);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const collectionUrl = input.value.trim();
  if (!collectionUrl) return;

  resetRun();
  setState("running", "Running");
  startBtn.disabled = true;

  try {
    const res = await fetch(apiUrl("/api/jobs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ collectionUrl, ...collectOptions() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Start failed");
    pollJob(data.id);
  } catch (err) {
    showError(err.message);
  }
});

bulkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const collectionUrls = bulkUrls.value.trim();
  if (!collectionUrls) return;

  resetRun();
  setState("running", "Running");
  startBtn.disabled = true;
  bulkBtn.disabled = true;

  try {
    const res = await fetch(apiUrl("/api/bulk-jobs"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ collectionUrls, ...collectOptions() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bulk start failed");
    pollJob(data.id);
  } catch (err) {
    showError(err.message);
  }
});

bulkUrls.addEventListener("paste", () => {
  setTimeout(() => {
    bulkUrls.value = normalizeBulkInput(bulkUrls.value);
    bulkUrls.selectionStart = bulkUrls.value.length;
    bulkUrls.selectionEnd = bulkUrls.value.length;
  }, 0);
});

bulkUrls.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    bulkForm.requestSubmit();
  }
});

clearBtn.addEventListener("click", () => {
  logList.replaceChildren();
});

allCsvBtn.addEventListener("click", () => exportAll("csv"));
allTxtBtn.addEventListener("click", () => exportAll("txt"));

async function pollJob(id) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const res = await fetch(apiUrl(`/api/jobs/${id}`));
    const job = await res.json();
    renderJob(job);
    if (job.status === "done" || job.status === "error") {
      clearInterval(pollTimer);
      startBtn.disabled = false;
      bulkBtn.disabled = false;
      loadHistory();
    }
  }, 1000);
}

function renderJob(job) {
  stepText.textContent = job.step || "-";
  contractText.textContent = job.contract || "-";
  progressBar.style.width = `${job.progress?.percent || 0}%`;
  const needsManual = (job.logs || []).some((entry) => entry.message.includes("Open Etherscan export"));
  if (job.exportUrl && job.status === "running" && needsManual) {
    manualLink.href = job.exportUrl;
    manualBox.classList.remove("hidden");
  } else if (!needsManual) {
    manualBox.classList.add("hidden");
  }
  logList.replaceChildren(...(job.logs || []).map((entry) => {
    const li = document.createElement("li");
    li.textContent = entry.message;
    return li;
  }));
  logList.scrollTop = logList.scrollHeight;

  if (job.status === "done") {
    setState("done", "Done");
    countText.textContent = job.result.count;
    downloadLink.href = apiUrl(job.result.url);
    downloadLink.download = job.result.fileName;
    downloadLink.textContent = `Download CSV (${job.result.count})`;
    resultBox.classList.remove("hidden");
  } else if (job.status === "error") {
    showError(job.error || "Error");
  }
}

function resetRun() {
  resultBox.classList.add("hidden");
  manualBox.classList.add("hidden");
  countText.textContent = "-";
  contractText.textContent = "-";
  stepText.textContent = "Starting";
  progressBar.style.width = "0%";
  logList.replaceChildren();
}

function showError(message) {
  setState("error", "Error");
  stepText.textContent = message;
  startBtn.disabled = false;
  bulkBtn.disabled = false;
}

function setState(kind, label) {
  statePill.className = `pill ${kind}`;
  statePill.textContent = label;
}

async function loadHistory() {
  const res = await fetch(apiUrl("/api/history"));
  const data = await res.json();
  historyList.replaceChildren(...data.files.map(renderFileRow));
}

function collectOptions() {
  return {
    chainMode: chainMode.value,
    minHoldings: minHoldings.value,
    airdropAmount: airdropAmount.value.trim(),
    excludeList: excludeList.value.trim(),
  };
}

function renderFileRow(file) {
  const row = document.createElement("div");
  row.className = "fileRow";

  const link = document.createElement("a");
  link.className = "fileLink";
  link.href = apiUrl(file.url);
  link.download = file.name;
  link.innerHTML = `<strong>${file.name}</strong><span>${formatBytes(file.size)}</span>`;

  const del = document.createElement("button");
  del.className = "deleteFile";
  del.type = "button";
  del.title = "Delete file";
  del.textContent = "Delete";
  del.addEventListener("click", async () => {
    del.disabled = true;
    try {
      const res = await fetch(apiUrl(`/api/files/${encodeURIComponent(file.name)}`), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      allExportStatus.textContent = "Deleted";
      await loadHistory();
    } catch (err) {
      del.disabled = false;
      allExportStatus.textContent = err.message;
    }
  });

  row.append(link, del);
  return row;
}

function normalizeBulkInput(value) {
  const matches = value.match(/https?:\/\/[^\s,;]+|0x[a-fA-F0-9]{40}/g) || [];
  const seen = new Set();
  const lines = [];
  for (const item of matches) {
    const clean = item.trim().replace(/[),.;]+$/, "");
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(clean);
    }
  }
  return lines.join("\n");
}

async function exportAll(format) {
  allCsvBtn.disabled = true;
  allTxtBtn.disabled = true;
  allExportStatus.textContent = "Combining...";

  try {
    const res = await fetch(apiUrl("/api/export-all"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Export failed");

    allExportStatus.textContent = `${data.count} wallets`;
    const link = document.createElement("a");
    link.href = apiUrl(data.url);
    link.download = data.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    await loadHistory();
  } catch (err) {
    allExportStatus.textContent = err.message;
  } finally {
    allCsvBtn.disabled = false;
    allTxtBtn.disabled = false;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

loadHistory();
