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

    const links = [...doc.querySelectorAll("a[href^='/elite/starsystem/']")];
    systemNames = [...new Set(links.map(a => a.textContent.trim()))];

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
          s.haveMarket && s.marketUpdatedAt
        ) {
          results.push({
            system: name,
            station: s.name,
            type: s.type,
            updated: s.marketUpdatedAt
          });
        }
      }
    } catch (e) {
      console.warn(`失敗: ${name}`, e);
    }
    await new Promise(r => setTimeout(r, 1000)); // レート制限対策
  }

  results.sort((a, b) => a.updated - b.updated);
  renderTable(results);
  updateStatus(`完了：${results.length} 件のStarportを取得`);
}

function renderTable(data) {
  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";
  for (const row of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.system}</td>
      <td>${row.station}</td>
      <td>${row.type}</td>
      <td>${new Date(row.updated * 1000).toISOString().replace("T", " ").slice(0, 19)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}