// src/pages/SettingsPage.tsx
// Settings page that hosts data import tools for patients (v2),
// legacy devices, import fix center and inventory stock imports.

import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { PatientsImportSection } from '../features/patients/ui';
import { LegacyDevicesImportSection } from '../features/patients/components/import/LegacyDevicesImportSection';
import { ImportFixCenterSection } from '../features/patients/import/ImportFixCenterSection';
import { InventoryImportCard } from '../features/inventory/InventoryImportCard';

export default function SettingsPage() {
  // Inventory import kartını default açık yapıyoruz
  const [inventoryImportOpen, setInventoryImportOpen] = useState(true);

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

        {/* Import Fix Center (patients + legacy devices jobs) */}
        <ImportFixCenterSection />

        {/* Inventory stock import */}
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
