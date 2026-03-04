import { useEffect, useRef } from "react";
import BudgetTracker from "./BudgetTracker";

const MIGRATION_KEYS = [
  "budget-tracker-v1",
  "budget-goals-v1",
  "budget-tracker-theme",
];

function useMigrateLocalStorage() {
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;

    const hasData = MIGRATION_KEYS.some(
      (k) => localStorage.getItem(k) !== null
    );
    if (!hasData) return;

    (async () => {
      try {
        // Migrate transactions
        const txRaw = localStorage.getItem("budget-tracker-v1");
        if (txRaw) {
          const data = JSON.parse(txRaw);
          for (const [month, entries] of Object.entries(data)) {
            for (const e of entries) {
              await fetch("/api/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...e, month }),
              });
            }
          }
        }

        // Migrate goals
        const goalsRaw = localStorage.getItem("budget-goals-v1");
        if (goalsRaw) {
          await fetch("/api/goals", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: goalsRaw,
          });
        }

        // Migrate theme
        const theme = localStorage.getItem("budget-tracker-theme");
        if (theme) {
          await fetch("/api/settings/theme", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: theme }),
          });
        }

        MIGRATION_KEYS.forEach((k) => localStorage.removeItem(k));
        console.log("Migrated localStorage data to server");
      } catch (err) {
        console.error("localStorage migration failed:", err);
      }
    })();
  }, []);
}

export default function App() {
  useMigrateLocalStorage();
  return <BudgetTracker />;
}
