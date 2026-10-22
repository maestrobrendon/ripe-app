"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useCart } from "@/components/cart-provider";
import { LeafletMap } from "@/components/maps/leaflet-map";
import { haptic } from "@/lib/haptics";
import { pinMyAddress } from "./actions";

type Spot = { lat: number; lng: number };

/**
 * Put an address on the map: tap where the gate is, or use where you are.
 * The rider finds you first time, and delivery is priced from the exact spot.
 */
export function PinSheet({ address, onClose }: { address: { id: string; label: string; line: string; pin: Spot | null; around: Spot } | null; onClose: () => void }) {
  return (
    <BottomSheet open={Boolean(address)} onClose={onClose} title={address?.pin ? "Move your pin" : "Pin your gate"} desktopDialog>
      {address && <Pinner key={address.id} address={address} onDone={onClose} />}
    </BottomSheet>
  );
}

function Pinner({ address, onDone }: { address: { id: string; label: string; line: string; pin: Spot | null; around: Spot }; onDone: () => void }) {
  const router = useRouter();
  const cart = useCart();
  const [pending, start] = useTransition();
  const [spot, setSpot] = useState<Spot | null>(address.pin);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drop = (p: Spot) => {
    setSpot(p);
    setError(null);
    haptic("selection");
  };

  const here = () => {
    if (!navigator.geolocation) return setError("Your browser can't share your location. Tap the map instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        drop({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setError("We couldn't get your location. Tap the map where your gate is.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const save = () =>
    spot &&
    start(async () => {
      const r = await pinMyAddress(address.id, spot);
      if (!r.ok) {
        setError(r.error);
        haptic("error");
        return;
      }
      haptic("success");
      cart.announce(r.fee != null ? `Pinned. Delivery to ${address.label} is ₦${r.fee.toLocaleString("en-NG")}` : `${address.label} is on the map`);
      router.refresh();
      onDone();
    });

  return (
    <div>
      <p className="text-[15px] text-muted">{address.line}</p>
      <p className="mt-1 text-[13px] text-muted">Tap the map where your gate is. Your rider comes straight there, and delivery is priced from that exact spot.</p>

      <LeafletMap
        center={spot ?? address.around}
        zoom={spot ? 17 : 14}
        pins={spot ? [{ id: "me", lat: spot.lat, lng: spot.lng, kind: "pick", color: "#0f7a48", draggable: true, label: "Your gate" }] : []}
        onPick={drop}
        onDrag={(_, p) => drop(p)}
        className="mt-4 h-[340px] sm:h-[380px]"
      />

      <button type="button" onClick={here} disabled={locating} className="mt-3 flex h-11 items-center gap-2 rounded-full bg-soft-mist px-4 text-[14px] font-semibold transition-colors hover:bg-black/[0.08] disabled:opacity-60">
        <Icon name="pin" size={15} weight="bold" />
        {locating ? "Finding you…" : "I'm here now"}
      </button>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-ember/12 p-3 text-sm">
          {error}
        </p>
      )}
      <Button size="lg" className="mt-4 w-full" disabled={!spot} loading={pending} onClick={save}>
        {spot ? "Save this spot" : "Tap the map first"}
      </Button>
    </div>
  );
}
