// src/features/patients/PatientDetailPaymentsTab.tsx
// Payments tab for patient detail drawer: senet planı and payment history.

import { useEffect, useState } from 'react';
import type {
  PatientInstallmentPlanRow,
  PatientPaymentRow,
  UpsertPatientInstallmentPlanInput,
} from './types';
import {
  usePatientInstallmentPlan,
  usePatientPayments,
  useUpsertPatientInstallmentPlanMutation,
} from './api';
import {
  addMonths,
  formatAmount,
  formatDateTime,
} from './patientFormatUtils';

type PatientDetailPaymentsTabProps = {
  patientId: string;
  open: boolean;
};

export function PatientDetailPaymentsTab({
  patientId,
  open,
}: PatientDetailPaymentsTabProps) {
  // Payment history
  const {
    data: payments = [],
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
    error: paymentsError,
  } = usePatientPayments(open ? patientId : null);

  // Installment plan
  const {
    data: plan,
    isLoading: isPlanLoading,
    isError: isPlanError,
    error: planError,
  } = usePatientInstallmentPlan(open ? patientId : null);

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

  // Sync plan into form when it loads/changes
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

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Ödemeler (Senet)
      </h4>

      {/* Plan form (toggle) */}
      <SenetPlanForm
        plan={plan ?? null}
        saleTotal={saleTotal}
        upfrontPaid={upfrontPaid}
        installmentCount={installmentCount}
        firstDueDate={firstDueDate}
        dayOfMonth={dayOfMonth}
        setSaleTotal={setSaleTotal}
        setUpfrontPaid={setUpfrontPaid}
        setInstallmentCount={setInstallmentCount}
        setFirstDueDate={setFirstDueDate}
        setDayOfMonth={setDayOfMonth}
        isPlanSaveError={isPlanSaveError}
        planSaveError={planSaveError}
        isPlanError={isPlanError}
        planError={planError}
        isPlanSaving={isPlanSaving}
        patientId={patientId}
        upsertPlan={upsertPlan}
      />

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
            Bu hasta için henüz senet planı yok. Yukarıdaki formu açıp plan
            oluşturduktan sonra taksit takibi otomatik hesaplanacak.
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
                    (plan as PatientInstallmentPlanRow).upfront_paid,
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
                  {(plan as PatientInstallmentPlanRow).installment_count}
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
                <span className="font-semibold">{nextDueDate}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* State messages for payments */}
      {isPaymentsLoading && (
        <p className="text-xs text-slate-500">Ödemeler yükleniyor...</p>
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
            &quot;Ödeme alındı&quot; işaretleyerek ödeme ekleyebilirsiniz.
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
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 font-medium">Tutar</th>
                  <th className="px-3 py-2 font-medium">Yöntem</th>
                  <th className="px-3 py-2 font-medium">Not</th>
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
  );
}

type SenetPlanFormProps = {
  plan: PatientInstallmentPlanRow | null;
  saleTotal: string;
  upfrontPaid: string;
  installmentCount: string;
  firstDueDate: string;
  dayOfMonth: string;
  setSaleTotal: (v: string) => void;
  setUpfrontPaid: (v: string) => void;
  setInstallmentCount: (v: string) => void;
  setFirstDueDate: (v: string) => void;
  setDayOfMonth: (v: string) => void;
  isPlanSaveError: boolean;
  planSaveError: unknown;
  isPlanError: boolean;
  planError: unknown;
  isPlanSaving: boolean;
  patientId: string;
  upsertPlan: (input: UpsertPatientInstallmentPlanInput) => Promise<void>;
};

function SenetPlanForm({
  plan,
  saleTotal,
  upfrontPaid,
  installmentCount,
  firstDueDate,
  dayOfMonth,
  setSaleTotal,
  setUpfrontPaid,
  setInstallmentCount,
  setFirstDueDate,
  setDayOfMonth,
  isPlanSaveError,
  planSaveError,
  isPlanError,
  planError,
  isPlanSaving,
  patientId,
  upsertPlan,
}: SenetPlanFormProps) {
  const [showPlanForm, setShowPlanForm] = useState(false);

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-amber-900">
            Senet Planı
          </p>
          <p className="text-[11px] text-amber-900">
            Toplam satış fiyatı, peşinat ve taksit bilgilerini girerek bu
            hasta için senet planı oluşturun. Görüşmeler ekranından eklenen
            ödemeler bu plana göre takip edilir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPlanForm((prev) => !prev)}
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
                onChange={(e) => setUpfrontPaid(e.target.value)}
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
                onChange={(e) => setInstallmentCount(e.target.value)}
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
                onChange={(e) => setFirstDueDate(e.target.value)}
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
                onChange={(e) => setDayOfMonth(e.target.value)}
                placeholder="Örn: 15"
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {isPlanSaveError && (
              <p className="text-[11px] text-red-700">
                Plan kaydedilirken hata:{' '}
                {(planSaveError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}
            {isPlanError && (
              <p className="text-[11px] text-red-700">
                Plan yüklenirken hata:{' '}
                {(planError as Error)?.message ?? 'Bilinmeyen hata'}
              </p>
            )}

            <button
              type="button"
              onClick={async () => {
                const payload: UpsertPatientInstallmentPlanInput = {
                  patientId,
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
  );
}
