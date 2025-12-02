// src/features/patients/PatientSenetPlanFormCard.tsx
// Shared senet plan form card used in patient detail payments tab and (later)
// new patient flow.

import { useState } from 'react';
import type {
  PatientInstallmentPlanRow,
  UpsertPatientInstallmentPlanInput,
} from '../../types';

export type PatientSenetPlanFormCardProps = {
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

export function PatientSenetPlanFormCard({
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
}: PatientSenetPlanFormCardProps) {
  const [showPlanForm, setShowPlanForm] = useState(false);

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-amber-900">Senet Planı</p>
          <p className="text-[11px] text-amber-900">
            Toplam satış fiyatı, peşinat ve taksit bilgilerini girerek bu hasta
            için senet planı oluşturun. Görüşmeler ekranından eklenen ödemeler
            bu plana göre takip edilir.
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
