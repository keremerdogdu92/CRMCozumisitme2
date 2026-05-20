// src/pages/SettingsPage.tsx
// Settings page that hosts operational imports and organization settings.

import { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { PatientsImportSection } from '../features/patients/ui';
import { LegacyDevicesImportSection } from '../features/patients/components/import/LegacyDevicesImportSection';
import { ImportFixCenterSection } from '../features/patients/import/ImportFixCenterSection';
import { InventoryImportCard } from '../features/inventory/InventoryImportCard';
import { DeviceCatalogImportCard } from '../features/inventory/deviceCatalog/DeviceCatalogImportCard';
import { CatalogPriceListCard } from '../features/inventory/deviceCatalog/CatalogPriceListCard';
import { OrgSettingsCard } from '../features/settings/OrgSettingsCard';
import { SgkReimbursementSettingsCard } from '../features/settings/SgkReimbursementSettingsCard';
import { MeetingSatisfactionSettingsCard } from '../features/meetings/MeetingSatisfactionSettingsCard';

export default function SettingsPage() {
  const [inventoryImportOpen, setInventoryImportOpen] = useState(true);
  const [deviceCatalogImportOpen, setDeviceCatalogImportOpen] =
    useState(false);

  return (
    <PageLayout
      header={
        <PageHeader
          title="Ayarlar"
          subtitle="Veri import araclarini, organizasyon bilgilerini ve operasyonel ayarlari yonetin."
        />
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        <OrgSettingsCard />
        <MeetingSatisfactionSettingsCard />
        <SgkReimbursementSettingsCard />

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Cihaz Katalog Fiyat Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Marka, model, urun tipi ve fiyatlari katalog tablosuna yukler.
                Stok kaydi olusturmaz; stok import ve manuel stok ekleme bu
                katalogdan fiyat eslestirir.
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
                Formu Ac
              </button>
            </div>
          )}
        </section>

        <CatalogPriceListCard />

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Stok CSV Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Once fiyat katalog listesini kontrol edin, sonra stok CSV
                dosyanizi yukleyin. Hata veren satirlar Import Fix Center
                uzerinden duzeltilebilir.
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
                Formu Ac
              </button>
            </div>
          )}
        </section>

        <ImportFixCenterSection />

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Hasta CSV Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Hasta CSV dosyalarini staged import pipeline uzerinden yukler.
              </p>
            </div>
          </div>
          <PatientsImportSection />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Eski Hasta Cihaz Import
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Eski hasta-cihaz CSV kayitlarini staging alanina alir ve mevcut
                hastalarla eslestirmek icin kullanilir.
              </p>
            </div>
          </div>
          <LegacyDevicesImportSection />
        </section>
      </div>
    </PageLayout>
  );
}
