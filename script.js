let systemNames = [];
let results = [];
let currentDisplayType = "list"; // "list" or "grouped"

document.getElementById("scrapeInara").addEventListener("click", scrapeInara);
document.getElementById("fetchEdsm").addEventListener("click", fetchEdsmData);

// Display type selector buttons
document.querySelectorAll(".display-type-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    document
      .querySelectorAll(".display-type-btn")
      .forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    currentDisplayType = e.target.dataset.type;
    applyFilters();
  });
});

// Clear URL error when the input changes
const inaraInputEl = document.getElementById("inaraUrl");
if (inaraInputEl) {
  inaraInputEl.addEventListener("input", () => {
    inaraInputEl.classList.remove("invalid");
    const err = document.getElementById("inaraUrlError");
    if (err) err.textContent = "";
  });
}

async function scrapeInara() {
  const input = document.getElementById("inaraUrl");
  const raw = ((input && input.value) || "").trim();
  const validation = validateInaraUrl(raw);
  if (!validation.ok) {
    if (input) input.classList.add("invalid");
    const err = document.getElementById("inaraUrlError");
    if (err) err.textContent = validation.message;
    updateStatus("InaraのURLが無効です");
    return;
  }

  if (input) {
    input.classList.remove("invalid");
    const err = document.getElementById("inaraUrlError");
    if (err) err.textContent = "";
  }

  updateStatus("Inaraから星系を取得中...");
  try {
    let systems = [];
    const target = validation.normalizedUrl;
    if (validation.type === "power-controlled") {
      systems = await scrapePowerControlled(target);
    } else if (validation.type === "power-exploited") {
      systems = await scrapePowerExploited(target);
    } else if (validation.type === "power-contested") {
      systems = await scrapePowerContested(target);
    } else if (validation.type === "nearest-starsystems") {
      systems = await scrapeNearestStarsystems(target);
    }

    systemNames = [...new Set(systems)];
    console.log("Inara systems:", systemNames);

    updateStatus(`取得完了：${systemNames.length} 星系`);
  } catch (e) {
    updateStatus("Inaraの取得に失敗しました");
    console.error(e);
  }
}

// Validate an Inara URL and normalize it
function validateInaraUrl(url) {
  if (!url) return { ok: false, message: "URLを入力してください" };
  let candidate = url;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = "https://" + candidate;
  }
  try {
    const u = new URL(candidate);
    // normalize pathname to ensure trailing slash
    let pathname = u.pathname;
    if (!pathname.endsWith("/")) pathname += "/";

    // Power patterns
    let match = pathname.match(
      /^\/elite\/(power-(?:controlled|exploited|contested))\/(\d+)\/?$/i
    );
    if (match) {
      const type = match[1].toLowerCase();
      const id = match[2];
      const normalizedUrl = `${u.protocol}//${u.host}/elite/${type}/${id}/`;
      return { ok: true, type, id, normalizedUrl };
    }

    // nearest-starsystems (accepts query params; don't care about the parameters)
    if (/^\/elite\/nearest-starsystems\/$/i.test(pathname)) {
      const normalizedUrl = `${u.protocol}//${u.host}${pathname}${u.search}`;
      return { ok: true, type: "nearest-starsystems", id: null, normalizedUrl };
    }

    return {
      ok: false,
      message:
        "サポートされていないURLパターンです。例: https://inara.cz/elite/power-controlled/7/ または https://inara.cz/elite/nearest-starsystems/?...",
    };
  } catch (e) {
    return { ok: false, message: "無効なURLです" };
  }
}

// Generic fetch + parse for power pages
async function scrapePowerGeneric(targetUrl) {
  const proxy = "https://corsproxy.io/?";
  const url = proxy + encodeURIComponent(targetUrl);
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [
    ...doc.querySelectorAll(
      "table.tablesortercollapsed a[href^='/elite/starsystem']"
    ),
  ];
  return links.map((a) => a.textContent.replace(/\s+/g, " ").trim());
}

async function scrapePowerControlled(targetUrl) {
  return scrapePowerGeneric(targetUrl);
}
async function scrapePowerExploited(targetUrl) {
  return scrapePowerGeneric(targetUrl);
}
async function scrapePowerContested(targetUrl) {
  return scrapePowerGeneric(targetUrl);
}

