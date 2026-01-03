let systemNames = [];
let results = [];

document.getElementById("scrapeInara").addEventListener("click", scrapeInara);
document.getElementById("fetchEdsm").addEventListener("click", fetchEdsmData);

// Clear URL error when the input changes
const inaraInputEl = document.getElementById('inaraUrl');
if (inaraInputEl) {
  inaraInputEl.addEventListener('input', () => {
    inaraInputEl.classList.remove('invalid');
    const err = document.getElementById('inaraUrlError');
    if (err) err.textContent = '';
  });
} 

async function scrapeInara() {
  const input = document.getElementById('inaraUrl');
  const raw = (input && input.value || '').trim();
  const validation = validateInaraUrl(raw);
  if (!validation.ok) {
    if (input) input.classList.add('invalid');
    const err = document.getElementById('inaraUrlError');
    if (err) err.textContent = validation.message;
    updateStatus("InaraのURLが無効です");
    return;
  }

  if (input) {
    input.classList.remove('invalid');
    const err = document.getElementById('inaraUrlError');
    if (err) err.textContent = '';
  }

  updateStatus("Inaraから星系を取得中...");
  try {
    let systems = [];
    const target = validation.normalizedUrl;
    if (validation.type === 'power-controlled') {
      systems = await scrapePowerControlled(target);
    } else if (validation.type === 'power-exploited') {
      systems = await scrapePowerExploited(target);
    } else if (validation.type === 'power-contested') {
      systems = await scrapePowerContested(target);
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
  if (!url) return { ok: false, message: 'URLを入力してください' };
  let candidate = url;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate;
  }
  try {
    const u = new URL(candidate);
    const match = u.pathname.match(/^\/elite\/(power-(?:controlled|exploited|contested))\/(\d+)\/?$/i);
    if (!match) {
      return { ok: false, message: 'サポートされていないURLパターンです。例: https://inara.cz/elite/power-controlled/7/' };
    }
    const type = match[1].toLowerCase();
    const id = match[2];
    const normalizedUrl = `${u.protocol}//${u.host}/elite/${type}/${id}/`;
    return { ok: true, type, id, normalizedUrl };
  } catch (e) {
    return { ok: false, message: '無効なURLです' };
  }
}

// Generic fetch + parse for power pages
async function scrapePowerGeneric(targetUrl) {
  const proxy = "https://corsproxy.io/?";
  const url = proxy + encodeURIComponent(targetUrl);
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [...doc.querySelectorAll("table.tablesortercollapsed a[href^='/elite/starsystem']")];
  return links.map(a => a.textContent.replace(/\s+/g, " ").trim());
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

async function fetchEdsmData() {
  if (systemNames.length === 0) {
    updateStatus("先にInaraから星系を取得してください");
    return;
  }

  results = [];
  for (let i = 0; i < systemNames.length; i++) {
    const name = systemNames[i];
    updateStatus(`EDSM取得中: ${name} (${i + 1}/${systemNames.length})`);
    const url = `https://www.edsm.net/api-system-v1/stations?systemName=${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      const stations = data.stations || [];
      for (const s of stations) {
        if (
          ["Coriolis Starport", "Orbis Starport", "Ocellus Starport"].includes(s.type) &&
          s.haveMarket && s.updateTime && s.updateTime.market
        ) {
          // Parse market update time (try native parse, then fallback to ISO with Z)
          let marketStr = s.updateTime.market;
          let ts = Date.parse(marketStr);
          if (isNaN(ts)) {
            const alt = marketStr.replace(' ', 'T') + 'Z';
            ts = Date.parse(alt);
          }
          if (isNaN(ts)) {
            console.warn(`パース失敗: ${s.name} in ${name}`, marketStr);
            ts = Date.now();
          }

          results.push({
            system: name,
            station: s.name,
            type: s.type,
            updated: ts // stored in milliseconds
          });
        }
      }
    } catch (e) {
      console.warn(`失敗: ${name}`, e);
    }

    // After each system, sort by oldest market update and refresh the table
    results.sort((a, b) => a.updated - b.updated);
    renderTable(results);
    updateStatus(`進捗：${i + 1}/${systemNames.length} - ${results.length} 件のStarport`);

    await new Promise(r => setTimeout(r, 1000)); // レート制限対策
  }

  updateStatus(`完了：${results.length} 件のStarportを取得`);
}

function renderTable(data) {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";
  for (const row of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="copyable" data-copy="${row.system}" title="Click to copy">${row.system}</td>
      <td class="copyable" data-copy="${row.station}" title="Click to copy">${row.station}</td>
      <td>${row.type}</td>
      <td>${new Date(row.updated).toISOString().replace("T", " ").slice(0, 19)}</td>
    `;
    tbody.appendChild(tr);
  }
}

// Add click-to-copy behavior via event delegation
const tbodyEl = document.querySelector('#resultTable tbody');
if (tbodyEl) {
  tbodyEl.addEventListener('click', async (ev) => {
    const td = ev.target.closest('td');
    if (!td || !td.classList.contains('copyable')) return;
    const text = td.dataset.copy || td.textContent.trim();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      td.classList.add('copied');
      const prevTitle = td.getAttribute('title') || '';
      td.setAttribute('title', 'Copied!');
      setTimeout(() => {
        td.classList.remove('copied');
        td.setAttribute('title', prevTitle);
      }, 1000);
    } catch (err) {
      console.warn('コピーに失敗しました', err);
    }
  });
}

function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}