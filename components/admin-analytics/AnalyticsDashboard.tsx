"use client";

import { useMemo, useState } from "react";

import BottomNav from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import ChartCard from "@/components/admin-analytics/ChartCard";
import DateFilter from "@/components/admin-analytics/DateFilter";
import MetricGrid from "@/components/admin-analytics/MetricGrid";
import PlaceholderBarChart from "@/components/admin-analytics/PlaceholderBarChart";
import PlaceholderLineChart from "@/components/admin-analytics/PlaceholderLineChart";
import TrendBadge from "@/components/admin-analytics/TrendBadge";
import { DateFilterKey, MetricItem } from "@/components/admin-analytics/types";

const metricSets: Record<DateFilterKey, MetricItem[]> = {
  "7d": [
    { label: "App Downloads", value: "42,816", delta: "+7.2%", trend: "up", detail: "vs previous 7 days" },
    { label: "App Installs", value: "31,504", delta: "+5.1%", trend: "up", detail: "install rate 73.6%" },
    { label: "First Opens", value: "28,972", delta: "+4.8%", trend: "up", detail: "from fresh installs" },
    { label: "New Accounts", value: "10,438", delta: "+3.9%", trend: "up", detail: "signup completion" },
    { label: "Daily Active Users", value: "14,260", delta: "+6.4%", trend: "up", detail: "rolling 24h" },
    { label: "Monthly Active Users", value: "128,910", delta: "+2.2%", trend: "up", detail: "active in last 30d" },
    { label: "Premium Trials", value: "3,104", delta: "+3.1%", trend: "up", detail: "trial starts" },
    { label: "Paid Subscribers", value: "1,846", delta: "+2.6%", trend: "up", detail: "active paid" },
    { label: "Trial Conversion %", value: "59.5%", delta: "-0.8%", trend: "down", detail: "trial to paid" },
    { label: "Monthly Recurring Revenue", value: "$36,920", delta: "+4.3%", trend: "up", detail: "projected MRR" },
    { label: "Churn Rate", value: "4.1%", delta: "+0.2%", trend: "down", detail: "paid user churn" },
    { label: "Cancellations", value: "76", delta: "+5", trend: "down", detail: "last 7 days" },
  ],
  "30d": [
    { label: "App Downloads", value: "169,420", delta: "+11.4%", trend: "up", detail: "vs previous 30 days" },
    { label: "App Installs", value: "126,081", delta: "+8.6%", trend: "up", detail: "install rate 74.4%" },
    { label: "First Opens", value: "116,394", delta: "+8.2%", trend: "up", detail: "new devices" },
    { label: "New Accounts", value: "43,980", delta: "+6.9%", trend: "up", detail: "completed onboarding" },
    { label: "Daily Active Users", value: "15,010", delta: "+7.7%", trend: "up", detail: "average daily" },
    { label: "Monthly Active Users", value: "131,204", delta: "+4.1%", trend: "up", detail: "active users" },
    { label: "Premium Trials", value: "12,208", delta: "+5.6%", trend: "up", detail: "trial starts" },
    { label: "Paid Subscribers", value: "7,318", delta: "+4.7%", trend: "up", detail: "active paid" },
    { label: "Trial Conversion %", value: "60.0%", delta: "+0.9%", trend: "up", detail: "trial to paid" },
    { label: "Monthly Recurring Revenue", value: "$151,640", delta: "+9.2%", trend: "up", detail: "recognized MRR" },
    { label: "Churn Rate", value: "3.6%", delta: "-0.4%", trend: "up", detail: "paid user churn" },
    { label: "Cancellations", value: "282", delta: "-16", trend: "up", detail: "last 30 days" },
  ],
  "90d": [
    { label: "App Downloads", value: "492,105", delta: "+15.8%", trend: "up", detail: "vs previous 90 days" },
    { label: "App Installs", value: "366,942", delta: "+12.3%", trend: "up", detail: "install rate 74.6%" },
    { label: "First Opens", value: "339,114", delta: "+11.6%", trend: "up", detail: "first app session" },
    { label: "New Accounts", value: "126,972", delta: "+9.5%", trend: "up", detail: "account creations" },
    { label: "Daily Active Users", value: "15,840", delta: "+8.9%", trend: "up", detail: "average daily" },
    { label: "Monthly Active Users", value: "136,480", delta: "+7.4%", trend: "up", detail: "active users" },
    { label: "Premium Trials", value: "34,220", delta: "+7.8%", trend: "up", detail: "trial starts" },
    { label: "Paid Subscribers", value: "20,148", delta: "+7.1%", trend: "up", detail: "active paid" },
    { label: "Trial Conversion %", value: "58.9%", delta: "-0.5%", trend: "down", detail: "trial to paid" },
    { label: "Monthly Recurring Revenue", value: "$418,440", delta: "+12.7%", trend: "up", detail: "recognized MRR" },
    { label: "Churn Rate", value: "3.9%", delta: "+0.1%", trend: "down", detail: "paid user churn" },
    { label: "Cancellations", value: "892", delta: "+34", trend: "down", detail: "last 90 days" },
  ],
};

