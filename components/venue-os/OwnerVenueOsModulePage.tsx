import Link from "next/link";

import {
  addVenueStaffCertificationAction,
  clockInVenueStaffAction,
  clockOutVenueStaffAction,
  createVenueAiInsightRequestAction,
  createVenueBottlePackageAction,
  createVenueCustomerNoteAction,
  createVenueCustomerProfileAction,
  createVenueFloorObjectAction,
  createVenueFloorPlanAction,
  createVenueIncidentReportAction,
  createVenueInventoryItemAction,
  createVenueInventoryMovementAction,
  createVenueLoyaltyLedgerAction,
  createVenueLoyaltyRewardAction,
  createVenueMarketingCampaignAction,
  createVenueOperationPlanAction,
  createVenueOperationTaskAction,
  createVenuePurchaseOrderAction,
  createVenueShiftAction,
  createVenueShiftRequestAction,
  createVenueStaffProfileAction,
  createVenueSupplierAction,
  createVenueVipReservationAction,
  inviteVenueStaffAction,
  saveVenueStaffAvailabilityAction,
  updateVenueStaffStatusAction,
} from "@/app/owner/venue-os-actions";
import { getVenueOsDashboardData, getVenueOsSectionData } from "@/lib/venue-os/data";
import type { VenueOsModuleKey } from "@/lib/venue-os/types";

type RenderMetric = { label: string; value: string; detail?: string };
type RenderQueueItem = { id: number | string; title: string; subtitle?: string; status?: string; detail?: string };

const ownerRouteByModule: Record<VenueOsModuleKey, string> = {
  operations: "/owner/operations",
  staff: "/owner/staff",
  scheduling: "/owner/scheduling",
  floor: "/owner/floor",
  tables: "/owner/tables",
  vip: "/owner/vip",
  inventory: "/owner/inventory",
  crm: "/owner/crm",
  marketing: "/owner/marketing",
  loyalty: "/owner/loyalty",
  reports: "/owner/reports",
};

function FormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white ${props.className ?? ""}`} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white ${props.className ?? ""}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white ${props.className ?? ""}`} />;
}

function SubmitButton({ label }: { label: string }) {
  return <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-100">{label}</button>;
}

