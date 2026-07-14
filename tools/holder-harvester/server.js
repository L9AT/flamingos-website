const express = require("express");
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 5177;
const root = __dirname;
const outputDir = path.join(root, "outputs");
const jobs = new Map();

fs.mkdirSync(outputDir, { recursive: true });

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));
app.use("/outputs", express.static(outputDir));

app.post("/api/jobs", (req, res) => {
  const input = String(req.body?.collectionUrl || "").trim();
  if (!input) return res.status(400).json({ error: "Collection link khawi." });
  const options = getOptions(req.body);

  const id = crypto.randomUUID();
  const job = {
    id,
    input,
    options,
    status: "running",
    step: "Queued",
    progress: { current: 0, total: 1, percent: 0 },
    logs: [],
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  runJob(job).catch((err) => fail(job, err));
  res.json({ id });
});

app.post("/api/bulk-jobs", (req, res) => {
  const inputs = String(req.body?.collectionUrls || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!inputs.length) return res.status(400).json({ error: "List khawya." });
  if (inputs.length > 100) return res.status(400).json({ error: "Max 100 links f marra." });
  const options = getOptions(req.body);

  const id = crypto.randomUUID();
  const job = {
    id,
    input: `${inputs.length} collections`,
    inputs,
    options,
    status: "running",
    step: "Queued",
    progress: { current: 0, total: inputs.length, percent: 0 },
    logs: [],
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  runBulkJob(job).catch((err) => fail(job, err));
  res.json({ id });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job ma kaynch." });
  res.json(job);
});

app.get("/api/history", (_req, res) => {
  const files = fs
    .readdirSync(outputDir)
    .filter((name) => name.endsWith(".csv") || name.endsWith(".txt"))
    .map((name) => {
      const stat = fs.statSync(path.join(outputDir, name));
      return {
        name,
        url: `/outputs/${name}`,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, 12);
  res.json({ files });
});

app.delete("/api/files/:name", (req, res) => {
  const name = path.basename(String(req.params.name || ""));
  if (!/^[a-zA-Z0-9._-]+\.(csv|txt)$/.test(name)) {
    return res.status(400).json({ error: "Invalid file name." });
  }

  const filePath = path.join(outputDir, name);
  if (!filePath.startsWith(outputDir + path.sep)) {
    return res.status(400).json({ error: "Invalid file path." });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File ma kaynch." });
  }

  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

app.post("/api/export-all", (req, res) => {
  const format = String(req.body?.format || "csv").toLowerCase() === "txt" ? "txt" : "csv";
  const addresses = collectOutputAddresses();
  if (!addresses.length) return res.status(400).json({ error: "No wallet CSVs found yet." });

  const fileName = `all_wallet_addresses_${stamp()}.${format}`;
  const outputPath = path.join(outputDir, fileName);
  const body =
    format === "txt"
      ? addresses.join("\n") + "\n"
      : ["wallet_address", ...addresses].map(csvLine).join("\n") + "\n";

  fs.writeFileSync(outputPath, body);
  res.json({
    count: addresses.length,
    fileName,
    url: `/outputs/${fileName}`,
  });
});

app.listen(port, () => {
  console.log(`Holder harvester running at http://localhost:${port}`);
});

async function runJob(job) {
  setProgress(job, 0, 1);
  note(job, "Resolving collection contract");
  const resolved = withSourceOverride(await resolveCollection(job.input), job.options);
  const contract = resolved.contract;
  job.contract = contract;
  job.source = resolved.source;
  note(job, `Contract: ${contract}`);

  const exportUrl = `https://etherscan.io/exportData?type=tokenholders-nft&contract=${contract}&decimal=0`;
  job.exportUrl = exportUrl;
  let addresses;
  try {
    addresses = await fetchOwnersForInput(job, job.input, contract, resolved.source);
  } catch (err) {
    if (resolved.source === "robinhood") throw err;
    note(job, `API fallback needed: ${err.message}`);
    note(job, "Open Etherscan export link manually, then click Download");
    const downloadedPath = await waitForManualDownload(job, contract, Date.now());
    addresses = addressesFromEtherscanCsv(downloadedPath);
  }
  const holders = applyHolderOptions(addresses, job.options);

  const slug = outputBaseName(job.input, contract, resolved.source, job.options);
  const fileName = `${slug}_wallet_addresses_${stamp()}.csv`;
  const outputPath = path.join(outputDir, fileName);
  writeHolderCsv(outputPath, holders, job.options);

  job.status = "done";
  job.step = "Done";
  setProgress(job, 1, 1);
  job.result = {
    contract,
    count: holders.length,
    fileName,
    url: `/outputs/${fileName}`,
  };
  note(job, `Saved ${holders.length} wallet addresses`);
}

async function runBulkJob(job) {
  const allAddresses = new Set();
  const files = [];
  let success = 0;
  let failed = 0;

  for (let index = 0; index < job.inputs.length; index++) {
    const input = job.inputs[index];
    setProgress(job, index, job.inputs.length);
    note(job, `Scanning ${index + 1}/${job.inputs.length}: ${input}`);

    try {
      const resolved = withSourceOverride(await resolveCollection(input), job.options);
      const contract = resolved.contract;
      note(job, `Contract ${index + 1}: ${contract}`);
      const addresses = await fetchOwnersForInput(job, input, contract, resolved.source);
      const holders = applyHolderOptions(addresses, job.options);
      for (const holder of holders) allAddresses.add(holder.address);

      const slug = outputBaseName(input, contract, resolved.source, job.options, index + 1);
      const fileName = `${slug}_wallet_addresses_${stamp()}.csv`;
      const outputPath = path.join(outputDir, fileName);
      writeHolderCsv(outputPath, holders, job.options);
      files.push({ input, contract, count: holders.length, fileName, url: `/outputs/${fileName}` });
      success += 1;
      note(job, `Saved ${holders.length} wallets for ${slug}`);
    } catch (err) {
      failed += 1;
      note(job, `Failed ${input}: ${err.message}`);
    }
  }

  if (!allAddresses.size) throw new Error("No wallets fetched from the list.");

  const combined = [...allAddresses].sort();
  const combinedFileName = `bulk_all_wallet_addresses_${stamp()}.csv`;
  fs.writeFileSync(
    path.join(outputDir, combinedFileName),
    holderCsvBody(combined.map((address) => ({ address, balance: 1 })), job.options),
  );

  job.status = "done";
  job.step = "Done";
  setProgress(job, job.inputs.length, job.inputs.length);
  job.result = {
    count: combined.length,
    success,
    failed,
    fileName: combinedFileName,
    url: `/outputs/${combinedFileName}`,
    files,
  };
  note(job, `Bulk done: ${combined.length} unique wallets, ${success} ok, ${failed} failed`);
}

async function fetchOwnersForInput(job, input, contract, resolvedSource) {
  const source = resolvedSource || detectSource(input);
  if (source === "robinhood") {
    return fetchOwnersFromBlockscout(job, contract);
  }

  try {
    return await fetchOwnersFromApi(job, contract);
  } catch (err) {
    if (source === "ethereum") {
      note(job, `Primary owner API failed, trying Ethereum Blockscout: ${err.message}`);
      return fetchOwnersFromBlockscoutBase(job, contract, "https://eth.blockscout.com", "Ethereum");
    }
    note(job, `Ethereum API did not work, trying Robinhood Blockscout`);
    return fetchOwnersFromBlockscout(job, contract);
  }
}

function detectSource(input) {
  const value = String(input || "").toLowerCase();
  if (value.includes("robinhoodchain.blockscout.com")) return "robinhood";
  if (value.includes("opensea.io") || value.includes("etherscan.io")) return "ethereum";
  return "auto";
}

async function fetchOwnersFromApi(job, contract) {
  const limit = 200;
  let offset = 0;
  const owners = new Map();

  while (true) {
    note(job, `Fetching owners ${offset + 1}-${offset + limit}`);
    const url = new URL("https://api-ethereum.spaace.io/owners/v2");
    url.searchParams.set("collection", contract);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const json = await fetchJson(url);
    const batch = Array.isArray(json.owners) ? json.owners : [];

    for (const owner of batch) {
      const address = String(owner.address || "").toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(address)) {
        owners.set(address, Number(owner.ownership?.tokenCount || 0));
      }
    }

    if (batch.length < limit) break;
    offset += limit;
    if (offset > 10000) break;
  }

  const addresses = [...owners.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([address, balance]) => ({ address, balance }));

  if (!addresses.length) throw new Error("API returned 0 owners.");
  note(job, `Fetched ${addresses.length} owners automatically`);
  return addresses;
}

async function fetchOwnersFromBlockscout(job, contract) {
  try {
    return await fetchOwnersFromBlockscoutCsv(job, contract);
  } catch (err) {
    note(job, `Blockscout CSV failed, using paged API: ${err.message}`);
  }

  const base = "https://robinhoodchain.blockscout.com";
  const owners = new Map();
  let url = new URL(`/api/v2/tokens/${contract}/holders`, base);
  let page = 1;

  while (url) {
    note(job, `Robinhood holders page ${page}`);
    const json = await fetchJsonWithRetry(url, 6);
    const batch = Array.isArray(json.items) ? json.items : [];

    for (const item of batch) {
      const address = String(item.address?.hash || item.address || "").toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(address)) {
        owners.set(address, Number(item.value || 0));
      }
    }

    if (!json.next_page_params || !batch.length) break;
    url = new URL(`/api/v2/tokens/${contract}/holders`, base);
    for (const [key, value] of Object.entries(json.next_page_params)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    page += 1;
    if (page > 3000) throw new Error("Too many Blockscout pages.");
    await delay(120);
  }

  const addresses = [...owners.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([address, balance]) => ({ address, balance }));

  if (!addresses.length) throw new Error("Robinhood Blockscout returned 0 owners.");
  note(job, `Fetched ${addresses.length} Robinhood holders automatically`);
  return addresses;
}

async function fetchOwnersFromBlockscoutBase(job, contract, base, label) {
  const owners = new Map();
  let url = new URL(`/api/v2/tokens/${contract}/holders`, base);
  let page = 1;

  while (url) {
    note(job, `${label} holders page ${page}`);
    const json = await fetchJsonWithRetry(url, 6);
    const batch = Array.isArray(json.items) ? json.items : [];

    for (const item of batch) {
      const address = String(item.address?.hash || item.address || "").toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(address)) {
        owners.set(address, Number(item.value || 0));
      }
    }

    if (!json.next_page_params || !batch.length) break;
    url = new URL(`/api/v2/tokens/${contract}/holders`, base);
    for (const [key, value] of Object.entries(json.next_page_params)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    page += 1;
    if (page > 3000) throw new Error(`Too many ${label} Blockscout pages.`);
    await delay(120);
  }

  const addresses = [...owners.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([address, balance]) => ({ address, balance }));

  if (!addresses.length) throw new Error(`${label} Blockscout returned 0 owners.`);
  note(job, `Fetched ${addresses.length} ${label} holders automatically`);
  return addresses;
}

async function fetchOwnersFromBlockscoutCsv(job, contract) {
  note(job, "Downloading Robinhood holders CSV");
  const url = new URL(`https://robinhoodchain.blockscout.com/api/v2/tokens/${contract}/holders/csv`);
  url.searchParams.set("from_period", "null");
  url.searchParams.set("to_period", "null");

  const res = await fetch(url, {
    headers: {
      accept: "*/*",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Blockscout CSV`);

  const rows = parseCsv(await res.text());
  const addressKey = Object.keys(rows[0] || {}).find((key) => /holder.?address|address/i.test(key));
  if (!addressKey) throw new Error("CSV missing HolderAddress column.");

  const addresses = rows
    .map((row) => ({
      address: String(row[addressKey] || "").trim().toLowerCase(),
      balance: Number(row.Balance || row.balance || row.Value || row.value || 0) || 1,
    }))
    .filter((holder, index, arr) =>
      /^0x[a-f0-9]{40}$/.test(holder.address) &&
      arr.findIndex((item) => item.address === holder.address) === index
    );

  if (!addresses.length) throw new Error("Blockscout CSV returned 0 owners.");
  note(job, `Fetched ${addresses.length} Robinhood holders from CSV`);
  return addresses;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from owner API`);
  return res.json();
}

async function fetchJsonWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      await delay(500 * attempt * attempt);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addressesFromEtherscanCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parseCsv(raw);
  const addressKey = Object.keys(rows[0] || {}).find((key) => /holder.?address/i.test(key));
  if (!addressKey) throw new Error("CSV fih ma l9itch HolderAddress column.");

  return rows
    .map((row) => ({
      address: String(row[addressKey] || "").trim().toLowerCase(),
      balance: Number(row.Quantity || row.quantity || row.Balance || row.balance || 0) || 1,
    }))
    .filter((holder, index, arr) =>
      /^0x[a-f0-9]{40}$/.test(holder.address) &&
      arr.findIndex((item) => item.address === holder.address) === index
    );
}

function collectOutputAddresses() {
  const addresses = new Set();
  for (const name of fs.readdirSync(outputDir)) {
    const lower = name.toLowerCase();
    if (!lower.endsWith(".csv")) continue;
    if (lower.includes("all_wallet_addresses_") || lower.includes("random_")) continue;

    const filePath = path.join(outputDir, name);
    const raw = fs.readFileSync(filePath, "utf8");
    const rows = parseCsv(raw);
    const keys = Object.keys(rows[0] || {});
    const addressKey = keys.find((key) => /wallet.?address/i.test(key)) ||
      keys.find((key) => /holder.?address/i.test(key));
    if (!addressKey) continue;

    for (const row of rows) {
      const address = String(row[addressKey] || "").trim().toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(address)) addresses.add(address);
    }
  }
  return [...addresses].sort();
}

function getOptions(body = {}) {
  const minHoldings = Math.max(1, Number(body.minHoldings || 1));
  const chainMode = ["auto", "ethereum", "robinhood"].includes(String(body.chainMode || "").toLowerCase())
    ? String(body.chainMode || "auto").toLowerCase()
    : "auto";
  return {
    minHoldings,
    chainMode,
    airdropAmount: String(body.airdropAmount || "").trim(),
    excludeList: parseAddressList(String(body.excludeList || "")),
  };
}

function parseAddressList(value) {
  return [...new Set((value.match(/0x[a-fA-F0-9]{40}/g) || []).map((address) => address.toLowerCase()))];
}

function withSourceOverride(resolved, options = {}) {
  if (options.chainMode && options.chainMode !== "auto") {
    return { ...resolved, source: options.chainMode };
  }
  return resolved;
}

function normalizeHolders(items) {
  const holders = new Map();
  for (const item of items) {
    const address = String(item?.address || item || "").trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) continue;
    const balance = Number(item?.balance || 1) || 1;
    holders.set(address, Math.max(holders.get(address) || 0, balance));
  }
  return [...holders.entries()].map(([address, balance]) => ({ address, balance }));
}

function applyHolderOptions(items, options = {}) {
  const exclude = new Set(options.excludeList || []);
  return normalizeHolders(items)
    .filter((holder) => holder.balance >= (options.minHoldings || 1))
    .filter((holder) => !exclude.has(holder.address))
    .sort((a, b) => b.balance - a.balance || a.address.localeCompare(b.address));
}

function holderCsvBody(holders, options = {}) {
  if (options.airdropAmount) {
    return ["wallet_address,amount", ...holders.map((holder) => `${csvLine(holder.address)},${csvLine(options.airdropAmount)}`)].join("\n") + "\n";
  }
  return ["wallet_address", ...holders.map((holder) => csvLine(holder.address))].join("\n") + "\n";
}

function writeHolderCsv(filePath, holders, options = {}) {
  fs.writeFileSync(filePath, holderCsvBody(holders, options));
}

function outputBaseName(input, contract, source, options = {}, index = null) {
  const suffix = index ? `_${String(index).padStart(2, "0")}` : "";
  return `${fileSlug(input, contract, source)}${suffix}`;
}

async function resolveContract(input) {
  return (await resolveCollection(input)).contract;
}

async function resolveCollection(input) {
  const direct = input.match(/0x[a-fA-F0-9]{40}/)?.[0];
  if (direct) return { contract: direct.toLowerCase(), source: detectSource(input) };

  const html = await fetchText(input);
  const addressFields = [...html.matchAll(/"address"\s*:\s*"(0x[a-fA-F0-9]{40})"/g)];
  const contractHit = addressFields.find((match) => {
    const start = Math.max(0, match.index - 700);
    const end = Math.min(html.length, match.index + 900);
    const nearby = html.slice(start, end);
    return /"standard"\s*:\s*"ERC(721|1155)"/i.test(nearby) && /"chain"\s*:\s*\{/i.test(nearby);
  });
  if (contractHit) {
    const start = Math.max(0, contractHit.index - 900);
    const end = Math.min(html.length, contractHit.index + 1200);
    const nearby = html.slice(start, end);
    const chain = nearby.match(/"chain"\s*:\s*\{[^}]*"identifier"\s*:\s*"([^"]+)"/i)?.[1]?.toLowerCase();
    return {
      contract: contractHit[1].toLowerCase(),
      source: chain === "robinhood" ? "robinhood" : detectSource(input),
    };
  }

  const etherscan = html.match(/etherscan\.io\/(?:address|token)\/(0x[a-fA-F0-9]{40})/i);
  if (etherscan) return { contract: etherscan[1].toLowerCase(), source: "ethereum" };

  const robinhood = html.match(/robinhoodchain\.blockscout\.com\/(?:address|token)\/(0x[a-fA-F0-9]{40})/i);
  if (robinhood) return { contract: robinhood[1].toLowerCase(), source: "robinhood" };

  throw new Error("Ma qdرتch nلقا contract. Jreb 7et contract address direct.");
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`OpenSea fetch failed: HTTP ${res.status}`);
  return res.text();
}

async function downloadFromEtherscan(job, url) {
  const executablePath = findChromium();
  const downloadDir = path.join(root, "work", "downloads");
  const profileDir = path.join(root, "work", "browser-profile");
  fs.mkdirSync(downloadDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
  const startedAt = Date.now();

  const context = await chromium.launchPersistentContext(profileDir, {
    acceptDownloads: true,
    executablePath,
    downloadsPath: downloadDir,
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    note(job, "Waiting for Etherscan download button");

    const button = page.locator('input[type="submit"][value="Download"]');
    try {
      await button.waitFor({ state: "visible", timeout: 35000 });
    } catch (_err) {
      note(job, "Etherscan verification stuck. Download the CSV manually; I am watching Downloads.");
      return waitForManualDownload(job, contractFromExportUrl(url), startedAt);
    }

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 120000 }),
      button.click(),
    ]);
    const target = path.join(downloadDir, download.suggestedFilename());
    await download.saveAs(target);
    note(job, "Downloaded Etherscan CSV");
    return target;
  } finally {
    await context.close().catch(() => {});
  }
}

function findChromium() {
  const direct = [
    path.join(process.env.ProgramFiles || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter((file) => file && fs.existsSync(file));
  if (direct[0]) return direct[0];

  const base = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  const candidates = [];
  if (fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      const chrome = path.join(base, dir, "chrome-win", "chrome.exe");
      if (/^chromium-\d+$/.test(dir) && fs.existsSync(chrome)) candidates.push(chrome);
    }
  }
  candidates.sort().reverse();
  if (candidates[0]) return candidates[0];
  throw new Error("Playwright Chromium ma tl9ach f had machine.");
}

async function waitForManualDownload(job, contract, startedAt) {
  const folders = [
    path.join(process.env.USERPROFILE || "", "Downloads"),
    path.join(root, "work", "downloads"),
  ];
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const file = findDownloadedCsv(folders, contract, startedAt);
    if (file) {
      note(job, `Found downloaded CSV: ${path.basename(file)}`);
      return file;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
  throw new Error("Ma l9itch CSV f Downloads. Download Etherscan CSV manually w 3awed jreb.");
}

function findDownloadedCsv(folders, contract, startedAt) {
  const normalizedContract = contract.toLowerCase();
  const candidates = [];
  for (const folder of folders) {
    if (!folder || !fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder)) {
      if (!name.toLowerCase().endsWith(".csv")) continue;
      const file = path.join(folder, name);
      const stat = fs.statSync(file);
      if (stat.mtimeMs + 5000 < startedAt || stat.size < 20) continue;
      const lower = name.toLowerCase();
      const likelyName =
        lower.includes("tokenholders") ||
        lower.includes("holder") ||
        lower.includes(normalizedContract);
      if (!likelyName) continue;
      try {
        const head = fs.readFileSync(file, "utf8").slice(0, 500).toLowerCase();
        if (head.includes("holderaddress") || head.includes("holder address")) {
          candidates.push({ file, mtimeMs: stat.mtimeMs });
        }
      } catch (_err) {}
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.file;
}

function contractFromExportUrl(url) {
  return new URL(url).searchParams.get("contract") || "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((key, index) => [key, values[index] || ""])));
}

function csvLine(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function slugFromInput(input) {
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.indexOf("collection");
    return cleanSlug(index >= 0 ? parts[index + 1] : parts.at(-1));
  } catch (_err) {
    return cleanSlug(input);
  }
}

function fileSlug(input, contract, source = detectSource(input)) {
  const prefix = source === "robinhood" ? "robinhood_" : "";
  return `${prefix}${slugFromInput(input) || contract.slice(2, 10)}`;
}

function cleanSlug(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
}

function note(job, message) {
  job.step = message;
  job.logs.push({ at: new Date().toISOString(), message });
}

function setProgress(job, current, total) {
  const safeTotal = Math.max(1, Number(total || 1));
  const safeCurrent = Math.max(0, Math.min(safeTotal, Number(current || 0)));
  job.progress = {
    current: safeCurrent,
    total: safeTotal,
    percent: Math.round((safeCurrent / safeTotal) * 100),
  };
}

function fail(job, err) {
  job.status = "error";
  job.step = "Error";
  job.error = err?.message || String(err);
  note(job, job.error);
}
