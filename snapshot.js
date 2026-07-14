const form = document.querySelector("#jobForm");
const bulkForm = document.querySelector("#bulkForm");
const input = document.querySelector("#collectionUrl");
const bulkUrls = document.querySelector("#bulkUrls");
const chainMode = document.querySelector("#chainMode");
const minHoldings = document.querySelector("#minHoldings");
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

const IS_LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== "5177";
const API_BASE = IS_LOCAL ? `${location.protocol}//${location.hostname}:5177` : "";
const REMOTE_HISTORY_KEY = "flamingos-snapshot-history-v1";
const apiUrl = (path) => `${API_BASE}${path}`;
let pollTimer = null;

contractText?.addEventListener("click", copyContractAddress);
contractText?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    copyContractAddress();
  }
});

snapshotEnter?.addEventListener("click", () => {
  snapshotIntro.classList.add("is-leaving");
  document.body.classList.remove("snapshot-intro-open");
  window.setTimeout(() => {
    snapshotIntro.hidden = true;
    input.focus();
  }, 560);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const collectionUrl = input.value.trim();
  if (!collectionUrl) return;

  beginRun();
  try {
    if (IS_LOCAL) {
      const res = await fetch(apiUrl("/api/jobs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectionUrl, ...collectOptions() }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Start failed");
      pollJob(data.id);
    } else {
      await runOnlineSnapshot({ collectionUrl });
    }
  } catch (err) {
    showError(err.message);
  }
});

bulkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const collectionUrls = normalizeBulkInput(bulkUrls.value.trim());
  if (!collectionUrls) return;

  beginRun(true);
  try {
    if (IS_LOCAL) {
      const res = await fetch(apiUrl("/api/bulk-jobs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ collectionUrls, ...collectOptions() }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Bulk start failed");
      pollJob(data.id);
    } else {
      await runOnlineSnapshot({ collectionUrls });
    }
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

clearBtn.addEventListener("click", () => logList.replaceChildren());
allCsvBtn.addEventListener("click", () => exportAll("csv"));
allTxtBtn.addEventListener("click", () => exportAll("txt"));

async function runOnlineSnapshot(payload) {
  stepText.textContent = "Scanning on-chain holders";
  progressBar.style.width = "35%";
  const res = await fetch("/api/snapshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, ...collectOptions() }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data.error || `Snapshot failed (HTTP ${res.status})`);

  contractText.textContent = data.contract || "-";
  countText.textContent = data.count;
  progressBar.style.width = "100%";
  renderLogs(data.logs || []);
  prepareDownload(data.csv, data.fileName, data.count);
  saveRemoteSnapshot(data);
  setState("done", "Done");
  stepText.textContent = "Snapshot ready";
  resultBox.classList.remove("hidden");
  finishRun();
  await loadHistory();
}

async function pollJob(id) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(apiUrl(`/api/jobs/${id}`));
      const job = await readJson(res);
      if (!res.ok) throw new Error(job.error || "Snapshot status failed");
      renderJob(job);
      if (job.status === "done" || job.status === "error") {
        clearInterval(pollTimer);
        finishRun();
        loadHistory();
      }
    } catch (error) {
      clearInterval(pollTimer);
      showError(error.message);
    }
  }, 1000);
}

