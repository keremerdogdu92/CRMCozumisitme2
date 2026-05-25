// src/pages/SettingsPage.tsx
// Settings page that hosts operational imports and organization settings.

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PageLayout } from '../components/layout/PageLayout';
import { PatientsImportSection } from '../features/patients/ui';
import { LegacyDevicesImportSection } from '../features/patients/components/import/LegacyDevicesImportSection';
import { ImportFixCenterSection } from '../features/patients/import/ImportFixCenterSection';
import { InventoryImportCard } from '../features/inventory/InventoryImportCard';
import { DeviceCatalogImportCard } from '../features/inventory/deviceCatalog/DeviceCatalogImportCard';
import { CatalogPriceListCard } from '../features/inventory/deviceCatalog/CatalogPriceListCard';
import { OrgSettingsCard } from '../features/settings/OrgSettingsCard';
import { AppearanceSettingsCard } from '../features/settings/AppearanceSettingsCard';
import { SgkReimbursementSettingsCard } from '../features/settings/SgkReimbursementSettingsCard';
import { MeetingSatisfactionSettingsCard } from '../features/meetings/MeetingSatisfactionSettingsCard';
import { useCurrentProfile } from '../features/auth/useCurrentProfile';
import { UserProfilesCard } from '../features/settings/UserProfilesCard';

type SettingsTab =
  | 'imports'
  | 'catalog-stock'
  | 'sgk-operations'
  | 'appearance'
  | 'organization';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'imports', label: 'Importlar' },
  { id: 'catalog-stock', label: 'Katalog & Stok' },
  { id: 'sgk-operations', label: 'SGK & Operasyon' },
  { id: 'appearance', label: 'Gorunum' },
  { id: 'organization', label: 'Organizasyon' },
];

function parseSettingsTab(value: string | null): SettingsTab {
  if (
    value === 'imports' ||
    value === 'catalog-stock' ||
    value === 'sgk-operations' ||
    value === 'appearance' ||
    value === 'organization'
  ) {
    return value;
  }

  return 'imports';
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = parseSettingsTab(searchParams.get('tab'));
  const focusParam = searchParams.get('focus');
  const importFixCenterRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl);
  const [inventoryImportOpen, setInventoryImportOpen] = useState(true);
  const [deviceCatalogImportOpen, setDeviceCatalogImportOpen] =
    useState(false);
  const { data: profile } = useCurrentProfile();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (activeTab !== 'imports' || focusParam !== 'fix-center') return;

    const timer = window.setTimeout(() => {
      importFixCenterRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab, focusParam]);

  function handleTabChange(tab: SettingsTab) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    nextParams.delete('focus');
    setActiveTab(tab);
    setSearchParams(nextParams);
  }

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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <div className="flex min-w-max gap-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'imports' && (
          <div className="space-y-4">
            <div ref={importFixCenterRef} id="import-fix-center">
              <ImportFixCenterSection />
            </div>

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

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Hasta CSV Import
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Hasta CSV dosyalarini staged import pipeline uzerinden
                    yukler.
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
                    Eski hasta-cihaz CSV kayitlarini staging alanina alir ve
                    mevcut hastalarla eslestirmek icin kullanilir.
                  </p>
                </div>
              </div>
              <LegacyDevicesImportSection />
            </section>
          </div>
        )}

        {activeTab === 'catalog-stock' && (
          <div className="space-y-4">
            <CatalogPriceListCard />

            {isAdmin && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Cihaz Katalog Fiyat Import
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Marka, model, urun tipi ve fiyatlari katalog tablosuna
                      yukler. Stok kaydi olusturmaz; stok import ve manuel stok
                      ekleme bu katalogdan fiyat eslestirir.
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
            )}
          </div>
        )}

        {activeTab === 'sgk-operations' && (
          <div className="space-y-4">
            {isAdmin ? (
              <>
                <SgkReimbursementSettingsCard />
                <MeetingSatisfactionSettingsCard />
              </>
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                Bu sekme icin admin yetkisi gerekir.
              </section>
            )}
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
            {isAdmin ? (
              <AppearanceSettingsCard />
            ) : (
              <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                Bu sekme icin admin yetkisi gerekir.
              </section>
            )}
          </div>
        )}

        {activeTab === 'organization' && (
          <div className="space-y-4">
            {isAdmin ? (
              <>
                <OrgSettingsCard />
                <UserProfilesCard />
              </>
            ) : (
              <UserProfilesCard />
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
