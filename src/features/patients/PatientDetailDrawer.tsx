// src/features/patients/PatientDetailDrawer.tsx
// Tabbed patient detail drawer using the shared SideDrawer shell and per-tab components.

import { useEffect, useState } from 'react';
import type { PatientRow } from './types';
import { SideDrawer } from '../../components/layout/SideDrawer';
import { PatientDetailInfoTab } from './PatientDetailInfoTab';
import { PatientDetailPaymentsTab } from './PatientDetailPaymentsTab';

type PatientDetailTabId =
  | 'info'
  | 'devices'
  | 'meetings'
  | 'payments'
  | 'audiogram';

type PatientDetailDrawerProps = {
  patient: PatientRow;
  open: boolean;
  onClose: () => void;
  onSave: (values: {
    sgkFlag: boolean;
    sgkPrescriptionReceived: boolean;
    sgkRecordedToSystem: boolean;
  }) => void;
  isSaving: boolean;
  errorMsg?: string;

  // Optional: allow caller to open on a specific tab and with the
  // senet plan form expanded.
  initialTab?: PatientDetailTabId;
  initialShowPlanForm?: boolean;
};

export function PatientDetailDrawer({
  patient,
  open,
  onClose,
  onSave,
  isSaving,
  errorMsg,
  initialTab = 'info',
}: PatientDetailDrawerProps) {
  const [sgkFlag, setSgkFlag] = useState<boolean>(!!patient.sgk_flag);
  const [sgkPrescriptionReceived, setSgkPrescriptionReceived] =
    useState<boolean>(!!patient.sgk_prescription_received);
  const [sgkRecordedToSystem, setSgkRecordedToSystem] =
    useState<boolean>(!!patient.sgk_recorded_to_system);
  const [activeTab, setActiveTab] =
    useState<PatientDetailTabId>(initialTab);

  useEffect(() => {
    setSgkFlag(!!patient.sgk_flag);
    setSgkPrescriptionReceived(!!patient.sgk_prescription_received);
    setSgkRecordedToSystem(!!patient.sgk_recorded_to_system);
    setActiveTab(initialTab);
  }, [
    patient.id,
    patient.sgk_flag,
    patient.sgk_prescription_received,
    patient.sgk_recorded_to_system,
    initialTab,
  ]);

  const handleSave = () => {
    onSave({
      sgkFlag,
      sgkPrescriptionReceived: sgkFlag
        ? sgkPrescriptionReceived
        : false,
      sgkRecordedToSystem: sgkFlag ? sgkRecordedToSystem : false,
    });
  };

  const tabs: { id: PatientDetailTabId; label: string }[] = [
    { id: 'info', label: 'Özlük, Referans & SGK' },
    { id: 'devices', label: 'Cihazlar' },
    { id: 'meetings', label: 'Görüşmeler' },
    { id: 'payments', label: 'Ödemeler' },
    { id: 'audiogram', label: 'Audiogram' },
  ];

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Kapat
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="inline-flex items-center rounded-md bg-primary-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </>
  );

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Hasta Detayı"
      subtitle={patient.full_name}
      footer={footer}
    >
      {/* Tab bar */}
      <div className="border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  'rounded-md px-3 py-1.5 text-xs font-medium ' +
                  (isActive
                    ? 'border border-primary-200 bg-primary-50 text-primary-700'
                    : 'border border-transparent text-slate-600 hover:bg-slate-50')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab contents */}
      <div className="mt-4 space-y-4 text-sm">
        {activeTab === 'info' && (
          <PatientDetailInfoTab
            patient={patient}
            sgkFlag={sgkFlag}
            sgkPrescriptionReceived={sgkPrescriptionReceived}
            sgkRecordedToSystem={sgkRecordedToSystem}
            onChangeSgkFlag={(value) => {
              setSgkFlag(value);
              if (!value) {
                setSgkPrescriptionReceived(false);
                setSgkRecordedToSystem(false);
              }
            }}
            onChangeSgkPrescriptionReceived={setSgkPrescriptionReceived}
            onChangeSgkRecordedToSystem={setSgkRecordedToSystem}
          />
        )}

        {activeTab === 'devices' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Cihazlar
            </h4>
            <p className="text-xs text-slate-500">
              Bir sonraki adımda bu sekmede hastanın aktif cihazları, kulak
              tarafı (sağ/sol/çift), model, seri numarası ve garanti
              bilgileri listelenecek. Şimdilik sadece iskelet olarak
              duruyor.
            </p>
          </section>
        )}

        {activeTab === 'meetings' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Görüşmeler
            </h4>
            <p className="text-xs text-slate-500">
              Buraya tarih bazlı ziyaret listesi, not alanı ve
              &quot;Ödeme / Tamir / Aksesuar&quot; alt etiketleri
              eklenecek. Referans amaçlı görüşmeler bu sekmede, ancak ana
              listede personel için gizli tutulacak.
            </p>
          </section>
        )}

        {activeTab === 'payments' && (
          <PatientDetailPaymentsTab patientId={patient.id} open={open} />
        )}

        {activeTab === 'audiogram' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Audiogram
            </h4>
            <p className="text-xs text-slate-500">
              Audiogram sonuçları ve işitme testleri bu sekmede tutulacak.
              İleride grafikli bir görünüm ve &quot;önce / sonra&quot;
              karşılaştırma seçenekleri eklenebilir.
            </p>
          </section>
        )}

        {errorMsg && (
          <p className="text-[11px] text-red-600">
            Kaydetme sırasında bir hata oluştu. Detay: {errorMsg}
          </p>
        )}
      </div>
    </SideDrawer>
  );
}
