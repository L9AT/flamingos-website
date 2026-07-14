const MAX_COLLECTIONS = 25;
const MAX_HOLDERS = 10000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const inputs = getInputs(req.body || {});
    if (!inputs.length) return res.status(400).json({ error: "Add a collection link or contract." });
    if (inputs.length > MAX_COLLECTIONS) {
      return res.status(400).json({ error: `Maximum ${MAX_COLLECTIONS} collections per scan.` });
    }

    const options = getOptions(req.body || {});
    const combined = new Map();
    const collections = [];
    const logs = [];

    for (const input of inputs) {
      logs.push(`Resolving ${input}`);
      const resolved = await resolveCollection(input, options.chainMode);
      logs.push(`Contract: ${resolved.contract}`);
      const holders = applyHolderOptions(
        await fetchOwners(resolved.contract, resolved.source, logs),
        options
      );

      for (const holder of holders) {
        combined.set(holder.address, Math.max(combined.get(holder.address) || 0, holder.balance));
      }

      collections.push({
        input,
        contract: resolved.contract,
        source: resolved.source,
        count: holders.length,
      });
      logs.push(`Found ${holders.length} eligible holders`);
    }

    const holders = [...combined.entries()]
      .map(([address, balance]) => ({ address, balance }))
      .sort((a, b) => b.balance - a.balance || a.address.localeCompare(b.address));
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fileName = `${collections.length > 1 ? "bulk" : "snapshot"}_wallet_addresses_${stamp}.csv`;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      contract: collections.length === 1 ? collections[0].contract : `${collections.length} collections`,
      count: holders.length,
      fileName,
      csv: holderCsvBody(holders, options),
      collections,
      logs,
    });
  } catch (error) {
    console.error("Snapshot error", error);
    return res.status(500).json({ error: cleanError(error) });
  }
};

module.exports.config = { maxDuration: 60 };

