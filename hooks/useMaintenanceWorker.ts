import { useEffect } from 'react';
import { runMaintenanceCycle } from '../services/firestore-db';

/**
 * 🛠️ [MAINTENANCE-WORKER] Background Service
 * Periodically runs the Watchdog maintenance cycle if the user is a staff member.
 * Only one "leader" node actually performs the DB writes.
 */
export function useMaintenanceWorker(uid: string | null, role: string | null) {
  useEffect(() => {
    // Only run for coordination staff (Server or Admin)
    const isBrainEligible = role && ['ADMIN', 'SERVER'].includes(role.toUpperCase());
    if (!uid || !isBrainEligible) return;

    console.log(`🛠️ [MAINTENANCE] Worker initialized for ${role} (${uid})`);

    // Run every 2 minutes (120,000ms)
    const interval = setInterval(async () => {
      try {
        const result = await runMaintenanceCycle(uid);
        if (result.restored > 0) {
          console.info(`🐕 [WATCHDOG] Recovered ${result.restored} stuck items/batches.`);
        }
      } catch (err) {
        console.error("Maintenance cycle failed:", err);
      }
    }, 120000);

    // Initial run after short delay
    const initialRun = setTimeout(() => {
       runMaintenanceCycle(uid).catch(e => console.error("Initial maintenance failed:", e));
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialRun);
    };
  }, [uid, role]);
}