function ModuleForms({ moduleKey }: { moduleKey: VenueOsModuleKey }) {
  switch (moduleKey) {
    case "staff":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={inviteVenueStaffAction}><FormShell title="Invite staff"><Input name="email" placeholder="staff@venue.com" /><Input name="firstName" placeholder="First name" /><Input name="lastName" placeholder="Last name" /><Input name="jobTitle" placeholder="Job title" /><Input name="department" placeholder="operations / security / vip" /><Textarea name="permissions" rows={3} placeholder="One permission per line" /><Input name="expiresAt" type="datetime-local" /><SubmitButton label="Send invitation" /></FormShell></form>
          <form action={createVenueStaffProfileAction}><FormShell title="Add staff profile"><Input name="firstName" placeholder="First name" /><Input name="lastName" placeholder="Last name" /><Input name="email" placeholder="Email" /><Input name="phone" placeholder="Phone" /><Input name="jobTitle" placeholder="Job title" /><Input name="department" placeholder="Department" /><Input name="hourlyRateCents" type="number" placeholder="Hourly rate cents" /><Input name="hiredAt" type="datetime-local" /><Textarea name="permissions" rows={3} placeholder="One permission per line" /><SubmitButton label="Create staff" /></FormShell></form>
          <form action={updateVenueStaffStatusAction}><FormShell title="Update staff status"><Input name="staffProfileId" type="number" placeholder="Staff profile ID" /><Select name="status" defaultValue="active"><option value="active">Active</option><option value="suspended">Suspended</option><option value="terminated">Terminated</option></Select><SubmitButton label="Update status" /></FormShell></form>
          <form action={addVenueStaffCertificationAction}><FormShell title="Add certification"><Input name="staffProfileId" type="number" placeholder="Staff profile ID" /><Input name="certificationName" placeholder="Certification name" /><Input name="issuer" placeholder="Issuer" /><Input name="issuedAt" type="datetime-local" /><Input name="expiresAt" type="datetime-local" /><SubmitButton label="Add certification" /></FormShell></form>
        </div>
      );
    case "scheduling":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueShiftAction}><FormShell title="Create shift"><Input name="shiftTitle" placeholder="Weekend door lead" /><Input name="roleLabel" placeholder="Door lead" /><Input name="department" placeholder="door / bar / security" /><Input name="staffProfileId" type="number" placeholder="Assigned staff ID" /><Input name="startsAt" type="datetime-local" /><Input name="endsAt" type="datetime-local" /><Input name="overtimeWarningMinutes" type="number" placeholder="Overtime warning minutes" /><SubmitButton label="Create shift" /></FormShell></form>
          <form action={createVenueShiftRequestAction}><FormShell title="Shift request"><Input name="shiftId" type="number" placeholder="Shift ID" /><Input name="requesterStaffProfileId" type="number" placeholder="Requester staff ID" /><Input name="targetStaffProfileId" type="number" placeholder="Target staff ID" /><Select name="requestType" defaultValue="swap"><option value="swap">Swap</option><option value="cover">Cover</option><option value="drop">Drop</option><option value="time_off">Time off</option><option value="open_claim">Open claim</option></Select><Textarea name="reason" rows={3} placeholder="Reason" /><SubmitButton label="Create request" /></FormShell></form>
          <form action={saveVenueStaffAvailabilityAction}><FormShell title="Staff availability"><Input name="staffProfileId" type="number" placeholder="Staff profile ID" /><Input name="dayOfWeek" type="number" placeholder="0-6" /><Input name="startTime" placeholder="18:00" /><Input name="endTime" placeholder="02:30" /><Textarea name="unavailableDates" rows={3} placeholder="YYYY-MM-DD per line" /><SubmitButton label="Save availability" /></FormShell></form>
          <div className="grid gap-4 sm:grid-cols-2"><form action={clockInVenueStaffAction}><FormShell title="Clock in"><Input name="staffProfileId" type="number" placeholder="Staff profile ID" /><Input name="shiftId" type="number" placeholder="Shift ID" /><SubmitButton label="Clock in" /></FormShell></form><form action={clockOutVenueStaffAction}><FormShell title="Clock out"><Input name="timeEntryId" type="number" placeholder="Time entry ID" /><Input name="breakMinutesTotal" type="number" placeholder="Break minutes" /><SubmitButton label="Clock out" /></FormShell></form></div>
        </div>
      );
    case "operations":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueOperationPlanAction}><FormShell title="Create run of show"><Input name="planType" placeholder="run_of_show / opening / closing" /><Input name="title" placeholder="Saturday main room ops" /><Textarea name="summary" rows={3} placeholder="Summary" /><Input name="scheduledFor" type="datetime-local" /><SubmitButton label="Create plan" /></FormShell></form>
          <form action={createVenueOperationTaskAction}><FormShell title="Assign task"><Input name="planId" type="number" placeholder="Plan ID" /><Input name="title" placeholder="Front door brief" /><Input name="assignedStaffProfileId" type="number" placeholder="Assigned staff ID" /><Input name="dueAt" type="datetime-local" /><Textarea name="checklist" rows={3} placeholder="Checklist items, one per line" /><SubmitButton label="Create task" /></FormShell></form>
          <form action={createVenueIncidentReportAction}><FormShell title="Incident report"><Input name="eventId" type="number" placeholder="Event ID" /><Input name="reportedByStaffProfileId" type="number" placeholder="Reporter staff ID" /><Select name="severity" defaultValue="low"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select><Input name="category" placeholder="Security / operations / guest" /><Input name="summary" placeholder="Short summary" /><Textarea name="details" rows={3} placeholder="Details" /><SubmitButton label="Log incident" /></FormShell></form>
        </div>
      );
    case "floor":
    case "tables":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueFloorPlanAction}><FormShell title="Create floor plan"><Input name="name" placeholder="Main room plan" /><Input name="width" type="number" placeholder="Width" /><Input name="height" type="number" placeholder="Height" /><Input name="backgroundImageUrl" placeholder="Background image URL" /><SubmitButton label="Create floor plan" /></FormShell></form>
          <form action={createVenueFloorObjectAction}><FormShell title="Add floor object"><Input name="floorPlanId" type="number" placeholder="Floor plan ID" /><Input name="objectType" placeholder="table / vip / bar / exit" /><Input name="label" placeholder="Object label" /><Input name="sectionName" placeholder="Section" /><Input name="capacity" type="number" placeholder="Capacity" /><div className="grid gap-3 sm:grid-cols-2"><Input name="x" type="number" placeholder="X" /><Input name="y" type="number" placeholder="Y" /><Input name="width" type="number" placeholder="Width" /><Input name="height" type="number" placeholder="Height" /></div><SubmitButton label="Add object" /></FormShell></form>
        </div>
      );
    case "vip":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueVipReservationAction}><FormShell title="Create VIP reservation"><Input name="reservationName" placeholder="Birthday table" /><Input name="partySize" type="number" placeholder="Party size" /><Input name="minimumSpendCents" type="number" placeholder="Minimum spend cents" /><Input name="arrivalAt" type="datetime-local" /><Input name="eventId" type="number" placeholder="Event ID" /><Input name="customerProfileId" type="number" placeholder="Customer profile ID" /><Input name="floorObjectId" type="number" placeholder="Floor object ID" /><SubmitButton label="Create reservation" /></FormShell></form>
          <form action={createVenueBottlePackageAction}><FormShell title="Create bottle package"><Input name="name" placeholder="Champagne starter" /><Input name="priceCents" type="number" placeholder="Price cents" /><Textarea name="packageItems" rows={3} placeholder="Package items, one per line" /><Textarea name="mixers" rows={3} placeholder="Mixers, one per line" /><Textarea name="addOns" rows={3} placeholder="Add-ons, one per line" /><SubmitButton label="Create package" /></FormShell></form>
        </div>
      );
    case "inventory":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueSupplierAction}><FormShell title="Add supplier"><Input name="name" placeholder="Supplier name" /><Input name="contactName" placeholder="Contact name" /><Input name="email" placeholder="Email" /><Input name="phone" placeholder="Phone" /><Input name="leadTimeDays" type="number" placeholder="Lead time days" /><SubmitButton label="Create supplier" /></FormShell></form>
          <form action={createVenueInventoryItemAction}><FormShell title="Add inventory item"><Input name="name" placeholder="Item name" /><Input name="sku" placeholder="SKU" /><Input name="category" placeholder="Category" /><Input name="unitLabel" placeholder="Unit" /><Input name="onHandQuantity" type="number" placeholder="On hand" /><Input name="reorderThreshold" type="number" placeholder="Reorder threshold" /><Input name="parQuantity" type="number" placeholder="Par quantity" /><SubmitButton label="Create item" /></FormShell></form>
          <form action={createVenueInventoryMovementAction}><FormShell title="Inventory movement"><Input name="itemId" type="number" placeholder="Item ID" /><Select name="movementType" defaultValue="receive"><option value="receive">Receive</option><option value="consume">Consume</option><option value="adjust">Adjust</option><option value="count">Count</option><option value="waste">Waste</option><option value="damage">Damage</option><option value="transfer">Transfer</option></Select><Input name="quantity" type="number" placeholder="Quantity" /><Textarea name="notes" rows={3} placeholder="Movement notes" /><SubmitButton label="Record movement" /></FormShell></form>
          <form action={createVenuePurchaseOrderAction}><FormShell title="Purchase order"><Input name="supplierId" type="number" placeholder="Supplier ID" /><Textarea name="items" rows={3} placeholder="Line items, one per line" /><Input name="subtotalCents" type="number" placeholder="Subtotal cents" /><Input name="taxCents" type="number" placeholder="Tax cents" /><Input name="totalCents" type="number" placeholder="Total cents" /><Input name="expectedAt" type="datetime-local" /><SubmitButton label="Create PO" /></FormShell></form>
        </div>
      );
    case "crm":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueCustomerProfileAction}><FormShell title="Create customer profile"><Input name="fullName" placeholder="Full name" /><Input name="email" placeholder="Email" /><Input name="phone" placeholder="Phone" /><Textarea name="favoriteGenres" rows={3} placeholder="Favorite genres, one per line" /><Textarea name="tags" rows={3} placeholder="Tags, one per line" /><label className="flex items-center gap-3 text-sm text-zinc-200"><input name="marketingEligible" type="checkbox" className="h-4 w-4 accent-cyan-500" /> Marketing eligible</label><SubmitButton label="Create profile" /></FormShell></form>
          <form action={createVenueCustomerNoteAction}><FormShell title="Add customer note"><Input name="customerProfileId" type="number" placeholder="Customer profile ID" /><Input name="authorStaffProfileId" type="number" placeholder="Author staff ID" /><Input name="visibility" placeholder="internal / vip" /><Textarea name="note" rows={4} placeholder="Note" /><SubmitButton label="Add note" /></FormShell></form>
        </div>
      );
    case "marketing":
      return (
        <form action={createVenueMarketingCampaignAction}><FormShell title="Create campaign"><Input name="name" placeholder="Campaign name" /><Input name="audienceLabel" placeholder="Audience label" /><Select name="channel" defaultValue="push"><option value="push">Push</option><option value="email">Email</option><option value="sms">SMS</option><option value="in_app">In-app</option></Select><Input name="segment" placeholder="birthday / lapsed / vip / promo" /><Input name="subject" placeholder="Message subject" /><Textarea name="body" rows={4} placeholder="Campaign body" /><Input name="scheduledAt" type="datetime-local" /><SubmitButton label="Create campaign" /></FormShell></form>
      );
    case "loyalty":
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          <form action={createVenueLoyaltyRewardAction}><FormShell title="Create reward"><Input name="name" placeholder="Reward name" /><Textarea name="description" rows={3} placeholder="Description" /><Input name="pointsCost" type="number" placeholder="Points cost" /><Select name="tierRequired" defaultValue="bronze"><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option></Select><Input name="benefitDetail" placeholder="Benefit detail" /><SubmitButton label="Create reward" /></FormShell></form>
          <form action={createVenueLoyaltyLedgerAction}><FormShell title="Adjust points"><Input name="customerProfileId" type="number" placeholder="Customer profile ID" /><Input name="rewardId" type="number" placeholder="Reward ID" /><Input name="entryType" placeholder="earn / redeem / referral" /><Input name="pointsDelta" type="number" placeholder="Points delta" /><Input name="spendCents" type="number" placeholder="Spend cents" /><Textarea name="description" rows={3} placeholder="Description" /><SubmitButton label="Create ledger entry" /></FormShell></form>
        </div>
      );
    case "reports":
      return (
        <form action={createVenueAiInsightRequestAction}><FormShell title="Request AI insight"><Select name="insightType" defaultValue="operational_summary"><option value="attendance_forecast">Attendance forecast</option><option value="revenue_forecast">Revenue forecast</option><option value="inventory_forecast">Inventory forecast</option><option value="staffing_recommendation">Staffing recommendation</option><option value="marketing_recommendation">Marketing recommendation</option><option value="campaign_generation">Campaign generation</option><option value="customer_insight">Customer insight</option><option value="event_scoring">Event scoring</option><option value="operational_summary">Operational summary</option><option value="nightly_recap">Nightly recap</option></Select><Input name="eventId" type="number" placeholder="Event ID (optional)" /><Input name="timeWindow" placeholder="Tonight / weekend / next 30 days" /><Textarea name="notes" rows={4} placeholder="Input notes for the request" /><SubmitButton label="Queue insight" /></FormShell></form>
      );
    default:
      return null;
  }
}

