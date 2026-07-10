const CONFIG = Object.freeze({
  version: "2.4",
  supabaseUrl: "https://vascugjgjkettfxtntmy.supabase.co",
  supabaseKey: "sb_publishable_BHWzwW0SOaB0vRIYfhSLSA_kmWFRkoq",
  tableName: "monsters",
  viewTableName: "balance_saves",
  storageKey: "gamebalance.monsters.v2.4",
  seedMonsters: [
    { id: 1, name: "Rotting Zombie", type: "\uc5b8\ub370\ub4dc", difficulty: "easy", hp: 120, speed: 1.4, attack: 18, spawn: 85, created: "2026-06-01", updated: "2026-07-02" },
    { id: 2, name: "Hellhound", type: "\uc57c\uc218", difficulty: "normal", hp: 280, speed: 4.8, attack: 52, spawn: 55, created: "2026-06-03", updated: "2026-07-05" },
    { id: 3, name: "Iron Golem", type: "\uad6c\uc870\ubb3c", difficulty: "hard", hp: 980, speed: 1.1, attack: 145, spawn: 20, created: "2026-06-08", updated: "2026-07-08" },
    { id: 4, name: "Shadow Demon", type: "\uc545\ub9c8", difficulty: "boss", hp: 650, speed: 6.2, attack: 210, spawn: 12, created: "2026-06-15", updated: "2026-07-09" },
    { id: 5, name: "Bandit Scout", type: "\uc778\uac04\ud615", difficulty: "easy", hp: 95, speed: 3.2, attack: 22, spawn: 90, created: "2026-06-20", updated: "2026-07-01" }
  ]
});
