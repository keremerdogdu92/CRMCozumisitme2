// src/features/patients/PatientDetailPaymentsTab.tsx
// Payments tab for patient detail drawer: senet planı, payment history and sale breakdown.

import { useEffect, useState } from 'react';
import type {
  PatientInstallmentPlanRow,
  PatientPaymentRow,
  UpsertPatientInstallmentPlanInput,
  UpsertPatientSaleBreakdownItem,
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
import {
  fetchPatientSaleBreakdown,
  savePatientSaleBreakdown,
} from './api/api.saleBreakdown';
import { PatientSaleBreakdownCard } from './PatientSaleBreakdownCard';
import { PatientSenetPlanFormCard } from './PatientSenetPlanFormCard';

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

  // ---------------------------------------------------------------------------
  // Sale breakdown (multi-method payment lines)
  // ---------------------------------------------------------------------------

  const [breakdownItems, setBreakdownItems] = useState<
    UpsertPatientSaleBreakdownItem[]
  >([]);
  const [isBreakdownLoading, setIsBreakdownLoading] = useState(false);
  const [isBreakdownSaving, setIsBreakdownSaving] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  // Load breakdown when tab opens or patient changes
  useEffect(() => {
    if (!open || !patientId) return;

    let cancelled = false;
    setIsBreakdownLoading(true);

    fetchPatientSaleBreakdown(patientId)
      .then((rows) => {
        if (cancelled) return;
        setBreakdownItems(
          rows.map((r) => ({
            id: r.id,
            method: r.method,
            amount: r.amount.toString(),
            note: r.note ?? '',
          })),
        );
        setBreakdownError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Ödeme dağılımı yüklenirken hata oluştu.';
        setBreakdownError(msg);
      })
      .finally(() => {
        if (cancelled) return;
        setIsBreakdownLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, open]);

  const handleAddBreakdownRow = () => {
    setBreakdownItems((prev) => [
      ...prev,
      {
        method: 'Nakit',
        amount: '',
        note: '',
      },
    ]);
  };

  const handleChangeBreakdownRow = (
    index: number,
    patch: Partial<UpsertPatientSaleBreakdownItem>,
  ) => {
    setBreakdownItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const handleRemoveBreakdownRow = (index: number) => {
    setBreakdownItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBreakdown = async () => {
    if (!patientId) return;
    setIsBreakdownSaving(true);
    try {
      await savePatientSaleBreakdown({
        patientId,
        items: breakdownItems,
      });
      // Reload to normalize amounts from backend
      const rows = await fetchPatientSaleBreakdown(patientId);
      setBreakdownItems(
        rows.map((r) => ({
          id: r.id,
          method: r.method,
          amount: r.amount.toString(),
          note: r.note ?? '',
        })),
      );
      setBreakdownError(null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ödeme dağılımı kaydedilirken hata oluştu.';
      setBreakdownError(msg);
    } finally {
      setIsBreakdownSaving(false);
    }
  };

  const breakdownTotal = breakdownItems.reduce((sum, item) => {
    const raw = (item.amount ?? '').trim();
    if (!raw) return sum;
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    if (!Number.isFinite(num)) return sum;
    return sum + num;
  }, 0);

  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-slate-500">
        Ödemeler (Senet)
      </h4>

      {/* Sale breakdown card */}
      <PatientSaleBreakdownCard
        items={breakdownItems}
        onAddRow={handleAddBreakdownRow}
        onChangeRow={handleChangeBreakdownRow}
        onRemoveRow={handleRemoveBreakdownRow}
        onSave={handleSaveBreakdown}
        totalAmount={breakdownTotal}
        isLoading={isBreakdownLoading}
        isSaving={isBreakdownSaving}
        errorMessage={breakdownError}
      />

      {/* Plan form (toggle) */}
      <PatientSenetPlanFormCard
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
                    (plan as PatientInstallmentPlanRow).installment_amount,
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