function getInputs(body) {
  const raw = body.collectionUrls || body.collectionUrl || "";
  const values = Array.isArray(raw) ? raw : String(raw).split(/\r?\n/);
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function getOptions(body) {
  const chainMode = ["auto", "ethereum", "robinhood"].includes(String(body.chainMode || "").toLowerCase())
    ? String(body.chainMode || "auto").toLowerCase()
    : "auto";
  return {
    chainMode,
    minHoldings: Math.max(1, Number(body.minHoldings || 1)),
    excludeList: [...new Set((String(body.excludeList || "").match(/0x[a-fA-F0-9]{40}/g) || [])
      .map((address) => address.toLowerCase()))],
  };
}

async function resolveCollection(input, chainMode) {
  const direct = String(input).match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
  if (direct) return { contract: direct, source: chainMode === "auto" ? detectSource(input) : chainMode };

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Use an OpenSea collection link or a contract address.");
  }

  if (!/(^|\.)opensea\.io$/i.test(url.hostname)) {
    throw new Error("For links, use OpenSea. Block explorer scans need a contract address.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const collectionIndex = parts.findIndex((part) => part.toLowerCase() === "collection");
  const slug = collectionIndex >= 0 ? parts[collectionIndex + 1] : "";
  if (!slug || !/^[a-zA-Z0-9._-]+$/.test(slug)) throw new Error("Invalid OpenSea collection link.");

  const response = await fetchWithTimeout(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}`, {
    headers: jsonHeaders(),
  });
  if (!response.ok) throw new Error(`OpenSea returned HTTP ${response.status}. Try the contract address.`);
  const data = await response.json();
  const contracts = Array.isArray(data.contracts) ? data.contracts : data.contracts ? [data.contracts] : [];
  const contract = contracts.find((item) => /^0x[a-fA-F0-9]{40}$/.test(String(item.address || "")));
  if (!contract) throw new Error("OpenSea did not return a collection contract. Try the contract address.");

  const detected = String(contract.chain || "").toLowerCase() === "robinhood" ? "robinhood" : "ethereum";
  return { contract: contract.address.toLowerCase(), source: chainMode === "auto" ? detected : chainMode };
}

function detectSource(input) {
  const value = String(input || "").toLowerCase();
  return value.includes("robinhood") ? "robinhood" : "ethereum";
}

async function fetchOwners(contract, source, logs) {
  if (source === "robinhood") return fetchRobinhoodOwners(contract, logs);
  try {
    return await fetchEthereumOwners(contract, logs);
  } catch (error) {
    logs.push(`Primary owner API unavailable (${error.message}); trying Ethereum Blockscout`);
    return fetchBlockscoutOwners(contract, "https://eth.blockscout.com", "Ethereum", logs);
  }
}

async function fetchRobinhoodOwners(contract, logs) {
  return fetchBlockscoutOwners(contract, "https://robinhoodchain.blockscout.com", "Robinhood Chain", logs);
}

async function fetchBlockscoutOwners(contract, base, label, logs) {
  logs.push(`Downloading ${label} holder snapshot`);
  const csvUrl = new URL(`/api/v2/tokens/${contract}/holders/csv`, base);
  csvUrl.searchParams.set("from_period", "null");
  csvUrl.searchParams.set("to_period", "null");

  try {
    const response = await fetchWithTimeout(csvUrl, { headers: textHeaders() }, 30000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseCsv(await response.text());
    const addressKey = Object.keys(rows[0] || {}).find((key) => /holder.?address|address/i.test(key));
    if (!addressKey) throw new Error("Holder address column missing");
    const holders = normalizeHolders(rows.map((row) => ({
      address: row[addressKey],
      balance: row.Balance || row.balance || row.Value || row.value || 1,
    })));
    if (holders.length) return holders;
  } catch (error) {
    logs.push(`CSV fallback: ${error.message}`);
  }

  const owners = new Map();
  let url = new URL(`/api/v2/tokens/${contract}/holders`, base);
  let page = 1;
  while (url && owners.size < MAX_HOLDERS) {
    logs.push(`Reading holder page ${page}`);
    const response = await fetchWithTimeout(url, { headers: jsonHeaders() }, 20000);
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      const address = String(item.address?.hash || item.address || "").toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(address)) owners.set(address, Number(item.value || 1) || 1);
    }
    if (!items.length || !data.next_page_params) break;
    url = new URL(`/api/v2/tokens/${contract}/holders`, base);
    for (const [key, value] of Object.entries(data.next_page_params)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    page += 1;
    if (page > 500) throw new Error("This collection is too large for the online scanner.");
  }
  const holders = [...owners.entries()].map(([address, balance]) => ({ address, balance }));
  if (!holders.length) throw new Error(`${label} returned no holders.`);
  return holders;
}

async function fetchEthereumOwners(contract, logs) {
  const owners = new Map();
  const limit = 200;
  for (let offset = 0; offset <= MAX_HOLDERS; offset += limit) {
    logs.push(`Reading owners ${offset + 1}-${offset + limit}`);
    const url = new URL("https://api-ethereum.spaace.io/owners/v2");
    url.searchParams.set("collection", contract);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const response = await fetchWithTimeout(url, { headers: jsonHeaders() }, 20000);
    if (!response.ok) throw new Error(`Owner API returned HTTP ${response.status}.`);
    const data = await response.json();
    const batch = Array.isArray(data.owners) ? data.owners : [];
    for (const owner of batch) {
      const address = String(owner.address || "").toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(address)) owners.set(address, Number(owner.ownership?.tokenCount || 1) || 1);
    }
    if (batch.length < limit) break;
  }
  const holders = [...owners.entries()].map(([address, balance]) => ({ address, balance }));
  if (!holders.length) throw new Error("Owner API returned no holders.");
  return holders;
}

function applyHolderOptions(items, options) {
  const excluded = new Set(options.excludeList);
  return normalizeHolders(items)
    .filter((holder) => holder.balance >= options.minHoldings)
    .filter((holder) => !excluded.has(holder.address))
    .sort((a, b) => b.balance - a.balance || a.address.localeCompare(b.address));
}

function normalizeHolders(items) {
  const holders = new Map();
  for (const item of items) {
    const address = String(item?.address || "").trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) continue;
    holders.set(address, Math.max(holders.get(address) || 0, Number(item.balance || 1) || 1));
  }
  return [...holders.entries()].map(([address, balance]) => ({ address, balance }));
}

function holderCsvBody(holders) {
  const rows = ["wallet_address", ...holders.map((holder) => csvCell(holder.address))];
  return `${rows.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function jsonHeaders() {
  return { accept: "application/json", "user-agent": "Flamingos-Snapshot/1.0" };
}

function textHeaders() {
  return { accept: "text/csv,text/plain,*/*", "user-agent": "Flamingos-Snapshot/1.0" };
}

function cleanError(error) {
  if (error?.name === "AbortError") return "The data source took too long. Try again or use the contract address.";
  return String(error?.message || "Snapshot failed.").slice(0, 240);
}
