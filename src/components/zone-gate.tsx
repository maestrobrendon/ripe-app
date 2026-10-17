"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { Button } from "@/components/ui/button";
import { spring } from "@/lib/motion/tokens";

type Zone = { slug: string; name: string; area: string };

type ZoneContextValue = {
  zoneName: string | null;
  openPicker: () => void;
};

const ZoneContext = createContext<ZoneContextValue>({ zoneName: null, openPicker: () => {} });

export function useZone() {
  return useContext(ZoneContext);
}

export function ZoneProvider({
  children,
  initialZoneName,
}: {
  children: React.ReactNode;
  initialZoneName: string | null;
}) {
  const [zoneName, setZoneName] = useState(initialZoneName);
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [status, setStatus] = useState<"idle" | "locating" | "out-of-area">("idle");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const openPicker = useCallback(() => setOpen(true), []);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!zoneName) {
      const dismissed = sessionStorage.getItem("ripe_zone_dismissed");
      if (!dismissed) setOpen(true);
    }
  }, [zoneName]);

  useEffect(() => {
    if (open && zones.length === 0) {
      fetch("/api/zone")
        .then((r) => r.json())
        .then((d: { zones: Zone[] }) => setZones(d.zones))
        .catch(() => {});
    }
  }, [open, zones.length]);

  const applyZone = async (payload: { slug?: string; lat?: number; lng?: number }) => {
    const res = await fetch("/api/zone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.outOfArea) {
      setStatus("out-of-area");
      return;
    }
    setZoneName(data.zone.name);
    setOpen(false);
    setStatus("idle");
    router.refresh();
  };

  const useLocation = () => {
    if (!navigator.geolocation) {
      setStatus("out-of-area");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => applyZone({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setStatus("idle"),
    );
  };

  const dismiss = useCallback(() => {
    sessionStorage.setItem("ripe_zone_dismissed", "1");
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  const joinWaitlist = async () => {
    await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSaved(true);
  };

  return (
    <ZoneContext.Provider value={{ zoneName, openPicker }}>
      {children}
      <AnimatePresence>
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zone-gate-title"
            className="fixed inset-0 z-(--z-dialog) flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={status === "out-of-area" ? undefined : dismiss}
              className="absolute inset-0 bg-scrim"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={spring.sheet}
              className="relative w-full max-w-md rounded-card border border-border bg-surface p-6"
            >
              {status === "out-of-area" ? (
                <>
                  <h2 id="zone-gate-title" className="text-lg font-semibold">
                    Not in your area yet
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    We do not deliver to your location yet. Leave your email and we will let you know when we do.
                  </p>
                  <AnimatePresence mode="wait">
                    {saved ? (
                      <motion.p
                        key="thanks"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-lg bg-sky-wash p-3 text-sm"
                      >
                        Thanks. We will be in touch.
                      </motion.p>
                    ) : (
                      <motion.div key="form" exit={{ opacity: 0 }} className="mt-4 flex gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                        />
                        <Button onClick={joinWaitlist} size="md">
                          Notify me
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button onClick={() => setStatus("idle")} className="mt-4 text-sm text-carbon underline">
                    Back
                  </button>
                </>
              ) : (
                <>
                  <h2 id="zone-gate-title" className="text-lg font-semibold">
                    Where should we deliver?
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Delivery days and coverage depend on your area. Pick your zone to get started.
                  </p>

                  <Button onClick={useLocation} disabled={status === "locating"} className="mt-4 w-full">
                    {status === "locating" ? "Finding you…" : "Use my location"}
                  </Button>

                  <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium">Or choose your zone</label>
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && applyZone({ slug: e.target.value })}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <option value="" disabled>
                        Select a Lagos zone
                      </option>
                      {zones.map((z) => (
                        <option key={z.slug} value={z.slug}>
                          {z.name} ({z.area})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button onClick={dismiss} className="mt-4 text-sm text-muted underline">
                    Skip for now
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ZoneContext.Provider>
  );
}