// nearest-starsystems uses the page's main table; reuse the generic table scraper
async function scrapeNearestStarsystems(targetUrl) {
  return scrapePowerGeneric(targetUrl);
}

async function fetchEdsmData() {
  if (systemNames.length === 0) {
    updateStatus("先にInaraから星系を取得してください");
    return;
  }

  results = [];
  for (let i = 0; i < systemNames.length; i++) {
    const name = systemNames[i];
    updateStatus(`EDSM取得中: ${name} (${i + 1}/${systemNames.length})`);
    const url = `https://www.edsm.net/api-system-v1/stations?systemName=${encodeURIComponent(
      name
    )}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const stations = data.stations || [];
      for (const s of stations) {
        // Keep any station that has market update info; we will filter client-side
        if (s.haveMarket && s.updateTime && s.updateTime.market) {
          // Parse market update time (try native parse, then fallback to ISO with Z)
          let marketStr = s.updateTime.market;
          let ts = Date.parse(marketStr);
          if (isNaN(ts)) {
            const alt = marketStr.replace(" ", "T") + "Z";
            ts = Date.parse(alt);
          }
          if (isNaN(ts)) {
            console.warn(`パース失敗: ${s.name} in ${name}`, marketStr);
            ts = Date.now();
          }

          // extract up to two economies for the station (primary and second)
          function extractEconomies(st) {
            const set = new Set();
            if (st.economies && Array.isArray(st.economies)) {
              for (const item of st.economies) {
                if (!item) continue;
                if (typeof item === "string") set.add(item);
                else if (item.name) set.add(item.name);
                else if (item.type) set.add(item.type);
              }
            }
            if (st.economy) {
              if (typeof st.economy === "string") set.add(st.economy);
              else if (st.economy.name) set.add(st.economy.name);
            }
            if (st.secondEconomy) {
              if (typeof st.secondEconomy === "string")
                set.add(st.secondEconomy);
              else if (st.secondEconomy.name) set.add(st.secondEconomy.name);
            }
            if (st.market && st.market.primaryEconomy)
              set.add(st.market.primaryEconomy);
            return Array.from(set).filter(Boolean).slice(0, 2);
          }

          results.push({
            system: name,
            station: s.name,
            type: s.type || "",
            economies: extractEconomies(s),
            updated: ts, // stored in milliseconds
          });
        }
      }
    } catch (e) {
      console.warn(`失敗: ${name}`, e);
    }

    // After each system, sort by oldest market update and refresh the table
    results.sort((a, b) => a.updated - b.updated);
    // apply current filters to refreshed results
    applyFilters();
    updateStatus(
      `進捗：${i + 1}/${systemNames.length} - ${
        results.length
      } 件のステーション取得`
    );

    await new Promise((r) => setTimeout(r, 1000)); // レート制限対策
  }

  updateStatus(`完了：${results.length} 件のステーションを取得`);
}

function renderTable(data) {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";

  if (currentDisplayType === "grouped") {
    renderTableGrouped(data);
  } else {
    renderTableList(data);
  }
}

function renderTableList(data) {
  const tbody = document.querySelector("#resultTable tbody");
  const now = Date.now();
  for (const row of data) {
    const tr = document.createElement("tr");
    const updateDate = new Date(row.updated);
    const diffMs = now - row.updated;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const diffText = formatElapsedTime(diffDays);
    
    // Determine color class based on elapsed days
    let colorClass = "";
    if (diffDays > 180) {
      colorClass = "elapsed-red";
    } else if (diffDays > 3) {
      colorClass = "elapsed-yellow";
    }
    
    // Create refresh button cell
    const refreshButtonHTML = `<button class="refresh-btn" data-system="${row.system}" title="このシステムの情報を更新"><span class="material-symbols-rounded">sync</span></button>`;
    
    tr.innerHTML = `
      <td class="refresh-cell">${refreshButtonHTML}</td>
      <td class="copyable" data-copy="${row.system}" title="Click to copy">${
      row.system
    }</td>
      <td class="copyable" data-copy="${row.station}" title="Click to copy">${
      row.station
    }</td>
      <td>${row.type}</td>
      <td>${
        row.economies && row.economies.length ? row.economies.join(", ") : ""
      }</td>
      <td>${updateDate
        .toISOString()
        .replace("T", " ")
        .slice(0, 19)}</td>
      <td class="${colorClass}">${diffText}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderTableGrouped(data) {
  const tbody = document.querySelector("#resultTable tbody");
  const now = Date.now();

  // Group stations by system
  const grouped = {};
  for (const row of data) {
    if (!grouped[row.system]) {
      grouped[row.system] = [];
    }
    grouped[row.system].push(row);
  }

  // Sort systems by oldest market update time within each system
  const systemEntries = Object.entries(grouped).map(([system, stations]) => {
    // Find the oldest market update time in this system's stations
    const oldestMarketTime = Math.min(...stations.map((s) => s.updated));
    return { system, stations, oldestMarketTime };
  });

  systemEntries.sort((a, b) => a.oldestMarketTime - b.oldestMarketTime);

  // Sort stations within each system by update time (oldest first)
  systemEntries.forEach(({ stations }) => {
    stations.sort((a, b) => a.updated - b.updated);
  });

  // Render with merged cells
  for (const { system, stations } of systemEntries) {
    for (let i = 0; i < stations.length; i++) {
      const row = stations[i];
      const tr = document.createElement("tr");
      const updateDate = new Date(row.updated);
      const diffMs = now - row.updated;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const diffText = formatElapsedTime(diffDays);

      let colorClass = "";
      if (diffDays > 180) {
        colorClass = "elapsed-red";
      } else if (diffDays > 3) {
        colorClass = "elapsed-yellow";
      }

      // Create refresh button cell with rowspan for first station only
      let refreshCell = "";
      if (i === 0) {
        const refreshButtonHTML = `<button class="refresh-btn" data-system="${system}" title="このシステムの情報を更新"><span class="material-symbols-rounded">sync</span></button>`;
        refreshCell = `<td class="refresh-cell" rowspan="${stations.length}">${refreshButtonHTML}</td>`;
      }

      // Create system name cell with rowspan for first station only
      let systemCell = "";
      if (i === 0) {
        systemCell = `<td class="system-name-cell copyable" data-copy="${system}" title="Click to copy" rowspan="${stations.length}">${system}</td>`;
      }

      tr.innerHTML =
        refreshCell +
        systemCell +
        `
      <td class="copyable" data-copy="${row.station}" title="Click to copy">${
          row.station
        }</td>
      <td>${row.type}</td>
      <td>${
        row.economies && row.economies.length ? row.economies.join(", ") : ""
      }</td>
      <td>${updateDate
        .toISOString()
        .replace("T", " ")
        .slice(0, 19)}</td>
      <td class="${colorClass}">${diffText}</td>
    `;
      tbody.appendChild(tr);
    }
  }
}

function formatElapsedTime(days) {
  if (days < 1) {
    const hours = days * 24;
    if (hours < 1) {
      const minutes = hours * 60;
      return Math.floor(minutes) + "分";
    }
    return Math.floor(hours) + "時間";
  } else if (days < 30) {
    return Math.floor(days) + "日";
  } else if (days < 365) {
    const months = days / 30;
    return Math.floor(months) + "ヶ月";
  } else {
    const years = days / 365;
    return Math.floor(years) + "年";
  }
}

// Add click-to-copy behavior via event delegation
const tbodyEl = document.querySelector("#resultTable tbody");
if (tbodyEl) {
  tbodyEl.addEventListener("click", async (ev) => {
    const td = ev.target.closest("td");
    
    // Handle refresh button click
    if (ev.target.classList.contains("refresh-btn")) {
      const systemName = ev.target.dataset.system;
      await refreshSystemData(systemName);
      return;
    }
    
    if (!td || !td.classList.contains("copyable")) return;
    const text = td.dataset.copy || td.textContent.trim();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      td.classList.add("copied");
      const prevTitle = td.getAttribute("title") || "";
      td.setAttribute("title", "Copied!");
      setTimeout(() => {
        td.classList.remove("copied");
        td.setAttribute("title", prevTitle);
      }, 1000);
    } catch (err) {
      console.warn("コピーに失敗しました", err);
    }
  });
}

// Refresh a single system's data from EDSM
async function refreshSystemData(systemName) {
  updateStatus(`${systemName} のデータを更新中...`);
  const url = `https://www.edsm.net/api-system-v1/stations?systemName=${encodeURIComponent(
    systemName
  )}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const stations = data.stations || [];

    // Helper function to extract economies
    function extractEconomies(st) {
      const set = new Set();
      if (st.economies && Array.isArray(st.economies)) {
        for (const item of st.economies) {
          if (!item) continue;
          if (typeof item === "string") set.add(item);
          else if (item.name) set.add(item.name);
          else if (item.type) set.add(item.type);
        }
      }
      if (st.economy) {
        if (typeof st.economy === "string") set.add(st.economy);
        else if (st.economy.name) set.add(st.economy.name);
      }
      if (st.secondEconomy) {
        if (typeof st.secondEconomy === "string") set.add(st.secondEconomy);
        else if (st.secondEconomy.name) set.add(st.secondEconomy.name);
      }
      if (st.market && st.market.primaryEconomy) set.add(st.market.primaryEconomy);
      return Array.from(set).filter(Boolean).slice(0, 2);
    }

    // Remove old entries for this system
    results = results.filter((r) => r.system !== systemName);

    // Add new entries
    for (const s of stations) {
      if (s.haveMarket && s.updateTime && s.updateTime.market) {
        let marketStr = s.updateTime.market;
        let ts = Date.parse(marketStr);
        if (isNaN(ts)) {
          const alt = marketStr.replace(" ", "T") + "Z";
          ts = Date.parse(alt);
        }
        if (isNaN(ts)) {
          ts = Date.now();
        }

        results.push({
          system: systemName,
          station: s.name,
          type: s.type || "",
          economies: extractEconomies(s),
          updated: ts,
        });
      }
    }

    // Sort by oldest market update and refresh the table
    results.sort((a, b) => a.updated - b.updated);
    applyFilters();
    updateStatus(`${systemName} の更新完了`);
  } catch (e) {
    console.warn(`${systemName} の更新に失敗しました`, e);
    updateStatus(`${systemName} の更新に失敗しました`);
  }
}

// --- Filters: station type and economy ---
const defaultStationTypes = new Set([
  "Coriolis Starport",
  "Orbis Starport",
  "Ocellus Starport",
  "Asteroid base",
]);

function initFilters() {
  // initialize station-type checkboxes (default state)
  document.querySelectorAll(".station-type").forEach((checkbox) => {
    const t = checkbox.dataset.stationType;
    if (defaultStationTypes.has(t)) checkbox.checked = true;
    checkbox.addEventListener("change", applyFilters);
  });

  const clearBtn = document.getElementById("clearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // reset to defaults
      document
        .querySelectorAll(".station-type")
        .forEach(
          (cb) => (cb.checked = defaultStationTypes.has(cb.dataset.stationType))
        );
      document
        .querySelectorAll(".economy-filter")
        .forEach((cb) => (cb.checked = false));
      applyFilters();
    });
  }

  // Wire economy static checkboxes to filtering
  document
    .querySelectorAll(".economy-filter")
    .forEach((cb) => cb.addEventListener("change", applyFilters));
}

function getSelectedSets() {
  const types = new Set(
    Array.from(document.querySelectorAll(".station-type:checked")).map(
      (el) => el.dataset.stationType
    )
  );
  const econ = new Set(
    Array.from(document.querySelectorAll(".economy-filter:checked")).map(
      (el) => el.dataset.economy
    )
  );
  return { types, econ };
}

function applyFilters() {
  const { types, econ } = getSelectedSets();
  const filtered = results.filter((r) => {
    const typeMatch = types.size === 0 || types.has(r.type);
    const econMatch =
      econ.size === 0 ||
      (Array.isArray(r.economies) && r.economies.some((e) => econ.has(e)));
    return typeMatch && econMatch;
  });
  renderTable(filtered);
}

// initialize UI
initFilters();

function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}
