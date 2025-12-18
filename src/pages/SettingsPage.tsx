// src/pages/SettingsPage.tsx
// Settings page that hosts data import tools for patients (v2),
// legacy devices, import fix center, inventory stock imports,
// device catalog price imports and organization-level offer settings.

import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { PatientsImportSection } from '../features/patients/ui';
import { LegacyDevicesImportSection } from '../features/patients/components/import/LegacyDevicesImportSection';
import { ImportFixCenterSection } from '../features/patients/import/ImportFixCenterSection';
import { InventoryImportCard } from '../features/inventory/InventoryImportCard';
import { DeviceCatalogImportCard } from '../features/inventory/deviceCatalog/DeviceCatalogImportCard';
import { OrgSettingsCard } from '../features/settings/OrgSettingsCard';

export default function SettingsPage() {
  // Inventory import kartını default açık yapıyoruz
  const [inventoryImportOpen, setInventoryImportOpen] = useState(true);
  // Device catalog import kartı: varsayılan kapalı (isteğe göre açılır)
  const [deviceCatalogImportOpen, setDeviceCatalogImportOpen] =
    useState(false);

  return (
    <PageLayout
      header={
        <PageHeader
          title="Ayarlar"
          subtitle="Veri import araçlarını, organizasyon bilgilerini ve diğer operasyonel araçları yönetin."
        />
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Organization / Offer Settings */}
        <OrgSettingsCard />

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
                Upload legacy patient-device CSV to stage eski hasta
                cihazları and link them to existing patients.
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

          {inventoryImportOpen ? (
            <InventoryImportCard
              open={inventoryImportOpen}
              onToggle={() => setInventoryImportOpen(false)}
            />
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInventoryImportOpen(true)}
                className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Formu Aç
              </button>
            </div>
          )}
        </section>

        {/* Device catalog prices import (profit calculator / trial tarafı için) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Device Catalog Prices Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Upload CSV files to update device catalog purchase/list prices
                for profit calculator and trial flows. Inventory stok
                kayıtlarını etkilemez, sadece cihaz model kataloğunu
                günceller.
              </p>
            </div>
          </div>

          {deviceCatalogImportOpen ? (
            <DeviceCatalogImportCard
              open={deviceCatalogImportOpen}
              onToggle={() => setDeviceCatalogImportOpen(false)}
            />
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDeviceCatalogImportOpen(true)}
                className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Formu Aç
              </button>
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
