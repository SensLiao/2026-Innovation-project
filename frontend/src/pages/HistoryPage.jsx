import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import "./patient.css";
import Decoration from "../assets/images/main2.png";
import { usePatientStore } from "../stores/usePatientStore";
import { useReportStore } from "../stores/useReportStore";

/**
 * HistoryPage
 * Dashboard-style "History" page
 * - Total Patients comes from usePatientStore
 * - Reports comes from useReportStore
 * - Other sections can still use placeholder data for now
 */

const HistoryPage = () => {
  const { state } = useLocation();

  // -------------------- Patient store --------------------
  const {
    patientStats,
    weeklyPatientStats,
    statsLoading: patientStatsLoading,
    fetchAllPatientStats,
  } = usePatientStore();

  // -------------------- Report store --------------------
  const {
    stats,
    weeklyStats,
    statsLoading: reportStatsLoading,
    weeklyStatsLoading,
    fetchAllStats,
    fetchAllWeeklyStats,
  } = useReportStore();

  useEffect(() => {
    fetchAllPatientStats();
    fetchAllStats();
    fetchAllWeeklyStats();
  }, [fetchAllPatientStats, fetchAllStats, fetchAllWeeklyStats]);

  const dashboardStats = useMemo(
    () => ({
      totalPatients: patientStats?.total ?? 0,
      totalPatientsDelta: weeklyPatientStats?.total ?? 0,
      ctUploaded: stats?.total ?? 0,
      ctUploadedDelta:
        (weeklyStats?.draft ?? 0) +
        (weeklyStats?.revise ?? 0) +
        (weeklyStats?.approved ?? 0),
      reportsDraft: stats?.draft ?? 0,
      reportsApproved: stats?.approved ?? 0,
    }),
    [patientStats, weeklyPatientStats, stats, weeklyStats]
  );

  const workflow = useMemo(
    () => ({
      max: Math.max(
        stats?.total ?? 0,
        stats?.draft ?? 0,
        stats?.revise ?? 0,
        stats?.approved ?? 0,
        1
      ),
      rows: [
        { label: "Draft", value: stats?.draft ?? 0, tone: "blue" },
        { label: "Revising", value: stats?.revise ?? 0, tone: "green" },
        { label: "Approved", value: stats?.approved ?? 0, tone: "green" },
      ],
    }),
    [stats]
  );

  const recentActivity = useMemo(
    () => [
      { user: "Dr. Adams", action: "Approved Report", time: "15 mins ago" },
      { user: "Dr. Chen", action: "Uploaded New Scan", time: "2 hours ago" },
      { user: "Dr. Hu", action: "Segmented Scan", time: "3 hours ago" },
    ],
    []
  );

  const isLoading =
    patientStatsLoading || reportStatsLoading || weeklyStatsLoading;

  return (
    <div className="min-h-screen bg-[#C2DCE7] py-8">
      {/* Decorative blobs */}
      <div className="relative w-full">
        <div className="absolute -right-20 bottom-80 hidden md:block deco-blob-sm" />
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-10 -left-60 z-0 pointer-events-none select-none"
        />

        {/* Fixed-width wrapper */}
        <div className="mx-auto w-[1200px]">
          {/* White sheet */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 relative w-full overflow-hidden min-h-[80vh] pb-16">
            {/* Header */}
            <Header activeTab="history" showLogout={true} />

            {/* Top spacing below header */}
            <div className="mt-8" />

            {isLoading ? (
              <div className="mt-10 p-8 bg-gray-50 rounded-lg">
                <div className="text-center text-gray-500">
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    Loading history data...
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Fetching data from database.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    title="Total Patients"
                    value={formatNumber(dashboardStats.totalPatients)}
                    delta={
                      dashboardStats.totalPatientsDelta > 0
                        ? `+${dashboardStats.totalPatientsDelta}`
                        : ""
                    }
                    deltaNote={
                      dashboardStats.totalPatientsDelta > 0 ? "this week" : ""
                    }
                  />

                  <StatCard
                    title="CT Scans Uploaded"
                    value={formatNumber(dashboardStats.ctUploaded)}
                    delta={
                      dashboardStats.ctUploadedDelta > 0
                        ? `+${dashboardStats.ctUploadedDelta}`
                        : ""
                    }
                    deltaNote={
                      dashboardStats.ctUploadedDelta > 0 ? "this week" : ""
                    }
                  />

                  <ReportsCard
                    draft={dashboardStats.reportsDraft}
                    approved={dashboardStats.reportsApproved}
                  />
                </div>

                {/* Activity Trends */}
                <section className="mt-8 rounded-2xl bg-[#EEF7FF] p-6">
                  <div className="text-xl font-semibold text-slate-800">
                    Activity Trends
                  </div>

                  <div className="mt-5 rounded-xl bg-white border border-slate-100 p-6">
                    <TrendsPlaceholder
                      values={[
                        weeklyPatientStats?.total ?? 0,
                        weeklyStats?.draft ?? 0,
                        weeklyStats?.revise ?? 0,
                        weeklyStats?.approved ?? 0,
                      ]}
                      labels={[
                        "Patients",
                        "Draft",
                        "Revising",
                        "Approved",
                      ]}
                    />
                  </div>
                </section>

                {/* Bottom row */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <section className="rounded-2xl bg-[#EEF7FF] p-6">
                    <div className="text-[16px] font-semibold text-slate-800">
                      Workflow Status
                    </div>

                    <div className="mt-5 rounded-xl bg-white border border-slate-100 p-4 space-y-4">
                      {workflow.rows.map((r) => (
                        <ProgressRow
                          key={r.label}
                          label={r.label}
                          value={r.value}
                          max={workflow.max}
                          tone={r.tone}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl bg-[#EEF7FF] p-6">
                    <div className="text-[16px] font-semibold text-slate-800">
                      Recent Activity
                    </div>

                    <div className="mt-5 rounded-xl bg-white border border-slate-100 p-4">
                      <div className="grid grid-cols-[1fr_1.6fr_auto] gap-3 text-slate-400 text-sm pb-3 border-b">
                        <div>User</div>
                        <div>Action</div>
                        <div className="text-right">Time</div>
                      </div>

                      {recentActivity.map((row, index) => (
                        <ActivityRow
                          key={`${row.user}-${row.time}-${index}`}
                          user={row.user}
                          action={row.action}
                          time={row.time}
                        />
                      ))}

                      {recentActivity.length === 0 && (
                        <div className="py-10 text-center text-slate-500 text-sm">
                          No recent activity yet.
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* Optional: show routed state if you pass it in */}
            {state?.debug && (
              <pre className="mt-8 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto">
                {JSON.stringify(state, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;

/* -------------------- Helpers + Components -------------------- */

function formatNumber(n) {
  if (typeof n !== "number") return String(n ?? "");
  return n.toLocaleString();
}

function StatCard({ title, value, delta, deltaNote }) {
  return (
    <div className="rounded-2xl bg-[#EEF7FF] p-6">
      <div className="text-[16px] text-slate-800 font-medium">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>

      {(delta || deltaNote) && (
        <div className="mt-2 text-sm">
          <span className="text-emerald-600 font-medium">{delta}</span>{" "}
          <span className="text-slate-500">{deltaNote}</span>
        </div>
      )}
    </div>
  );
}

function ReportsCard({ draft, approved }) {
  return (
    <div className="rounded-2xl bg-[#EEF7FF] p-6">
      <div className="text-[16px] text-slate-800 font-medium">Reports</div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <ReportPill label="Draft" value={draft} tone="blue" />
        <ReportPill label="Approved" value={approved} tone="green" />
      </div>
    </div>
  );
}

function ReportPill({ label, value, tone }) {
  const toneClass =
    tone === "green"
      ? "bg-[#DFF7E6] text-slate-800"
      : "bg-[#CDEAFF] text-slate-800";

  return (
    <div className={`rounded-xl p-4 text-center ${toneClass}`}>
      <div className="text-xl font-semibold">{formatNumber(value)}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}

function TrendsPlaceholder({ values = [], labels = [] }) {
  const safeValues = values.length > 0 ? values : [10, 20, 15, 30];
  const safeLabels = labels.length > 0 ? labels : ["A", "B", "C", "D"];
  const maxValue = Math.max(...safeValues, 1);

  return (
    <div className="h-[240px] relative overflow-hidden rounded-xl bg-[#F7FBFF] border border-slate-100">
      <div className="absolute inset-0 flex items-end gap-6 px-10 pb-10">
        {safeValues.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-2xl bg-[#D7E9F8] opacity-70"
            style={{
              height: `${Math.max(28, (value / maxValue) * 150)}px`,
            }}
          />
        ))}
      </div>

      <div className="absolute bottom-3 left-0 right-0 flex justify-between px-10 text-slate-400 text-sm">
        {safeLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function ProgressRow({ label, value, max, tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const barColor = tone === "green" ? "bg-emerald-500" : "bg-sky-500";

  return (
    <div className="grid grid-cols-[110px_1fr_60px] items-center gap-3">
      <div className="text-sm text-slate-600 font-medium">{label}</div>

      <div className="h-5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="text-sm text-slate-500 text-right">{formatNumber(value)}</div>
    </div>
  );
}

function ActivityRow({ user, action, time }) {
  return (
    <div className="grid grid-cols-[1fr_1.6fr_auto] gap-3 py-4 border-b last:border-b-0 items-center">
      <div className="text-slate-600">{user}</div>
      <div className="text-slate-800 font-medium">{action}</div>
      <div className="text-right">
        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
          {time}
        </span>
      </div>
    </div>
  );
}