function renderJob(job) {
  stepText.textContent = job.step || "-";
  contractText.textContent = job.contract || "-";
  progressBar.style.width = `${job.progress?.percent || 0}%`;
  const logs = (job.logs || []).map((entry) => entry.message || entry);
  const needsManual = logs.some((message) => message.includes("Open Etherscan export"));
  if (job.exportUrl && job.status === "running" && needsManual) {
    manualLink.href = job.exportUrl;
    manualBox.classList.remove("hidden");
  } else if (!needsManual) {
    manualBox.classList.add("hidden");
  }
  renderLogs(logs);

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

function beginRun(bulk = false) {
  resetRun();
  setState("running", "Running");
  startBtn.disabled = true;
  bulkBtn.disabled = bulk;
}

function finishRun() {
  startBtn.disabled = false;
  bulkBtn.disabled = false;
}

function resetRun() {
  resultBox.classList.add("hidden");
  manualBox.classList.add("hidden");
  countText.textContent = "-";
  contractText.textContent = "-";
  stepText.textContent = "Starting";
  progressBar.style.width = "0%";
  logList.replaceChildren();
  if (downloadLink.dataset.objectUrl) {
    URL.revokeObjectURL(downloadLink.dataset.objectUrl);
    delete downloadLink.dataset.objectUrl;
  }
}

function showError(message) {
  setState("error", "Error");
  stepText.textContent = message;
  progressBar.style.width = "0%";
  finishRun();
}

function setState(kind, label) {
  statePill.className = `pill ${kind}`;
  statePill.textContent = label;
}

function renderLogs(logs) {
  logList.replaceChildren(...logs.map((message) => {
    const li = document.createElement("li");
    li.textContent = message;
    return li;
  }));
  logList.scrollTop = logList.scrollHeight;
}

async function loadHistory() {
  if (!IS_LOCAL) {
    historyList.replaceChildren(...readRemoteHistory().map(renderFileRow));
    return;
  }
  try {
    const res = await fetch(apiUrl("/api/history"));
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || "History failed");
    historyList.replaceChildren(...data.files.map(renderFileRow));
  } catch (error) {
    allExportStatus.textContent = error.message;
  }
}

function collectOptions() {
  return {
    chainMode: chainMode.value,
    minHoldings: minHoldings.value,
    excludeList: excludeList.value.trim(),
  };
}

function prepareDownload(csv, fileName, count) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  downloadLink.href = url;
  downloadLink.dataset.objectUrl = url;
  downloadLink.download = fileName;
  downloadLink.textContent = `Download CSV (${count})`;
}

function renderFileRow(file) {
  const row = document.createElement("div");
  row.className = "fileRow";
  const link = document.createElement("a");
  link.className = "fileLink";
  link.href = file.csv
    ? URL.createObjectURL(new Blob([file.csv], { type: "text/csv;charset=utf-8" }))
    : apiUrl(file.url);
  link.download = file.name;
  link.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${formatBytes(file.size)}</span>`;

  const del = document.createElement("button");
  del.className = "deleteFile";
  del.type = "button";
  del.title = "Delete file";
  del.textContent = "Delete";
  del.addEventListener("click", async () => {
    del.disabled = true;
    try {
      if (file.csv) {
        writeRemoteHistory(readRemoteHistory().filter((item) => item.id !== file.id));
      } else {
        const res = await fetch(apiUrl(`/api/files/${encodeURIComponent(file.name)}`), { method: "DELETE" });
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || "Delete failed");
      }
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

function saveRemoteSnapshot(data) {
  const history = readRemoteHistory();
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: data.fileName,
    csv: data.csv,
    size: new Blob([data.csv]).size,
    modifiedAt: new Date().toISOString(),
  });
  writeRemoteHistory(history.slice(0, 8));
}

function readRemoteHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(REMOTE_HISTORY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeRemoteHistory(history) {
  try {
    localStorage.setItem(REMOTE_HISTORY_KEY, JSON.stringify(history));
  } catch {
    allExportStatus.textContent = "Browser storage is full";
  }
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
    if (!IS_LOCAL) {
      const addresses = new Set();
      for (const file of readRemoteHistory()) {
        for (const match of file.csv.match(/0x[a-fA-F0-9]{40}/g) || []) addresses.add(match.toLowerCase());
      }
      if (!addresses.size) throw new Error("No snapshots found yet");
      const values = [...addresses].sort();
      const body = format === "txt" ? `${values.join("\n")}\n` : `wallet_address\n${values.join("\n")}\n`;
      triggerDownload(body, `all_wallet_addresses.${format}`, format === "txt" ? "text/plain" : "text/csv");
      allExportStatus.textContent = `${values.length} wallets`;
      return;
    }

    const res = await fetch(apiUrl("/api/export-all"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ format }),
    });
    const data = await readJson(res);
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

function triggerDownload(body, name, type) {
  const url = URL.createObjectURL(new Blob([body], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyContractAddress() {
  const contract = contractText.textContent.trim();
  if (!contract || contract === "-" || !/^0x[a-fA-F0-9]{40}$/.test(contract)) return;
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

async function readJson(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error(`Server returned HTTP ${response.status}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

loadHistory();
