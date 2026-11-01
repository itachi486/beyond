export function fantasyOverview(db, now = Date.now()) {
  const central = !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE name='central_characters'")
    .get();
  const stamp = new Date(now).toISOString();
  const start = new Date(now - 6 * 86400000).toISOString().slice(0, 10);
  const end = new Date(now + 86400000).toISOString().slice(0, 10);
  const revisions = db
    .prepare(
      "SELECT substr(created_at,1,10) date,CASE WHEN kind='worlds' THEN 'worlds' ELSE 'content' END category,COUNT(*) count FROM revisions WHERE created_at>=? AND created_at<? GROUP BY date,category",
    )
    .all(start, end);
  const centralDays = central
    ? db
        .prepare(
          "SELECT substr(created_at,1,10) date,'characters' category,COUNT(*) count FROM central_activity WHERE created_at>=? AND created_at<? GROUP BY date",
        )
        .all(start, end)
    : [];
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now - (6 - i) * 86400000).toISOString().slice(0, 10);
    const day = { date, characters: 0, worlds: 0, content: 0 };
    for (const r of [...revisions, ...centralDays])
      if (r.date === date) day[r.category] = r.count;
    return day;
  });
  const characters = central
    ? db
        .prepare(
          "SELECT id,name,type,format,version,preview_key,created_at FROM central_characters WHERE deleted=0 ORDER BY created_at DESC,id LIMIT 4",
        )
        .all()
    : [];
  const worlds = db
    .prepare(
      "SELECT id,status,data,created_at FROM worlds ORDER BY created_at DESC,id LIMIT 4",
    )
    .all()
    .map((r) => ({
      id: r.id,
      status: r.status,
      name: JSON.parse(r.data).name,
      createdAt: r.created_at,
    }));
  const events = [
    ...db
      .prepare(
        "SELECT 'revision-'||id id,CASE WHEN kind='permanent_deletion' THEN 'Permanently deleted record' ELSE 'Saved '||kind END action,record_id name,created_at createdAt FROM revisions ORDER BY created_at DESC,id DESC LIMIT 4",
      )
      .all(),
    ...(central
      ? db
          .prepare(
            "SELECT id,action,name,created_at createdAt FROM central_activity ORDER BY created_at DESC,id LIMIT 4",
          )
          .all()
      : []),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  return {
    generatedAt: stamp,
    memberAccounts: !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='user_accounts'").get(),
    publishedDiscoveries: db.prepare("SELECT COUNT(*) n FROM discoveries d JOIN worlds w ON w.id=d.world_id WHERE d.status='published' AND w.status='published'").get().n,
    totals: {
      users: db.prepare("SELECT COUNT(*) n FROM "+(db.prepare("SELECT 1 FROM sqlite_master WHERE name='user_accounts'").get()?"user_accounts":"admins")).get().n,
      characters: central
        ? db
            .prepare(
              "SELECT COUNT(*) n FROM central_characters WHERE deleted=0",
            )
            .get().n
        : 0,
      worlds: db.prepare("SELECT COUNT(*) n FROM worlds").get().n,
      connections: db.prepare("SELECT COUNT(*) n FROM connections").get().n,
      storageBytes: null,
    },
    days,
    characters: characters.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      format: r.format,
      createdAt: r.created_at,
      previewUrl: r.preview_key
        ? `/api/admin/library/characters/${r.id}/preview?v=${r.version}`
        : null,
    })),
    worlds,
    activity: events,
    system: {
      database: db.prepare("SELECT 1 ok").get().ok === 1,
      api: true,
      lastBackup: null,
    },
    scope: db.prepare("SELECT 1 FROM sqlite_master WHERE name='user_accounts'").get() ? "Registered member counts, central characters and editorial worlds. Private member world contents are excluded from this overview." :
      "Server administrator accounts, central characters and editorial worlds only. Browser-local worlds, characters and public visitors are not centrally tracked.",
  };
}
