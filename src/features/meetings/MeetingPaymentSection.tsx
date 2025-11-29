// src/features/meetings/MeetingPaymentSection.tsx
// Senet payment block inside the meeting form: plan summary + payment inputs.

import { useEffect, useMemo } from 'react';
import {
  usePatientInstallmentPlan,
  usePatientPayments,
} from '../patients/api';
import type {
  PatientInstallmentPlanRow,
  PatientPaymentRow,
} from '../patients/types';
import type { NewMeetingForm } from './types';

type MeetingPaymentFormFields = Pick<
  NewMeetingForm,
  'hasPayment' | 'paymentAmount' | 'paymentNote'
>;

interface MeetingPaymentSectionProps {
  patientId: string;
  form: MeetingPaymentFormFields;
  onChange: (patch: Partial<MeetingPaymentFormFields>) => void;
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

export function MeetingPaymentSection({
  patientId,
  form,
  onChange,
}: MeetingPaymentSectionProps) {
  const {
    data: plan,
    isLoading: isPlanLoading,
  } = usePatientInstallmentPlan(patientId);
  const { data: payments = [] } = usePatientPayments(patientId);

  const {
    thisInstallmentAmount,
    remainingTotal,
    nextDueDate,
  } = useMemo(() => {
    if (!plan) {
      return {
        thisInstallmentAmount: null as number | null,
        remainingTotal: 0,
        nextDueDate: '-',
      };
    }

    const p = plan as PatientInstallmentPlanRow;
    const totalPaid = (payments as PatientPaymentRow[]).reduce(
      (sum, pay) => sum + (Number(pay.amount) || 0),
      0,
    );

    const remainingAfterUpfront = p.sale_total - p.upfront_paid;
    const remainingTotalCalc = Math.max(
      0,
      remainingAfterUpfront - totalPaid,
    );

    const perInstallment = p.installment_amount || 1;
    const paidInstallments = Math.min(
      p.installment_count,
      Math.floor(totalPaid / perInstallment),
    );
    const nextDue = addMonths(p.first_due_date, paidInstallments);

    return {
      thisInstallmentAmount: perInstallment,
      remainingTotal: remainingTotalCalc,
      nextDueDate: nextDue,
    };
  }, [plan, payments]);

  // If plan exists, payment toggle is on, and no manual amount is entered yet,
  // prefill the current installment amount.
  useEffect(() => {
    if (
      plan &&
      form.hasPayment &&
      !form.paymentAmount.trim() &&
      thisInstallmentAmount !== null
    ) {
      onChange({
        paymentAmount: thisInstallmentAmount.toString(),
      });
    }
  }, [
    plan,
    form.hasPayment,
    form.paymentAmount,
    thisInstallmentAmount,
    onChange,
  ]);

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      {/* Plan summary inside meeting form */}
      {isPlanLoading && (
        <p className="text-[11px] text-amber-900">
          Senet planı yükleniyor...
        </p>
      )}

      {plan && !isPlanLoading && (
        <div className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-100 px-3 py-2">
          <div className="flex justify-between gap-2 text-[11px] text-amber-900">
            <span>Bu taksit için beklenen tutar</span>
            <span className="font-semibold">
              {thisInstallmentAmount !== null
                ? formatAmount(thisInstallmentAmount)
                : '-'}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-[11px] text-amber-900">
            <span>Kalan borç (yaklaşık)</span>
            <span className="font-semibold">
              {formatAmount(remainingTotal)}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-[11px] text-amber-900">
            <span>Sonraki taksit tarihi</span>
            <span className="font-semibold">{nextDueDate}</span>
          </div>
        </div>
      )}

      {!plan && !isPlanLoading && (
        <p className="text-[11px] text-amber-900">
          Bu hasta için henüz senet planı yok. Hasta detayından
          &quot;Ödemeler&quot; sekmesinden plan oluşturabilirsiniz.
        </p>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-amber-900">
            Senet Ödemesi
          </p>
          <p className="text-[11px] text-amber-800">
            Bu görüşmede senetli hastadan ödeme aldıysanız buradan
            miktarı girin. Tutar hasta borç takibinde kullanılacak.
          </p>
        </div>
        <label className="flex items-center gap-1 text-[11px] text-amber-900">
          <input
            type="checkbox"
            className="h-3 w-3"
            checked={form.hasPayment}
            onChange={(e) => {
              const checked = e.target.checked;
              onChange({
                hasPayment: checked,
                paymentAmount: checked ? form.paymentAmount : '',
                paymentNote: checked ? form.paymentNote : '',
              });
            }}
          />
          Ödeme alındı
        </label>
      </div>

      {form.hasPayment && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-amber-900">
              Ödenen Tutar
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
              value={form.paymentAmount}
              onChange={(e) =>
                onChange({
                  paymentAmount: e.target.value,
                })
              }
              placeholder={
                thisInstallmentAmount !== null
                  ? `Örn: ${thisInstallmentAmount}`
                  : 'Örn: 1250, 1.250,00'
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-amber-900">
              Not (opsiyonel)
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-amber-300 px-2 py-1 text-xs"
              value={form.paymentNote}
              onChange={(e) =>
                onChange({
                  paymentNote: e.target.value,
                })
              }
              placeholder="Örn: 3. taksit"
            />
          </div>
        </div>
      )}
    </div>
  );
}