const downloadsTrend: Record<DateFilterKey, number[]> = {
  "7d": [58, 61, 64, 66, 62, 68, 72],
  "30d": [42, 46, 49, 55, 57, 60, 64, 66, 69, 72, 75, 77],
  "90d": [35, 38, 43, 47, 51, 54, 58, 61, 65, 69, 72, 75],
};

const engagementTrend: Record<DateFilterKey, number[]> = {
  "7d": [62, 66, 68, 70, 73, 71, 75],
  "30d": [55, 57, 60, 63, 65, 64, 66, 68, 71, 72, 74, 76],
  "90d": [48, 50, 53, 56, 58, 61, 63, 66, 69, 70, 72, 74],
};

const revenueBars: Record<DateFilterKey, number[]> = {
  "7d": [42, 45, 48, 52, 50, 57, 60],
  "30d": [38, 41, 45, 47, 52, 54, 58, 61, 63, 66, 68, 72],
  "90d": [32, 36, 40, 44, 46, 50, 53, 56, 60, 64, 67, 70],
};

export default function AnalyticsDashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("30d");

  const metrics = useMemo(() => metricSets[dateFilter], [dateFilter]);
  const downloadsData = useMemo(() => downloadsTrend[dateFilter], [dateFilter]);
  const engagementData = useMemo(() => engagementTrend[dateFilter], [dateFilter]);
  const revenueData = useMemo(() => revenueBars[dateFilter], [dateFilter]);

  return (
    <div className="min-h-screen bg-[#04070b] text-zinc-100 antialiased">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,179,255,0.16),_transparent_30%),radial-gradient(circle_at_90%_10%,_rgba(155,92,255,0.16),_transparent_22%)]" />

        <Navbar />

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Admin</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">Nightly Analytics Dashboard</h1>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Placeholder analytics for acquisition, engagement, and subscriptions while live data connections are in progress.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <DateFilter selected={dateFilter} onChange={setDateFilter} />
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Placeholder Data • No Live Tracking</p>
              </div>
            </div>

            <div className="mt-8">
              <MetricGrid metrics={metrics} />
            </div>
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ChartCard title="Acquisition Trend" subtitle="Downloads to first opens">
                <PlaceholderLineChart points={downloadsData} />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <TrendBadge delta="+8.6% installs" trend="up" />
                  <TrendBadge delta="+6.9% new accounts" trend="up" />
                  <TrendBadge delta="-0.8% trial conversion" trend="down" />
                </div>
              </ChartCard>
            </div>

            <div className="xl:col-span-5">
              <ChartCard title="Revenue Momentum" subtitle="Subscription health">
                <PlaceholderBarChart values={revenueData} />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <TrendBadge delta="+9.2% MRR" trend="up" />
                  <TrendBadge delta="3.6% churn" trend="flat" />
                  <TrendBadge delta="-16 cancellations" trend="up" />
                </div>
              </ChartCard>
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <ChartCard title="Engagement Pulse" subtitle="DAU and MAU movement">
              <PlaceholderLineChart points={engagementData} strokeClassName="stroke-violet-300" />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <TrendBadge delta="+7.7% DAU" trend="up" />
                <TrendBadge delta="+4.1% MAU" trend="up" />
              </div>
            </ChartCard>

            <ChartCard title="Conversion Funnel Snapshot" subtitle="Current period">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Downloads", value: "169K" },
                  { label: "Installs", value: "126K" },
                  { label: "First Opens", value: "116K" },
                  { label: "Accounts", value: "44K" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                Monitor funnel drop-off and retention quality once live analytics are connected to the backend pipeline.
              </div>
            </ChartCard>
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
