"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

  const dismiss = () => {
    sessionStorage.setItem("ripe_zone_dismissed", "1");
    setOpen(false);
  };

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
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            {status === "out-of-area" ? (
              <>
                <h2 className="text-lg font-semibold">Not in your area yet</h2>
                <p className="mt-2 text-sm text-muted">
                  We do not deliver to your location yet. Leave your email and we will let you know when we do.
                </p>
                {saved ? (
                  <p className="mt-4 rounded-lg bg-ripe-green-light p-3 text-sm">Thanks. We will be in touch.</p>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
                    />
                    <button
                      onClick={joinWaitlist}
                      className="rounded-full bg-ripe-green px-4 py-2 text-sm font-medium text-white"
                    >
                      Notify me
                    </button>
                  </div>
                )}
                <button onClick={() => setStatus("idle")} className="mt-4 text-sm text-ripe-green underline">
                  Back
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Where should we deliver?</h2>
                <p className="mt-2 text-sm text-muted">
                  Delivery days and coverage depend on your area. Pick your zone to get started.
                </p>

                <button
                  onClick={useLocation}
                  disabled={status === "locating"}
                  className="mt-4 w-full rounded-full bg-ripe-green px-4 py-2.5 text-sm font-medium text-white hover:bg-ripe-green-dark disabled:opacity-60"
                >
                  {status === "locating" ? "Finding you." : "Use my location"}
                </button>

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
          </div>
        </div>
      )}
    </ZoneContext.Provider>
  );
}
