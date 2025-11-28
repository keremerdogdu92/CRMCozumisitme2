// src/features/patients/PatientDetailDrawer.tsx
// Tabbed patient detail drawer using the shared SideDrawer shell.

import { useEffect, useState } from 'react';
import type {
  PatientRow,
  PatientPaymentRow,
  PatientInstallmentPlanRow,
  UpsertPatientInstallmentPlanInput,
} from './types';
import {
  usePatientPayments,
  usePatientInstallmentPlan,
  useUpsertPatientInstallmentPlanMutation,
} from './api';
import { SideDrawer } from '../../components/layout/SideDrawer';

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

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    return (
      d.toLocaleDateString('tr-TR') +
      ' ' +
      d.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  } catch {
    return '-';
  }
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '-';
  return (
    amount.toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' ₺'
  );
}

function addMonths(dateStr: string, count: number): string {
  try {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + count);
    return d.toLocaleDateString('tr-TR');
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
  initialShowPlanForm = false,
}: PatientDetailDrawerProps) {
  const [sgkFlag, setSgkFlag] = useState<boolean>(!!patient.sgk_flag);
  const [sgkPrescriptionReceived, setSgkPrescriptionReceived] =
    useState<boolean>(!!patient.sgk_prescription_received);
  const [sgkRecordedToSystem, setSgkRecordedToSystem] =
    useState<boolean>(!!patient.sgk_recorded_to_system);
  const [activeTab, setActiveTab] =
    useState<PatientDetailTabId>(initialTab);
  const [showPlanForm, setShowPlanForm] =
    useState<boolean>(initialShowPlanForm);

  // Payment history
  const {
    data: payments = [],
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
    error: paymentsError,
  } = usePatientPayments(open ? patient.id : null);

  // Installment plan
  const {
    data: plan,
    isLoading: isPlanLoading,
    isError: isPlanError,
    error: planError,
  } = usePatientInstallmentPlan(open ? patient.id : null);

  const {
    mutateAsync: upsertPlan,
    isPending: isPlanSaving,
    isError: isPlanSaveError,
    error: planSaveError,
  } = useUpsertPatientInstallmentPlanMutation();

  // Local form state for plan creation/update
  const [saleTotal, setSaleTotal] = useState('');
  const [upfrontPaid, setUpfrontPaid] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('');

  useEffect(() => {
    setSgkFlag(!!patient.sgk_flag);
    setSgkPrescriptionReceived(!!patient.sgk_prescription_received);
    setSgkRecordedToSystem(!!patient.sgk_recorded_to_system);
    setActiveTab(initialTab);
    setShowPlanForm(initialShowPlanForm);
  }, [
    patient.id,
    patient.sgk_flag,
    patient.sgk_prescription_received,
    patient.sgk_recorded_to_system,
    initialTab,
    initialShowPlanForm,
  ]);

  // When we load or change the plan, sync it into the form
  useEffect(() => {
    if (!plan) {
      setSaleTotal('');
      setUpfrontPaid('');
      setInstallmentCount('');
      setFirstDueDate('');
      setDayOfMonth('');
      return;
    }

    const p = plan as PatientInstallmentPlanRow;
    setSaleTotal(p.sale_total.toString());
    setUpfrontPaid(p.upfront_paid.toString());
    setInstallmentCount(p.installment_count.toString());
    setFirstDueDate(p.first_due_date.substring(0, 10)); // yyyy-MM-dd
    setDayOfMonth(p.day_of_month.toString());
  }, [plan]);

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

  // Aggregate payments
  const totalPaid = (payments as PatientPaymentRow[]).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );

  // Derived info from plan + payments
  let remainingTotal = 0;
  let paidInstallments = 0;
  let remainingInstallments = 0;
  let nextDueDate = '-';

  if (plan) {
    const p = plan as PatientInstallmentPlanRow;
    const remainingAfterUpfront = p.sale_total - p.upfront_paid;
    remainingTotal = Math.max(0, remainingAfterUpfront - totalPaid);

    const perInstallment = p.installment_amount || 1;
    paidInstallments = Math.min(
      p.installment_count,
      Math.floor(totalPaid / perInstallment),
    );
    remainingInstallments = Math.max(
      0,
      p.installment_count - paidInstallments,
    );
    nextDueDate = addMonths(p.first_due_date, paidInstallments);
  }

  // Only show reference name, NEVER phone
  const referenceDisplay =
    patient.reference_name && patient.reference_name.trim().length > 0
      ? patient.reference_name
      : '-';

  const satisfactionDisplay =
    patient.satisfaction_10 != null
      ? `${patient.satisfaction_10} / 10`
      : '-';

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
          <>
            {/* Basic info */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">
                Özlük Bilgileri & Referans
              </h4>
              <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Ad Soyad
                  </span>
                  <span className="text-xs font-medium text-slate-900">
                    {patient.full_name}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">Telefon</span>
                  <span className="text-xs text-slate-900">
                    {patient.phone ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Kayıt Tarihi
                  </span>
                  <span className="text-xs text-slate-900">
                    {formatDate(patient.created_at)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Son Görüşme
                  </span>
                  <span className="text-xs text-slate-900">
                    {formatDate(patient.last_visit_at)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">Referans</span>
                  <span className="text-xs text-slate-900">
                    {referenceDisplay}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Memnuniyet (1–10)
                  </span>
                  <span className="text-xs text-slate-900">
                    {satisfactionDisplay}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Arşiv Kodu
                  </span>
                  <span className="text-xs text-slate-900">
                    {patient.archive_code ?? '-'}
                  </span>
                </div>
              </div>
            </section>

            {/* Extended info */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">
                Ek Bilgiler
              </h4>
              <div className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    T.C. Kimlik No
                  </span>
                  <span className="text-xs text-slate-900">
                    {patient.national_id ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    Yakın Telefonu
                  </span>
                  <span className="text-xs text-slate-900">
                    {patient.kin_phone ?? '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">Adres</span>
                  <span className="text-xs text-slate-900 whitespace-pre-line">
                    {patient.address && patient.address.trim().length > 0
                      ? patient.address
                      : '-'}
                  </span>
                </div>
              </div>
            </section>

            {/* SGK fields */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-500">
                SGK ve Evrak Takibi
              </h4>
              <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    id="detail-sgk-flag"
                    type="checkbox"
                    checked={sgkFlag}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSgkFlag(checked);
                      if (!checked) {
                        setSgkPrescriptionReceived(false);
                        setSgkRecordedToSystem(false);
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                <label
                    htmlFor="detail-sgk-flag"
                    className="select-none text-xs font-medium text-slate-700"
                  >
                    SGK hastası
                  </label>
                </div>

                <div className="flex flex-col gap-1 pl-5 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={!sgkFlag}
                      checked={sgkPrescriptionReceived}
                      onChange={(e) =>
                        setSgkPrescriptionReceived(e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span>Reçete geldi mi?</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={!sgkFlag}
                      checked={sgkRecordedToSystem}
                      onChange={(e) =>
                        setSgkRecordedToSystem(e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                    />
                    <span>Sisteme işlendi mi?</span>
                  </label>
                </div>

                <p className="mt-1 text-[11px] text-slate-500">
                  Bu alanlar ana listede satırları renklendirir ve
                  &quot;Reçete bekleniyor / Sisteme işlenecek&quot;
                  uyarılarını tetikler.
                </p>
              </div>
            </section>
          </>
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
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-500">
              Ödemeler (Senet)
            </h4>

            {/* Plan form (toggle) */}
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-amber-900">
                    Senet Planı
                  </p>
                  <p className="text-[11px] text-amber-900">
                    Toplam satış fiyatı, peşinat ve taksit bilgilerini
                    girerek bu hasta için senet planı oluşturun.
                    Görüşmeler ekranından eklenen ödemeler bu plana göre
                    takip edilir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setShowPlanForm((prev) => !prev)
                  }
                  className="inline-flex shrink-0 items-center rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-200"
                >
                  {showPlanForm ? 'Plan formunu gizle' : 'Plan formunu aç'}
                </button>
              </div>

              {showPlanForm && (
                <>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-amber-900">
                        Toplam Satış Fiyatı
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                        value={saleTotal}
                        onChange={(e) => setSaleTotal(e.target.value)}
                        placeholder="Örn: 20000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-amber-900">
                        Peşinat (opsiyonel)
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                        value={upfrontPaid}
                        onChange={(e) =>
                          setUpfrontPaid(e.target.value)
                        }
                        placeholder="Örn: 5000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-amber-900">
                        Taksit Sayısı
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                        value={installmentCount}
                        onChange={(e) =>
                          setInstallmentCount(e.target.value)
                        }
                        placeholder="Örn: 6"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-amber-900">
                        İlk Ödeme Tarihi
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                        value={firstDueDate}
                        onChange={(e) =>
                          setFirstDueDate(e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-amber-900">
                        Her Ayın Günü
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
                        value={dayOfMonth}
                        onChange={(e) =>
                          setDayOfMonth(e.target.value)
                        }
                        placeholder="Örn: 15"
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {isPlanSaveError && (
                      <p className="text-[11px] text-red-700">
                        Plan kaydedilirken hata:{' '}
                        {(planSaveError as Error)?.message ?? 
                          'Bilinmeyen hata'}
                      </p>
                    )}
                    {isPlanError && (
                      <p className="text-[11px] text-red-700">
                        Plan yüklenirken hata:{' '}
                        {(planError as Error)?.message ?? 
                          'Bilinmeyen hata'}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        const payload: UpsertPatientInstallmentPlanInput =
                          {
                            patientId: patient.id,
                            saleTotal,
                            upfrontPaid,
                            installmentCount,
                            firstDueDate,
                            dayOfMonth,
                          };
                        await upsertPlan(payload);
                      }}
                      disabled={isPlanSaving}
                      className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {isPlanSaving
                        ? 'Plan kaydediliyor...'
                        : plan
                        ? 'Planı güncelle'
                        : 'Plan oluştur'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Plan summary */}
            <div className="space-y-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-emerald-900">
                  Toplam alınan senet ödemesi
                </span>
                <span className="text-sm font-bold text-emerald-900">
                  {formatAmount(totalPaid)}
                </span>
              </div>

              {isPlanLoading && (
                <p className="text-[11px] text-emerald-900">
                  Senet planı yükleniyor...
                </p>
              )}

              {!isPlanLoading && !plan && (
                <p className="text-[11px] text-emerald-900">
                  Bu hasta için henüz senet planı yok. Yukarıdaki formu
                  açıp plan oluşturduktan sonra taksit takibi otomatik
                  hesaplanacak.
                </p>
              )}

              {plan && (
                <div className="grid gap-1 text-[11px] text-emerald-900 sm:grid-cols-2">
                  <div>
                    <div className="flex justify-between gap-2">
                      <span>Toplam satış</span>
                      <span className="font-semibold">
                        {formatAmount(
                          (plan as PatientInstallmentPlanRow).sale_total,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Peşinat</span>
                      <span className="font-semibold">
                        {formatAmount(
                          (plan as PatientInstallmentPlanRow)
                            .upfront_paid,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Aylık taksit</span>
                      <span className="font-semibold">
                        {formatAmount(
                          (plan as PatientInstallmentPlanRow)
                            .installment_amount,
                        )}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between gap-2">
                      <span>Ödenen taksit</span>
                      <span className="font-semibold">
                        {paidInstallments} /{' '}
                        {(plan as PatientInstallmentPlanRow)
                          .installment_count}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Kalan borç</span>
                      <span className="font-semibold">
                        {formatAmount(remainingTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Sonraki taksit tarihi</span>
                      <span className="font-semibold">
                        {nextDueDate}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* State messages for payments */}
            {isPaymentsLoading && (
              <p className="text-xs text-slate-500">
                Ödemeler yükleniyor...
              </p>
            )}

            {isPaymentsError && (
              <p className="text-xs text-red-600">
                Ödemeler yüklenirken bir hata oluştu:{' '}
                {(paymentsError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}

            {!isPaymentsLoading &&
              !isPaymentsError &&
              payments.length === 0 && (
                <p className="text-xs text-slate-500">
                  Henüz kayıtlı senet ödemesi yok. Görüşmeler ekranından
                  &quot;Ödeme alındı&quot; işaretleyerek ödeme
                  ekleyebilirsiniz.
                </p>
              )}

            {/* Payments table */}
            {!isPaymentsLoading &&
              !isPaymentsError &&
              payments.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          Tarih
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Tutar
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Yöntem
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Not
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments as PatientPaymentRow[]).map((p) => (
                        <tr
                          key={p.id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-2 text-slate-800">
                            {formatDateTime(p.created_at)}
                          </td>
                          <td className="px-3 py-2 text-slate-800">
                            {formatAmount(p.amount)}
                          </td>
                          <td className="px-3 py-2 text-slate-800">
                            {p.method ?? 'senet'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {p.note
                              ? p.note.length > 80
                                ? p.note.slice(0, 80) + '…'
                                : p.note
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
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
