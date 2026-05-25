// src/features/patients/components/detail/PatientDetailDrawer.tsx
// Summary: Tabbed patient detail drawer using the shared SideDrawer shell and per-tab components.
// Integrations:
// - SGK save is delegated to parent via onSave (PatientsPage).
// - Invoice updates use updatePatientInvoiceStatus (DB-backed).
// - Meetings tab reads patient meetings via meetings/api.
// - Soft delete + restore uses DB RPC wrappers (softDeletePatient / restorePatient).
//
// Security notes:
// - Do NOT directly UPDATE patients.deleted_at from the client.
// - Use DB RPCs so org scoping + audit triggers are enforced server-side.
//
// Patch:
// - After patient soft delete, also invalidates INVENTORY_QUERY_KEY so returned-to-stock inventory
//   items refresh immediately in Inventory screens (sold -> in_stock).

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatientRow } from '../../types';
import { SideDrawer } from '../../../../components/layout/SideDrawer';
import { PatientDetailInfoTab } from './PatientDetailInfoTab';
import { PatientDetailPaymentsTab } from './PatientDetailPaymentsTab';
import { PatientDetailDevicesTab } from './PatientDetailDevicesTab';
import { PatientDetailSgkInvoiceTab } from './PatientDetailSgkInvoiceTab';
import { PatientDetailAccessoriesTab } from './PatientDetailAccessoriesTab';
import { PatientDetailBatteryPrescriptionsTab } from './PatientDetailBatteryPrescriptionsTab';
import { PATIENTS_QUERY_KEY, restorePatient, softDeletePatient } from '../../api';
import { INVENTORY_QUERY_KEY } from '../../../inventory/api';
import { updatePatientInvoiceStatus } from '../../api/api.patients.update';
import type { MeetingRow } from '../../../meetings/types';
import {
  MEETINGS_BY_PATIENT_QUERY_KEY,
  fetchMeetingsByPatientId,
} from '../../../meetings/api';
import { useCurrentProfile } from '../../../auth/useCurrentProfile';

