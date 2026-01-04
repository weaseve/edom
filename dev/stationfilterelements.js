(async () => {
  // ⭐ 星系名の配列（ここに任意の星系名を追加してください）
  const systemNames = [
    "Shenich",
    "Tirawishans",
    "40 Ceti",
    "Piscium Sector PI-T b3-3",
    "Piscium Sector JM-W c1-21",
    "Arietis Sector UO-R b4-4",
    "Mingfu",
    "Arietis Sector EW-N b6-2",
    "Wolf 1066",
    "Praea Euq LG-X c1-0",
    "Pegasi Sector OI-S b4-7",
    "Puppis Sector GW-N a6-1",
    "Pegasi Sector YP-O b6-3",
    "Tirawishans",
    "Piscium Sector MC-V b2-7",
    "Eurybia",
    "Piscium Sector KR-W b1-3",
    "Piscium Sector LC-V b2-3",
    "LTT 74",
    "Minerva",
    "Dheneb",
    "Alaunus",
    "Trianguli Sector VF-N a7-1",
    "ICZ ZK-X b1-0",
    "Sol",
    "Zeus",
    "HIP 16538",
    "45 Theta Ceti",
    "47 Ceti",
    "Stafkarl",
    "40 Ceti",
    "BD+01 299",
    "45 Theta Ceti",
    "Etain",
    "109 Piscium",
    "Shenich",
    "Mazu",
    "Kab",
    "Col 285 Sector JM-W a31-1",
    "Tirawishans",
    "Pegasi Sector YP-O b6-3",
    "Piscium Sector LC-V b2-3",
    "Piscium Sector JW-W b1-2",
    "Karabal",
    "GCRV 52424",
    "Tirawishans",
    "HIP 4024",
    "Ceti Sector BQ-Y b4",
    "HIP 8887",
    "HIP 22460",
    "Shenich",
    "ICZ ZK-X b1-0",
    "Luyten's Star",
    "Piscium Sector DL-Y c16",
  ];

  // 重複排除のためのSet
  const stationTypes = new Set();
  const economies = new Set();

  // レート制限対策（1秒待機）
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < systemNames.length; i++) {
    const name = systemNames[i];
    console.log(`取得中: ${name} (${i + 1}/${systemNames.length})`);
    const url = `https://www.edsm.net/api-system-v1/stations?systemName=${encodeURIComponent(name)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const stations = data.stations || [];

      for (const s of stations) {
        if (s.type) stationTypes.add(s.type);
        if (s.economy) economies.add(s.economy);
        if (s.secondEconomy) economies.add(s.secondEconomy);
      }
    } catch (e) {
      console.warn(`失敗: ${name}`, e);
    }

    await delay(1000); // 1秒待機
  }

  // 結果出力
  console.log("📦 ステーションタイプ一覧:");
  console.log([...stationTypes].sort());

  console.log("💰 エコノミー一覧:");
  console.log([...economies].sort());
})();