export default async function OwnerVenueOsModulePage({ moduleKey }: { moduleKey: VenueOsModuleKey }) {
  const [dashboard, section] = await Promise.all([getVenueOsDashboardData(), getVenueOsSectionData(moduleKey)]);
  const route = ownerRouteByModule[moduleKey];
  const normalizedMetrics: RenderMetric[] = section.metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    detail: "detail" in metric && typeof metric.detail === "string" ? metric.detail : undefined,
  }));
  const primaryQueue: RenderQueueItem[] = section.primaryQueue.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: "subtitle" in item ? item.subtitle : undefined,
    status: "status" in item ? item.status : undefined,
    detail: item.detail,
  }));
  const secondaryQueue: RenderQueueItem[] = (section.secondaryQueue ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: "subtitle" in item ? item.subtitle : undefined,
    status: "status" in item ? item.status : undefined,
    detail: item.detail,
  }));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_90%_8%,_rgba(167,139,250,0.14),_transparent_25%),linear-gradient(140deg,_#04070b_0%,_#090d18_55%,_#111326_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.1)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">VenueOS</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{section.title}</h1>
            <p className="mt-3 max-w-3xl text-base text-zinc-300">{section.description}</p>
            <p className="mt-2 text-sm text-zinc-500">{dashboard.venue.name} • {dashboard.venue.city ?? "City not set"} • {dashboard.role}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            {dashboard.metrics.slice(0, 4).map((metric) => (
              <span key={metric.label} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">{metric.label}: {metric.value}</span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/owner" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Dashboard</Link>
          <Link href="/admin/venue-os" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">Admin overview</Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {normalizedMetrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              {metric.detail ? <p className="mt-1 text-xs text-zinc-400">{metric.detail}</p> : null}
            </article>
          ))}
        </div>

        <div className="mt-6">
          <ModuleForms moduleKey={moduleKey} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Primary queue</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">{primaryQueue.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {primaryQueue.length === 0 ? <p className="text-sm text-zinc-500">No records yet.</p> : null}
              {primaryQueue.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  {item.subtitle ? <p className="mt-1 text-xs text-zinc-400">{item.subtitle}</p> : null}
                  {item.status ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200">{item.status}</p> : null}
                  {item.detail ? <p className="mt-2 text-sm text-zinc-300">{item.detail}</p> : null}
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Secondary queue</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">{secondaryQueue.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {secondaryQueue.length === 0 ? <p className="text-sm text-zinc-500">No secondary queue items.</p> : null}
              {secondaryQueue.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  {item.subtitle ? <p className="mt-1 text-xs text-zinc-400">{item.subtitle}</p> : null}
                  {item.status ? <p className="mt-2 text-xs uppercase tracking-[0.16em] text-fuchsia-200">{item.status}</p> : null}
                  {item.detail ? <p className="mt-2 text-sm text-zinc-300">{item.detail}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={route} className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-5 py-3 text-sm font-medium text-cyan-100">Refresh {section.title}</Link>
          <Link href="/owner" className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-zinc-200">Back to owner dashboard</Link>
        </div>
      </div>
    </main>
  );
}