type PatientDetailTabId =
  | 'info'
  | 'sgkInvoice'
  | 'devices'
  | 'meetings'
  | 'payments'
  | 'accessories'
  | 'batteryPrescriptions'
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
    sgkRecordedToSystemAt: string | null;
  }) => void;
  isSaving: boolean;
  errorMsg?: string;

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
  const [activeTab, setActiveTab] = useState<PatientDetailTabId>(initialTab);

  // Sisteme işlendiği tarih (timestamptz) – DB’den gelen değer.
  const [sgkRecordedToSystemAt, setSgkRecordedToSystemAt] = useState<
    string | null
  >(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((patient as any).sgk_recorded_to_system_at as string | null) ?? null,
  );

  // Invoice state (DB-backed)
  const [invoiceIssued, setInvoiceIssued] = useState<boolean>(
    patient.invoice_issued === true,
  );
  const [invoiceIssuedAt, setInvoiceIssuedAt] = useState<string | null>(
    (patient.invoice_issued_at as string | null) ?? null,
  );
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const canRestore = profile?.role === 'admin';

  const invoiceMutation = useMutation({
    mutationFn: (params: { invoiceIssued: boolean; invoiceIssuedAt: string | null }) =>
      updatePatientInvoiceStatus({
        id: patient.id,
        invoiceIssued: params.invoiceIssued,
        invoiceIssuedAt: params.invoiceIssuedAt,
      }),
    onSuccess: (data) => {
      setInvoiceError(null);
      setInvoiceIssued(!!data.invoice_issued);
      setInvoiceIssuedAt(data.invoice_issued_at);
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
    onError: (err) => {
      setInvoiceIssued(patient.invoice_issued === true);
      setInvoiceIssuedAt((patient.invoice_issued_at as string | null) ?? null);

      const message =
        err instanceof Error
          ? err.message
          : 'Fatura durumu güncellenirken bir hata oluştu.';
      setInvoiceError(message);
    },
  });

  const softDeleteMutation = useMutation({
    mutationFn: async () => {
      await softDeletePatient(patient.id, 'manual_soft_delete');
    },
    onSuccess: () => {
      // 1) Refresh patient lists
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });

      // 2) Refresh inventory lists because DB soft-delete returns SOLD items to stock
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });

      // 3) Close drawer to avoid stale patient view after deletion
      onClose();
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : 'Hasta silinirken beklenmeyen bir hata oluştu.';
      // eslint-disable-next-line no-alert
      alert(message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      await restorePatient(patient.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
    },
    onError: (err) => {
      const message =
        err instanceof Error
          ? err.message
          : 'Hasta geri alınırken beklenmeyen bir hata oluştu.';
      // eslint-disable-next-line no-alert
      alert(message);
    },
  });

  useEffect(() => {
    if (!open) return;

    setSgkFlag(!!patient.sgk_flag);
    setSgkPrescriptionReceived(!!patient.sgk_prescription_received);
    setSgkRecordedToSystem(!!patient.sgk_recorded_to_system);
    setSgkPrescriptionNo(patient.sgk_prescription_no ?? '');
    setActiveTab(initialTab);

    setInvoiceIssued(patient.invoice_issued === true);
    setInvoiceIssuedAt((patient.invoice_issued_at as string | null) ?? null);
    setInvoiceError(null);

    setSgkRecordedToSystemAt(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((patient as any).sgk_recorded_to_system_at as string | null) ?? null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id, open, initialTab]);

  const handleSave = () => {
    onSave({
      sgkFlag,
      sgkPrescriptionReceived: sgkFlag ? sgkPrescriptionReceived : false,
      sgkRecordedToSystem: sgkFlag ? sgkRecordedToSystem : false,
      sgkPrescriptionNo,
      sgkRecordedToSystemAt:
        sgkFlag && sgkRecordedToSystem ? sgkRecordedToSystemAt ?? null : null,
    });
  };

  const handleSaveInvoiceFromTab = (params: {
    invoiceIssued: boolean;
    invoiceIssuedAt: string | null;
  }) => {
    invoiceMutation.mutate(params);
  };

  const handleSoftDeletePatient = () => {
    if (softDeleteMutation.isPending) return;
    softDeleteMutation.mutate();
  };

  const handleRestorePatient = () => {
    if (!canRestore || restoreMutation.isPending) return;
    restoreMutation.mutate();
  };

  const tabs: { id: PatientDetailTabId; label: string }[] = [
    { id: 'info', label: 'Özlük' },
    { id: 'sgkInvoice', label: 'SGK & Fatura' },
    { id: 'devices', label: 'Cihazlar' },
    { id: 'meetings', label: 'Görüşmeler' },
    { id: 'payments', label: 'Ödemeler' },
    { id: 'accessories', label: 'Aksesuarlar' },
    { id: 'batteryPrescriptions', label: 'Pil Reçeteleri' },
  ];

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

      <div className="mt-4 space-y-4 text-sm">
        {activeTab === 'info' && (
          <PatientDetailInfoTab
            patient={patient}
            onDeletePatient={handleSoftDeletePatient}
            onRestorePatient={canRestore ? handleRestorePatient : undefined}
            onInfoSaved={onClose}
            isDeleting={softDeleteMutation.isPending}
            isRestoring={restoreMutation.isPending}
          />
        )}

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
                setSgkRecordedToSystemAt(null);
              }
            }}
            onChangeSgkPrescriptionReceived={setSgkPrescriptionReceived}
            onChangeSgkRecordedToSystem={setSgkRecordedToSystem}
            sgkRecordedToSystemAt={sgkRecordedToSystemAt}
            onChangeSgkRecordedToSystemAt={setSgkRecordedToSystemAt}
            sgkPrescriptionNo={sgkPrescriptionNo}
            onChangeSgkPrescriptionNo={setSgkPrescriptionNo}
            invoiceIssued={invoiceIssued}
            invoiceIssuedAt={invoiceIssuedAt}
            invoiceIsSaving={invoiceMutation.isPending}
            invoiceSaveError={invoiceError}
            onSaveInvoice={handleSaveInvoiceFromTab}
          />
        )}

        {activeTab === 'devices' && <PatientDetailDevicesTab patient={patient} />}

        {activeTab === 'meetings' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Görüşmeler
            </h4>

            {isMeetingsLoading && (
              <p className="text-xs text-slate-500">Görüşmeler yükleniyor...</p>
            )}

            {isMeetingsError && (
              <p className="text-xs text-red-600">
                Görüşmeler alınırken bir hata oluştu:{' '}
                {(meetingsError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}

            {!isMeetingsLoading && !isMeetingsError && typedMeetings.length === 0 && (
              <div className="space-y-1">
                <p className="text-xs text-slate-500">
                  Bu hasta için kayıtlı görüşme bulunmuyor.
                </p>
                <p className="text-[11px] text-slate-400">
                  Yeni görüşme eklemek için üst menüden{' '}
                  <span className="font-semibold">Görüşmeler</span> ekranına gidip,
                  görüşme tipi olarak <span className="font-semibold">Hasta</span>{' '}
                  seçerek ilgili kişiyi seçebilirsiniz.
                </p>
              </div>
            )}

            {!isMeetingsLoading && !isMeetingsError && typedMeetings.length > 0 && (
              <div className="space-y-2">
                <table className="min-w-full border border-slate-200 text-[11px]">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Tarih</th>
                      <th className="px-2 py-1 text-left font-medium">Başlık</th>
                      <th className="px-2 py-1 text-left font-medium">
                        Sonraki Tarih
                      </th>
                      <th className="px-2 py-1 text-left font-medium">
                        Memnuniyet
                      </th>
                      <th className="px-2 py-1 text-left font-medium">Not</th>
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
                  Yeni görüşme eklemek için <span className="font-semibold">Görüşmeler</span>{' '}
                  ana ekranını kullanın. Bu sekme sadece ilgili hasta görüşmelerini
                  görüntüler.
                </p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'payments' && (
          <PatientDetailPaymentsTab patientId={patient.id} open={open} />
        )}

        {activeTab === 'accessories' && (
          <PatientDetailAccessoriesTab patientId={patient.id} open={open} />
        )}

        {activeTab === 'batteryPrescriptions' && (
          <PatientDetailBatteryPrescriptionsTab patientId={patient.id} open={open} />
        )}

        {activeTab === 'audiogram' && (
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Audiogram
            </h4>
            <p className="text-xs text-slate-500">
              Audiogram sonuçları ve işitme testleri bu sekmede tutulacak. İleride
              grafikli bir görünüm ve &quot;önce / sonra&quot; karşılaştırma
              seçenekleri eklenebilir.
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
