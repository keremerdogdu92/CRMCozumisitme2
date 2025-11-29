// src/features/patients/PatientDetailDrawer.tsx
// Tabbed patient detail drawer using the shared SideDrawer shell and per-tab components.

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PatientRow } from './types';
import { SideDrawer } from '../../components/layout/SideDrawer';
import { PatientDetailInfoTab } from './PatientDetailInfoTab';
import { PatientDetailPaymentsTab } from './PatientDetailPaymentsTab';
import { PatientDetailDevicesTab } from './PatientDetailDevicesTab';
import { PatientDetailSgkInvoiceTab } from './PatientDetailSgkInvoiceTab';
import { PATIENTS_QUERY_KEY } from './api/api.core';
import { updatePatientInvoiceStatus } from './api/api.patients';

type PatientDetailTabId =
  | 'info'
  | 'sgkInvoice'
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
    sgkPrescriptionNo: string;
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
  const [sgkPrescriptionNo, setSgkPrescriptionNo] = useState<string>(
    patient.sgk_prescription_no ?? '',
  );
  const [activeTab, setActiveTab] =
    useState<PatientDetailTabId>(initialTab);

  // Invoice state is handled locally here and synced with Supabase
  // via updatePatientInvoiceStatus.
  const [invoiceIssued, setInvoiceIssued] = useState<boolean>(
    patient.invoice_issued === true,
  );
  const [invoiceIssuedAt, setInvoiceIssuedAt] = useState<string | null>(
    (patient.invoice_issued_at as string | null) ?? null,
  );

  const queryClient = useQueryClient();

  const invoiceMutation = useMutation({
    mutationFn: (nextValue: boolean) =>
      updatePatientInvoiceStatus({
        id: patient.id,
        invoiceIssued: nextValue,
      }),
    onSuccess: (data) => {
      setInvoiceIssued(!!data.invoice_issued);
      setInvoiceIssuedAt(data.invoice_issued_at);
      // Hasta listesi ve detay drawer'ı güncel kalsın diye cache'i tazele.
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
    onError: () => {
      // Hata durumunda optimistic değişikliği geri al.
      setInvoiceIssued(patient.invoice_issued === true);
      setInvoiceIssuedAt(
        (patient.invoice_issued_at as string | null) ?? null,
      );
    },
  });

  useEffect(() => {
    setSgkFlag(!!patient.sgk_flag);
    setSgkPrescriptionReceived(!!patient.sgk_prescription_received);
    setSgkRecordedToSystem(!!patient.sgk_recorded_to_system);
    setSgkPrescriptionNo(patient.sgk_prescription_no ?? '');
    setActiveTab(initialTab);

    setInvoiceIssued(patient.invoice_issued === true);
    setInvoiceIssuedAt(
      (patient.invoice_issued_at as string | null) ?? null,
    );
  }, [
    patient.id,
    patient.sgk_flag,
    patient.sgk_prescription_received,
    patient.sgk_recorded_to_system,
    patient.sgk_prescription_no,
    patient.invoice_issued,
    patient.invoice_issued_at,
    initialTab,
  ]);

  const handleSave = () => {
    onSave({
      sgkFlag,
      sgkPrescriptionReceived: sgkFlag
        ? sgkPrescriptionReceived
        : false,
      sgkRecordedToSystem: sgkFlag ? sgkRecordedToSystem : false,
      sgkPrescriptionNo,
    });
  };

  const handleChangeInvoiceIssued = (nextValue: boolean) => {
    // Optimistic update; onError revert to last known backend state.
    setInvoiceIssued(nextValue);
    invoiceMutation.mutate(nextValue);
  };

  const tabs: { id: PatientDetailTabId; label: string }[] = [
    { id: 'info', label: 'Özlük' },
    { id: 'sgkInvoice', label: 'SGK & Fatura' },
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
        {activeTab === 'info' && <PatientDetailInfoTab patient={patient} />}

        {activeTab === 'sgkInvoice' && (
          <PatientDetailSgkInvoiceTab
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
            sgkPrescriptionNo={sgkPrescriptionNo}
            onChangeSgkPrescriptionNo={setSgkPrescriptionNo}
            invoiceIssued={invoiceIssued}
            invoiceIssuedAt={invoiceIssuedAt}
            onChangeInvoiceIssued={handleChangeInvoiceIssued}
          />
        )}

        {activeTab === 'devices' && (
          <PatientDetailDevicesTab patient={patient} />
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
