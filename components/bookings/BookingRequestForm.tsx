"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type {
  BookingRequestOptions,
  ReservationExperienceOption,
  ReservationFloorObject,
  ReservationFriendOption,
  ReservationProductOption,
} from "@/app/bookings/lib/data";

type BookingRequestFormProps = {
  options: BookingRequestOptions;
  action: (formData: FormData) => Promise<void>;
};

type PaymentOption = "deposit_only" | "pay_in_full";

type SplitShare = {
  friendUserId: number | null;
  clerkUserId: string | null;
  displayName: string;
  handle: string | null;
  amountCents: number;
  isHost: boolean;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function statusTone(status: ReservationFloorObject["status"]) {
  switch (status) {
    case "available":
      return "fill-emerald-500/80 stroke-emerald-100";
    case "reserved":
      return "fill-amber-500/75 stroke-amber-100";
    case "occupied":
      return "fill-rose-500/80 stroke-rose-100";
    case "cleaning":
      return "fill-sky-500/75 stroke-sky-100";
    case "pending":
      return "fill-fuchsia-500/75 stroke-fuchsia-100";
    default:
      return "fill-zinc-700 stroke-zinc-400";
  }
}

function deriveBookingType(experienceId: string) {
  if (experienceId === "bottle_service") return "bottle_service_reservation";
  if (["table_only", "cabana", "lounge", "standing_vip"].includes(experienceId)) return "vip_table_reservation";
  return "venue_reservation";
}

function buildSplitShares(totalCents: number, selectedFriends: ReservationFriendOption[]) {
  const participantCount = selectedFriends.length + 1;
  const evenShare = participantCount > 0 ? Math.floor(totalCents / participantCount) : totalCents;
  const shares: SplitShare[] = [
    { friendUserId: null, clerkUserId: null, displayName: "Host", handle: null, amountCents: evenShare, isHost: true },
    ...selectedFriends.map((friend) => ({
      friendUserId: friend.userId,
      clerkUserId: friend.clerkUserId,
      displayName: friend.displayName,
      handle: friend.handle,
      amountCents: evenShare,
      isHost: false,
    })),
  ];
  const allocated = shares.reduce((sum, share) => sum + share.amountCents, 0);
  if (shares.length > 0 && allocated !== totalCents) {
    shares[0] = { ...shares[0], amountCents: shares[0].amountCents + (totalCents - allocated) };
  }
  return shares;
}

function quantityMapToSelections(items: ReservationProductOption[], quantities: Record<number, number>) {
  return items
    .map((item) => ({ item, quantity: quantities[item.id] ?? 0 }))
    .filter((entry) => entry.quantity > 0)
    .map((entry) => ({
      id: entry.item.id,
      label: entry.item.label,
      quantity: entry.quantity,
      unitPriceCents: entry.item.amountCents,
      category: entry.item.category,
    }));
}

export default function BookingRequestForm({ options, action }: BookingRequestFormProps) {
  const [idempotencyKey] = useState(() => {
    const storageKey = "nightly:booking-request-idempotency-key";
    if (typeof window === "undefined") {
      return "";
    }

    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) {
      return stored;
    }

    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, generated);
    return generated;
  });
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(options.venues[0]?.id ?? null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(options.venues[0]?.floors[0]?.id ?? null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(options.venues[0]?.floors[0]?.objects[0]?.id ?? null);
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>("table_only");
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("deposit_only");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [guestCount, setGuestCount] = useState(4);
  const [reservationName, setReservationName] = useState("");
  const [djProfileId, setDjProfileId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [inspirationText, setInspirationText] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [bottleQuantities, setBottleQuantities] = useState<Record<number, number>>({});
  const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({});
  const [selectedFriendIds, setSelectedFriendIds] = useState<number[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  const selectedVenue = useMemo(() => options.venues.find((venue) => venue.id === selectedVenueId) ?? null, [options.venues, selectedVenueId]);
  const floors = useMemo(() => selectedVenue?.floors ?? [], [selectedVenue]);
  const baseFloor = useMemo(() => floors.find((floor) => floor.id === selectedFloorId) ?? floors[0] ?? null, [floors, selectedFloorId]);
  const baseLocation = useMemo(() => baseFloor?.objects.find((object) => object.id === selectedLocationId) ?? baseFloor?.objects.find((object) => object.status === "available") ?? baseFloor?.objects[0] ?? null, [baseFloor, selectedLocationId]);
  const selectedFriends = useMemo(() => options.friends.filter((friend) => selectedFriendIds.includes(friend.userId)), [options.friends, selectedFriendIds]);

  const availableServers = useMemo(() => {
    if (!selectedVenue) return [] as NonNullable<typeof selectedVenue>["servers"];
    if (!baseLocation?.assignedServerSection) return selectedVenue.servers;
    const matches = selectedVenue.servers.filter((server) => !server.sectionAssignment || server.sectionAssignment === baseLocation.assignedServerSection);
    return matches.length > 0 ? matches : selectedVenue.servers;
  }, [selectedVenue, baseLocation]);

  const effectiveLocation = useMemo(() => {
    if (!selectedVenue || !selectedServerId) {
      return baseLocation;
    }

    const server = selectedVenue.servers.find((item) => item.id === selectedServerId);
    if (!server?.sectionAssignment) {
      return baseLocation;
    }

    return selectedVenue.floors
      .flatMap((floor) => floor.objects)
      .find((object) => object.status === "available" && object.assignedServerSection === server.sectionAssignment)
      ?? baseLocation;
  }, [baseLocation, selectedServerId, selectedVenue]);

  const selectedFloor = useMemo(() => {
    if (!selectedVenue || !effectiveLocation) {
      return baseFloor;
    }

    return selectedVenue.floors.find((floor) => floor.objects.some((object) => object.id === effectiveLocation.id)) ?? baseFloor;
  }, [baseFloor, effectiveLocation, selectedVenue]);

  const selectedLocation = effectiveLocation;

  const availableExperiences = useMemo(() => {
    if (!selectedVenue) return [] as ReservationExperienceOption[];
    const allowedIds = selectedLocation?.enabledExperienceIds ?? selectedVenue.experiences.map((item) => item.id);
    const custom = selectedLocation?.customExperiences ?? [];
    return [...selectedVenue.experiences, ...custom].filter((item) => item.enabled && allowedIds.includes(item.id));
  }, [selectedVenue, selectedLocation]);

  const effectiveExperienceId = useMemo(() => availableExperiences.some((experience) => experience.id === selectedExperienceId) ? selectedExperienceId : (availableExperiences[0]?.id ?? "table_only"), [availableExperiences, selectedExperienceId]);

  const bottleSelections = useMemo(() => quantityMapToSelections(selectedVenue?.bottlePackages ?? [], bottleQuantities), [selectedVenue, bottleQuantities]);
  const addonSelections = useMemo(() => quantityMapToSelections(selectedVenue?.addons ?? [], addonQuantities), [selectedVenue, addonQuantities]);

  const summary = useMemo(() => {
    const bottleSubtotal = bottleSelections.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const addonSubtotal = addonSelections.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const minimumSpend = selectedLocation?.minimumSpendCents ?? 0;
    const bottleMinimum = selectedLocation?.bottleMinimumCents ?? 0;
    const reservationFee = selectedLocation?.reservationFeeCents ?? 0;
    const spendTarget = Math.max(minimumSpend, bottleMinimum, bottleSubtotal);
    const serviceFeeCents = Math.round((spendTarget + addonSubtotal + reservationFee) * 0.08);
    const taxCents = Math.round((spendTarget + addonSubtotal + reservationFee) * 0.07);
    const totalCents = spendTarget + addonSubtotal + reservationFee + serviceFeeCents + taxCents;
    const depositPercent = selectedVenue?.reservationPolicies.defaultDepositPercent ?? 20;
    const dueNowCents = paymentOption === "pay_in_full" ? totalCents : Math.round(totalCents * (depositPercent / 100));

    return {
      bottleSubtotal,
      addonSubtotal,
      minimumSpend,
      bottleMinimum,
      reservationFee,
      serviceFeeCents,
      taxCents,
      totalCents,
      dueNowCents,
      remainingBalanceCents: Math.max(totalCents - dueNowCents, 0),
      minimumSpendRemainingCents: Math.max(minimumSpend - bottleSubtotal, 0),
    };
  }, [addonSelections, bottleSelections, paymentOption, selectedLocation, selectedVenue]);

  const splitShares = useMemo(() => {
    const defaults = buildSplitShares(summary.totalCents, selectedFriends);
    return defaults.map((share) => {
      const key = share.isHost ? "host" : String(share.friendUserId);
      return { ...share, amountCents: splitAmounts[key] ?? share.amountCents };
    });
  }, [selectedFriends, splitAmounts, summary.totalCents]);

  const splitLinesValue = useMemo(() => splitShares.map((share) => `${share.displayName}|${share.handle ? `${share.handle}@nightly.social` : ""}|${share.amountCents}`).join("\n"), [splitShares]);
  const reservationConfigJson = JSON.stringify({ floorPlanId: selectedFloor?.id ?? null, floorObjectId: selectedLocation?.id ?? null, venueTableId: selectedLocation?.venueTableId ?? null, experienceType: effectiveExperienceId, paymentOption, selectedServerId, rotation, zoom });
  const bottleSelectionsJson = JSON.stringify(bottleSelections);
  const addonSelectionsJson = JSON.stringify(addonSelections);
  const splitSharesJson = JSON.stringify(splitShares);
  const bookingType = deriveBookingType(effectiveExperienceId);
  const canSubmit = Boolean(selectedVenue && selectedLocation && requestedDate && requestedTime && guestCount > 0);

  return (
    <form action={action} className="space-y-5 rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Reservation composer</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">Build your Nightly reservation</h3>
        <p className="mt-2 text-sm text-zinc-300">Select a floor, lock a table, configure bottles and add-ons, then confirm the payment plan in the existing Nightly booking system.</p>
      </div>

      <input type="hidden" name="submissionMode" value="request" />
      <input type="hidden" name="bookingType" value={bookingType} />
      <input type="hidden" name="venueId" value={selectedVenue?.id ?? ""} />
      <input type="hidden" name="city" value={selectedVenue?.subtitle.split(" • ").at(-1) ?? ""} />
      <input type="hidden" name="requestedDate" value={requestedDate} />
      <input type="hidden" name="requestedTime" value={requestedTime} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="durationMinutes" value={durationMinutes} />
      <input type="hidden" name="guestCount" value={guestCount} />
      <input type="hidden" name="budgetCents" value={summary.totalCents} />
      <input type="hidden" name="reservationName" value={reservationName} />
      <input type="hidden" name="djProfileId" value={djProfileId ?? ""} />
      <input type="hidden" name="minimumSpendCents" value={selectedLocation?.minimumSpendCents ?? 0} />
      <input type="hidden" name="tableId" value={selectedLocation?.venueTableId ?? ""} />
      <input type="hidden" name="serverId" value={selectedServerId ?? ""} />
      <input type="hidden" name="bottlePackageIds" value={bottleSelections.map((item) => item.id).join(",")} />
      <input type="hidden" name="addonIds" value={addonSelections.map((item) => item.id).join(",")} />
      <input type="hidden" name="splitBillLines" value={splitLinesValue} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="inspirationText" value={inspirationText} />
      <input type="hidden" name="specialRequests" value={specialRequests} />
      <input type="hidden" name="reservationConfigJson" value={reservationConfigJson} />
      <input type="hidden" name="bottleSelectionsJson" value={bottleSelectionsJson} />
      <input type="hidden" name="addonSelectionsJson" value={addonSelectionsJson} />
      <input type="hidden" name="splitSharesJson" value={splitSharesJson} />
      <input type="hidden" name="paymentOption" value={paymentOption} />
      <input suppressHydrationWarning type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-[1.4rem] border border-white/10 bg-zinc-950/65 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">1. Venue and timing</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select value={selectedVenueId ?? ""} onChange={(event) => setSelectedVenueId(event.target.value ? Number(event.target.value) : null)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none">
                {options.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.title}</option>)}
              </select>
              <select value={djProfileId ?? ""} onChange={(event) => setDjProfileId(event.target.value ? Number(event.target.value) : null)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none">
                <option value="">No DJ selected</option>
                {options.djs.map((dj) => <option key={dj.id} value={dj.id}>{dj.title}</option>)}
              </select>
              <input value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} type="date" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <input value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} type="time" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <input value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value) || 120)} type="number" min={30} step={15} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <input value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value) || 1)} type="number" min={1} step={1} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <input value={reservationName} onChange={(event) => setReservationName(event.target.value)} placeholder="Birthday at Nightly" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-white/10 bg-zinc-950/65 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">2. Floor map</p>
                <h4 className="mt-1 text-lg font-semibold text-white">Choose a reservable location</h4>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                <button type="button" onClick={() => setZoom((current) => Math.max(0.75, current - 0.15))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">-</button>
                <button type="button" onClick={() => setZoom((current) => Math.min(2, current + 0.15))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">+</button>
                <button type="button" onClick={() => setRotation((current) => (current + 90) % 360)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Rotate</button>
                <button type="button" onClick={() => { setZoom(1); setRotation(0); }} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Reset</button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {floors.map((floor) => <button key={floor.id} type="button" onClick={() => setSelectedFloorId(floor.id)} className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] ${selectedFloor?.id === floor.id ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-black/20 text-zinc-300"}`}>{floor.name}</button>)}
            </div>

            <div className="mt-4 overflow-auto rounded-[1.2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_40%),linear-gradient(180deg,_rgba(10,15,29,0.96),_rgba(5,8,16,0.96))] p-3">
              {selectedFloor ? (
                <div className="mx-auto min-w-[320px]" style={{ width: Math.max(320, selectedFloor.width) }}>
                  <svg viewBox={`0 0 ${selectedFloor.width} ${selectedFloor.height}`} className="h-[340px] w-full rounded-[1rem]" style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: "center center", transition: "transform 180ms ease" }}>
                    <rect x="0" y="0" width={selectedFloor.width} height={selectedFloor.height} rx="28" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" />
                    {selectedFloor.objects.map((object) => {
                      const selectable = object.status === "available";
                      const selected = object.id === selectedLocationId;
                      const props = {
                        className: `${statusTone(object.status)} ${selectable ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`,
                        strokeWidth: selected ? 5 : 2,
                        onClick: selectable ? () => setSelectedLocationId(object.id) : undefined,
                      };
                      return (
                        <g key={object.id}>
                          {object.shape === "circle" ? <circle cx={object.x + object.width / 2} cy={object.y + object.height / 2} r={Math.min(object.width, object.height) / 2} {...props} /> : null}
                          {object.shape === "ellipse" ? <ellipse cx={object.x + object.width / 2} cy={object.y + object.height / 2} rx={object.width / 2} ry={object.height / 2} {...props} /> : null}
                          {object.shape === "polygon" && object.points.length > 2 ? <polygon points={object.points.map((point) => `${point.x},${point.y}`).join(" ")} {...props} /> : null}
                          {object.shape === "rect" || (object.shape === "polygon" && object.points.length <= 2) ? <rect x={object.x} y={object.y} width={object.width} height={object.height} rx={18} {...props} /> : null}
                          <text x={object.x + object.width / 2} y={object.y + object.height / 2} textAnchor="middle" dominantBaseline="middle" className="fill-white text-[13px] font-semibold">{object.tableNumber}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : <p className="p-6 text-sm text-zinc-400">No active floor plan is configured for this venue yet.</p>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Selected location</p>
                <p className="mt-2 text-lg font-semibold text-white">{selectedLocation?.label ?? "Choose a location"}</p>
                <p className="mt-1 text-sm text-zinc-300">{selectedLocation ? `${selectedLocation.section ?? "Main floor"} • Capacity ${selectedLocation.capacity}` : "Tap an available object on the map."}</p>
                <p className="mt-2 text-sm text-zinc-400">Status: {selectedLocation?.status ?? "Unavailable"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Venue details</p>
                <p className="mt-2 text-sm text-zinc-300">{selectedVenue?.googleAddress ?? "Address will appear here once a venue is selected."}</p>
                <p className="mt-2 text-sm text-zinc-400">{selectedVenue?.parkingInformation ?? "Parking instructions will be confirmed after booking."}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-white/10 bg-zinc-950/65 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">3. Experience and bottle server</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {availableExperiences.map((experience) => <button key={experience.id} type="button" onClick={() => setSelectedExperienceId(experience.id)} className={`rounded-2xl border p-4 text-left transition ${effectiveExperienceId === experience.id ? "border-cyan-300/40 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:border-cyan-300/25"}`}><p className="text-sm font-semibold text-white">{experience.label}</p><p className="mt-2 text-sm text-zinc-300">{experience.description}</p></button>)}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select value={selectedServerId ?? ""} onChange={(event) => setSelectedServerId(event.target.value ? Number(event.target.value) : null)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none">
                <option value="">No Preference</option>
                {availableServers.map((server) => <option key={server.id} value={server.id}>{server.label}{server.sectionAssignment ? ` • ${server.sectionAssignment}` : ""}</option>)}
              </select>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">Server selection auto-routes to an available table in that section when possible.</div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-white/10 bg-zinc-950/65 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">4. Bottles and add-ons</p>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                {(selectedVenue?.bottlePackages ?? []).map((item) => {
                  const quantity = bottleQuantities[item.id] ?? 0;
                  return <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{item.label}</p><p className="mt-1 text-sm text-zinc-300">{item.description ?? item.subtitle}</p></div><p className="text-sm font-medium text-cyan-100">{formatMoney(item.amountCents)}</p></div><div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => setBottleQuantities((current) => ({ ...current, [item.id]: Math.max((current[item.id] ?? 0) - 1, 0) }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">-</button><span className="min-w-6 text-center text-sm text-white">{quantity}</span><button type="button" onClick={() => setBottleQuantities((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">+</button></div></div>;
                })}
              </div>
              <div className="space-y-3">
                {(selectedVenue?.addons ?? []).map((item) => {
                  const quantity = addonQuantities[item.id] ?? 0;
                  return <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-white">{item.label}</p><p className="mt-1 text-sm text-zinc-300">{item.description ?? item.subtitle}</p></div><p className="text-sm font-medium text-cyan-100">{formatMoney(item.amountCents)}</p></div><div className="mt-3 flex items-center gap-3"><button type="button" onClick={() => setAddonQuantities((current) => ({ ...current, [item.id]: Math.max((current[item.id] ?? 0) - 1, 0) }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">-</button><span className="min-w-6 text-center text-sm text-white">{quantity}</span><button type="button" onClick={() => setAddonQuantities((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">+</button></div></div>;
                })}
              </div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-white/10 bg-zinc-950/65 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">5. Share bill and notes</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {options.friends.map((friend) => {
                const selected = selectedFriendIds.includes(friend.userId);
                return <button key={friend.userId} type="button" onClick={() => setSelectedFriendIds((current) => selected ? current.filter((id) => id !== friend.userId) : [...current, friend.userId])} className={`rounded-2xl border p-4 text-left ${selected ? "border-cyan-300/40 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}><p className="text-sm font-semibold text-white">{friend.displayName}</p><p className="mt-1 text-xs text-zinc-400">@{friend.handle}</p></button>;
              })}
            </div>
            {splitShares.length > 0 ? <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">{splitShares.map((share) => { const key = share.isHost ? "host" : String(share.friendUserId); return <label key={key} className="flex items-center justify-between gap-3 text-sm text-zinc-200"><span>{share.displayName}</span><input value={share.amountCents} onChange={(event) => setSplitAmounts((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))} type="number" min={0} step={100} className="w-32 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-right text-white outline-none" /></label>; })}</div> : null}
            <div className="mt-4 space-y-3">
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Arrival instructions, occasion, or host notes." className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <textarea value={inspirationText} onChange={(event) => setInspirationText(event.target.value)} rows={3} placeholder="Artists, prior reservations, or venue references." className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              <textarea value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} rows={3} placeholder="Parking, flowers, signage, cake, security, accessibility, and other venue add-ons." className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[1.4rem] border border-cyan-300/20 bg-cyan-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Reservation summary</p>
            <h4 className="mt-2 text-xl font-semibold text-white">{selectedVenue?.title ?? "Choose a venue"}</h4>
            <p className="mt-2 text-sm text-cyan-50/85">{selectedLocation ? `${selectedLocation.label} • ${selectedLocation.section ?? "Main floor"}` : "Select a location to continue."}</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-100">
              <div className="flex items-center justify-between gap-3"><span>Experience</span><span>{availableExperiences.find((item) => item.id === effectiveExperienceId)?.label ?? "Pending"}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Minimum spend</span><span>{formatMoney(summary.minimumSpend)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Reservation fee</span><span>{formatMoney(summary.reservationFee)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Bottle subtotal</span><span>{formatMoney(summary.bottleSubtotal)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Add-ons</span><span>{formatMoney(summary.addonSubtotal)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Service fees</span><span>{formatMoney(summary.serviceFeeCents)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Taxes</span><span>{formatMoney(summary.taxCents)}</span></div>
              <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 font-semibold text-white"><span>Total</span><span>{formatMoney(summary.totalCents)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Due now</span><span>{formatMoney(summary.dueNowCents)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Remaining</span><span>{formatMoney(summary.remainingBalanceCents)}</span></div>
            </div>
          </section>

          <section className="rounded-[1.4rem] border border-white/10 bg-zinc-950/65 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Payment plan</p>
            <div className="mt-4 space-y-3">
              <button type="button" onClick={() => setPaymentOption("deposit_only")} className={`w-full rounded-2xl border p-4 text-left ${paymentOption === "deposit_only" ? "border-cyan-300/40 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}><p className="text-sm font-semibold text-white">Deposit only</p><p className="mt-1 text-sm text-zinc-300">Pay {formatMoney(summary.dueNowCents)} now.</p></button>
              <button type="button" onClick={() => setPaymentOption("pay_in_full")} className={`w-full rounded-2xl border p-4 text-left ${paymentOption === "pay_in_full" ? "border-cyan-300/40 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}><p className="text-sm font-semibold text-white">Pay in full</p><p className="mt-1 text-sm text-zinc-300">Confirm the complete reservation balance today.</p></button>
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={!canSubmit} className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">Submit request</button>
            <button type="submit" name="submissionMode" value="draft" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-cyan-500/10">Save draft</button>
            <Link href="/concierge" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10">Ask concierge first</Link>
          </div>
        </aside>
      </div>
    </form>
  );
}
