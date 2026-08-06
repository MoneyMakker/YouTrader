import { normalizeMigrationTrade } from "../../src/postPurchase/AnonymousDataMigrationService";

let failures = 0;
function check(name: string, condition: boolean) {
  if (condition) console.log(`PASS  ${name}`);
  else { failures += 1; console.error(`FAIL  ${name}`); }
}

const guest = { symbol: "NQ", pnl: 100, notes: "no id" };
const guestA = normalizeMigrationTrade(guest, 0, "guest") as Record<string, unknown>;
const guestB = normalizeMigrationTrade(guest, 0, "guest") as Record<string, unknown>;
const authenticated = normalizeMigrationTrade({ ...guest, id: "existing-id", pnl: 150 }, 0, "authenticated") as Record<string, unknown>;
const otherAccount = normalizeMigrationTrade(guest, 0, "authenticated") as Record<string, unknown>;

check("guest no-ID trade receives stable migration ID", typeof guestA.id === "string" && String(guestA.id).startsWith("migration-"));
check("same no-ID trade produces same ID", guestA.id === guestB.id);
check("authenticated ID is preserved", authenticated.id === "existing-id");
check("different migration scope does not reuse guest ID", guestA.id !== otherAccount.id);
check("trade payload is preserved", guestA.symbol === "NQ" && guestA.pnl === 100);

if (failures) process.exit(1);
console.log("assessment-migration: all checks passed");
