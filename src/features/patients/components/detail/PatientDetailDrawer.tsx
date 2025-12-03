// src/features/patients/PatientDetailDrawer.tsx
// Tabbed patient detail drawer using the shared SideDrawer shell and per-tab components.

import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { PatientRow } from '../../types';
import { SideDrawer } from '../../../../components/layout/SideDrawer';
import { PatientDetailInfoTab } from './PatientDetailInfoTab';
import { PatientDetailPaymentsTab } from './PatientDetailPaymentsTab';
import { PatientDetailDevicesTab } from './PatientDetailDevicesTab';
import { PatientDetailSgkInvoiceTab } from './PatientDetailSgkInvoiceTab';
import { PatientDetailAccessoriesTab } from './PatientDetailAccessoriesTab';
import { PATIENTS_QUERY_KEY } from '../../api/api.core';
import { updatePatientInvoiceStatus } from '../../api/api.patients';
import type { MeetingRow } from '../../../meetings/types';
import {
  MEETINGS_BY_PATIENT_QUERY_KEY,
  fetchMeetingsByPatientId,
} from '../../../meetings/api';

type PatientDetailTabId =
  | 'info'
  | 'sgkInvoice'
  | 'devices'
  | 'meetings'
  | 'payments'
  | 'accessories'
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

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '-';
  }
}

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
    { id: 'accessories', label: 'Aksesuarlar' },
    { id: 'audiogram', label: 'Audiogram' },
  ];

  // Bu hastaya bağlı görüşmeler (meeting_type = 'patient')
  const {
    data: meetings = [],
    isLoading: isMeetingsLoading,
    isError: isMeetingsError,
    error: meetingsError,
  } = useQuery<MeetingRow[]>({
    queryKey: MEETINGS_BY_PATIENT_QUERY_KEY(patient.id),
    queryFn: () => fetchMeetingsByPatientId(patient.id),
    enabled: open && activeTab === 'meetings',
  });

  const typedMeetings = meetings as MeetingRow[];

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

            {isMeetingsLoading && (
              <p className="text-xs text-slate-500">
                Görüşmeler yükleniyor...
              </p>
            )}

            {isMeetingsError && (
              <p className="text-xs text-red-600">
                Görüşmeler alınırken bir hata oluştu:{' '}
                {(meetingsError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}

            {!isMeetingsLoading &&
              !isMeetingsError &&
              typedMeetings.length === 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    Bu hasta için kayıtlı görüşme bulunmuyor.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Yeni görüşme eklemek için üst menüden{' '}
                    <span className="font-semibold">Görüşmeler</span>{' '}
                    ekranına gidip, görüşme tipi olarak{' '}
                    <span className="font-semibold">Hasta</span> seçerek
                    ilgili kişiyi seçebilirsiniz.
                  </p>
                </div>
              )}

            {!isMeetingsLoading &&
              !isMeetingsError &&
              typedMeetings.length > 0 && (
                <div className="space-y-2">
                  <table className="min-w-full border border-slate-200 text-[11px]">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">
                          Tarih
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Başlık
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Sonraki Tarih
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Memnuniyet
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Not
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {typedMeetings.map((m) => (
                        <tr
                          key={m.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-2 py-1 text-slate-800">
                            {formatDate(m.at)}
                          </td>
                          <td className="px-2 py-1 text-slate-800">
                            {m.subject ?? '-'}
                          </td>
                          <td className="px-2 py-1 text-slate-800">
                            {formatDate(m.next_at)}
                          </td>
                          <td className="px-2 py-1 text-slate-800">
                            {m.satisfaction_10 ?? '-'}
                          </td>
                          <td className="px-2 py-1 text-slate-600">
                            {m.note ? m.note.slice(0, 160) : '-'}
                            {m.note && m.note.length > 160 ? '…' : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-400">
                    Yeni görüşme eklemek için{' '}
                    <span className="font-semibold">Görüşmeler</span> ana
                    ekranını kullanın. Bu sekme sadece ilgili hasta
                    görüşmelerini görüntüler.
                  </p>
                </div>
              )}
          </section>
        )}

        {activeTab === 'payments' && (
          <PatientDetailPaymentsTab patientId={patient.id} open={open} />
        )}

        {activeTab === 'accessories' && (
          <PatientDetailAccessoriesTab
            patientId={patient.id}
            open={open}
          />
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
