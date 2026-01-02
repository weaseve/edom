let systemNames = [];
let results = [];

document.getElementById("scrapeInara").addEventListener("click", scrapeInara);
document.getElementById("fetchEdsm").addEventListener("click", fetchEdsmData);

async function scrapeInara() {
  updateStatus("Inaraから星系を取得中...");
  const proxy = "https://corsproxy.io/?";
  const url = proxy + encodeURIComponent("https://inara.cz/elite/power-controlled/7/");
  try {
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Match anchors in the Inara table (handles e.g. /elite/starsystem-powerplay/)
    const links = [...doc.querySelectorAll("table.tablesortercollapsed a[href^='/elite/starsystem']")];
    // Normalize whitespace and trim; remove duplicates
    systemNames = [...new Set(links.map(a => a.textContent.replace(/\s+/g, " ").trim()))];
    console.log("Inara systems:", systemNames);

    updateStatus(`取得完了：${systemNames.length} 星系`);
  } catch (e) {
    updateStatus("Inaraの取得に失敗しました");
    console.error(e);
  }
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