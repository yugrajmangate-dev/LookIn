"use client";

import React from "react";
import { ShieldCheck, Database, Bell } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function SettingsPage(): React.JSX.Element {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure system preferences and data retention policies."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-elevated p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Security</h2>
              <p className="text-xs text-gray-500">Authentication and access controls</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <label htmlFor="mfa-setting" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              Multi-factor authentication
              <input id="mfa-setting" type="checkbox" className="h-4 w-4" />
            </label>
            <label htmlFor="autologout-setting" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              Auto logout after inactivity
              <input id="autologout-setting" type="checkbox" className="h-4 w-4" />
            </label>
          </div>
        </div>

        <div className="card-elevated p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
              <p className="text-xs text-gray-500">Alerts for attendance events</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <label htmlFor="daily-email-setting" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              Daily attendance summary email
              <input id="daily-email-setting" type="checkbox" className="h-4 w-4" />
            </label>
            <label htmlFor="unknown-face-alerts" className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              Unknown face detection alerts
              <input id="unknown-face-alerts" type="checkbox" className="h-4 w-4" />
            </label>
          </div>
        </div>

        <div className="card-elevated p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
              <Database className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Data Retention</h2>
              <p className="text-xs text-gray-500">Manage student records and cleanup</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Graduation Year Cutoff
              </label>
              <input type="number" className="input-field" placeholder="2026" />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button className="btn-secondary w-full justify-center">Run Alumni Cleanup</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
