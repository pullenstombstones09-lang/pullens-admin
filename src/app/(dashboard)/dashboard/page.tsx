"use client";

import { useAuth } from "@/lib/auth-context";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Bell,
  Wallet,
  CalendarClock,
  ClipboardCheck,
  Banknote,
  Scale,
  Megaphone,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

function StatCard({
  icon,
  label,
  value,
  subtext,
  accentColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  accentColor: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-[#333333] mt-0.5 leading-none">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-400 mt-1.5">{subtext}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface DashboardStats {
  totalStaff: number;
  staffPresent: number;
  pettyCashBalance: number;
  alertCount: number;
  announcements: { id: string; title: string; body: string; created_at: string }[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  const today = new Date();
  const formattedDate = formatDate(today);

  const totalStaff = stats?.totalStaff ?? 0;
  const staffPresent = stats?.staffPresent ?? 0;
  const pettyCashBalance = stats?.pettyCashBalance ?? 0;
  const alertCount = stats?.alertCount ?? 0;
  const announcements = stats?.announcements ?? [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-[#333333]">
          Welcome back, {user?.name || "User"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{formattedDate}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 md:mb-8">
        <StatCard
          icon={<Users className="h-6 w-6" />}
          label="Staff present today"
          value={`${staffPresent}/${totalStaff}`}
          subtext={totalStaff > 0 ? `${Math.round((staffPresent / totalStaff) * 100)}% attendance` : "Loading..."}
          accentColor="#10B981"
        />
        <StatCard
          icon={<Bell className="h-6 w-6" />}
          label="Outstanding alerts"
          value={alertCount}
          subtext="Requires attention"
          accentColor="#EF4444"
        />
        <StatCard
          icon={<Wallet className="h-6 w-6" />}
          label="Petty cash tin"
          value={formatCurrency(pettyCashBalance)}
          subtext="Current balance"
          accentColor="#C4A35A"
        />
        <StatCard
          icon={<CalendarClock className="h-6 w-6" />}
          label="Payroll status"
          value="On track"
          subtext="Next run: Friday"
          accentColor="#6366F1"
        />
      </div>

      {/* Two-column layout: Quick actions + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Quick actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/register">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start"
                    icon={<ClipboardCheck className="h-5 w-5" />}
                  >
                    Open Register
                  </Button>
                </Link>
                <Link href="/payroll">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start"
                    icon={<Banknote className="h-5 w-5" />}
                  >
                    Run Payroll
                  </Button>
                </Link>
                <Link href="/petty-cash">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start"
                    icon={<Wallet className="h-5 w-5" />}
                  >
                    Give Cash
                  </Button>
                </Link>
                <Link href="/hr-advisor">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start"
                    icon={<Scale className="h-5 w-5" />}
                  >
                    HR Advisor
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Announcements */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Recent announcements</CardTitle>
              <Megaphone className="h-5 w-5 text-gray-400" />
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No announcements
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold text-[#333333]">
                          {a.title}
                        </h4>
                        <Badge color="blue">
                          {formatDate(a.created_at)}
                        </Badge>
                      </div>
                      {a.body && (
                        <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                          {a.body}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
