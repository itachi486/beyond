#!/usr/bin/env bash
set -euo pipefail
BEYOND_PG_BIN=${BEYOND_PG_BIN:-/usr/lib/postgresql/18/bin}
BEYOND_PG_FIXTURE=$(mktemp -d /tmp/beyond-edge-postgres.XXXXXX)
chmod 700 "$BEYOND_PG_FIXTURE"
"$BEYOND_PG_BIN/initdb" -D "$BEYOND_PG_FIXTURE/data" --auth=trust --no-locale > "$BEYOND_PG_FIXTURE/init.log" 2>&1
trap '"$BEYOND_PG_BIN/pg_ctl" -D "$BEYOND_PG_FIXTURE/data" -m fast stop >/dev/null 2>&1 || true' EXIT
"$BEYOND_PG_BIN/pg_ctl" -D "$BEYOND_PG_FIXTURE/data" -l "$BEYOND_PG_FIXTURE/server.log" -o "-h '' -k $BEYOND_PG_FIXTURE -p 55489" -w start >/dev/null
BEYOND_PSQL=(psql -h "$BEYOND_PG_FIXTURE" -p 55489 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1 -q)
"${BEYOND_PSQL[@]}" -c 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;'
"${BEYOND_PSQL[@]}" -f supabase/SQL_EDITOR_MIGRATION.sql
"${BEYOND_PSQL[@]}" -f server/tests/edge-sql-fixture.sql
# Existing names must fail without changing the already-preserved data.
if "${BEYOND_PSQL[@]}" -f supabase/SQL_EDITOR_MIGRATION.sql > "$BEYOND_PG_FIXTURE/collision.log" 2>&1; then
  echo 'Collision guard failed'; exit 1
fi
"${BEYOND_PSQL[@]}" -c "DO \$\$ BEGIN IF (SELECT count(*) FROM public.beyond_records WHERE collection='admins')<>1 THEN RAISE EXCEPTION 'Existing administrator fixture lost'; END IF; END \$\$;"
echo 'Disposable PostgreSQL schema/auth/write/access/collision fixture: PASS'
