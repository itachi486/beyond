// Per-ledger-row precision proof, never an independent balance/counter. The
// original nine-column ledger remains authoritative and old loaders keep working.
export const budgetCertificationSchema=`
CREATE TABLE IF NOT EXISTS b10_ledger_certifications(
 ledger_id TEXT PRIMARY KEY REFERENCES workers_ai_requests(id) ON DELETE CASCADE,
 raw_neurons REAL NOT NULL CHECK(raw_neurons>=0),
 reserved_units TEXT NOT NULL CHECK(length(reserved_units) BETWEEN 1 AND 19 AND reserved_units NOT GLOB '*[^0-9]*' AND CAST(reserved_units AS INTEGER)>=0 AND CAST(CAST(reserved_units AS INTEGER) AS TEXT)=reserved_units)
);
CREATE VIEW IF NOT EXISTS b10_budget_ledger AS SELECT r.id,r.actor,r.kind,r.request_hash,r.day,r.reserved_neurons,r.status,r.response,r.created_at,c.reserved_units FROM workers_ai_requests r LEFT JOIN b10_ledger_certifications c ON c.ledger_id=r.id AND c.raw_neurons=r.reserved_neurons;
CREATE TRIGGER IF NOT EXISTS b10_invalidate_budget_precision AFTER UPDATE OF reserved_neurons ON workers_ai_requests BEGIN DELETE FROM b10_ledger_certifications WHERE ledger_id=NEW.id; END;
`;
