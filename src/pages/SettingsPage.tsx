// src/pages/SettingsPage.tsx
// Settings page that hosts data import tools for patients (v2), legacy devices,
// inventory and the unified Import Fix Center.

import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { PatientsImportSection } from '../features/patients/ui';
import { InventoryImportCard } from '../features/inventory/InventoryImportCard';
import { LegacyDevicesImportSection } from '../features/patients/components/import/LegacyDevicesImportSection';
import { ImportFixCenterSection } from '../features/patients/import/ImportFixCenterSection';

export default function SettingsPage() {
  // Local toggle state for the inventory import card
  const [inventoryImportOpen, setInventoryImportOpen] = useState(false);

  return (
    <PageLayout
      header={
        <PageHeader
          title="Settings"
          subtitle="Manage data import pipelines and other operational tools."
        />
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Patients import (v2) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Patients Import (experimental v2)
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Upload CSV files to run the staged patients import pipeline.
              </p>
            </div>
          </div>
          <PatientsImportSection />
        </section>

        {/* Legacy patient devices import */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Legacy Patient Devices Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Upload legacy patient-device CSV to stage eski hasta cihazları
                and link them to existing patients.
              </p>
            </div>
          </div>
          <LegacyDevicesImportSection />
        </section>

        {/* Import Fix Center: unified error / fix panel for patients + legacy devices */}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Import Fix Center (beta)
              </h3>
              <p className="mt-1 text-xs text-slate-700">
                Review and fix errors for patients and legacy devices imports
                from a single dashboard. Only simple, safe edits are supported;
                complex SGK issues should be fixed in the original CSV or in the
                patient detail screen.
              </p>
            </div>
          </div>
          <ImportFixCenterSection />
        </section>

        {/* Inventory import */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Inventory Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Use the inventory import tool to stage stock items via CSV.
              </p>
            </div>
          </div>
          <InventoryImportCard
            open={inventoryImportOpen}
            onToggle={() => setInventoryImportOpen((prev) => !prev)}
          />
        </section>
      </div>
    </PageLayout>
  );
}
