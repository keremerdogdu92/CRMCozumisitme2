// src/pages/SettingsPage.tsx
// Settings page that hosts data import tools for patients (v2), legacy devices,
// inventory and the Import Fix Center (Phase 1).

import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { PatientsImportSection } from '../features/patients/ui';
import { InventoryImportCard } from '../features/inventory/InventoryImportCard';
import { LegacyDevicesImportSection } from '../features/patients/components/import/LegacyDevicesImportSection';
import { ImportFixCenterSection } from '../features/patients/import/ImportFixCenterSection';

export default function SettingsPage() {
  const [inventoryImportOpen, setInventoryImportOpen] = useState(false);

  return (
    <PageLayout
      header={
        <PageHeader
          title="Settings"
          subtitle="Manage data import pipelines, fix import errors and other operational tools."
        />
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
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

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Import Fix Center (Phase 1)
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Review import jobs, see detailed error rows, and fix individual
                patients or legacy devices directly from staging.
              </p>
            </div>
          </div>
          <ImportFixCenterSection />
        </section>
      </div>
    </PageLayout>
  );
}
