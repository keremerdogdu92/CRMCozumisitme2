// src/features/patients/PatientSenetPlanFormCard.tsx
// Shared senet plan form card used in patient detail payments tab and
// new patient flow. Visual style is aligned with other form sections
// (neutral white card, no separate yellow block / toggle UI).

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
  // If patientId is empty, we assume this card is being used inside the
  // "New Patient" form. In that case:
  // - saleTotal is derived from payment rows and should not be editable.
  // - The plan will be saved together with the patient; no separate save button.
  const isEmbeddedInNewPatientForm = !patientId;

  const handleSaveClick = async () => {
    const payload: UpsertPatientInstallmentPlanInput = {
      patientId,
      saleTotal,
      upfrontPaid,
      installmentCount,
      firstDueDate,
      dayOfMonth,
    };
    await upsertPlan(payload);
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white px-3 py-3">
      <div>
        <p className="text-xs font-medium text-slate-800">Senet Planı</p>
        <p className="text-[11px] text-slate-600">
          Toplam satış fiyatı, peşinat ve taksit bilgilerini girerek bu hasta
          için senet planı tanımlayın. Görüşmeler ekranından eklenen ödemeler
          bu plana göre takip edilir.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-12">
        {/* Toplam Satış Fiyatı */}
        <div className="md:col-span-3">
          <label className="mb-1 block text-[11px] font-medium text-slate-700">
            Toplam Satış Fiyatı
          </label>
          <input
            type="text"
            className={`w-full rounded-md border px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
              isEmbeddedInNewPatientForm
                ? 'border-slate-200 bg-slate-100 cursor-not-allowed'
                : 'border-slate-200 bg-white'
            }`}
            value={saleTotal}
            onChange={(e) =>
              isEmbeddedInNewPatientForm
                ? undefined
                : setSaleTotal(e.target.value)
            }
            readOnly={isEmbeddedInNewPatientForm}
            placeholder="Örn: 20000"
          />
          {isEmbeddedInNewPatientForm && (
            <p className="mt-1 text-[10px] text-slate-500">
              Yeni hasta formunda toplam satış tutarı ödeme satırlarından
              otomatik hesaplanır.
            </p>
          )}
        </div>

        {/* Peşinat */}
        <div className="md:col-span-3">
          <label className="mb-1 block text-[11px] font-medium text-slate-700">
            Peşinat (opsiyonel)
          </label>
          <input
            type="text"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={upfrontPaid}
            onChange={(e) => setUpfrontPaid(e.target.value)}
            placeholder="Örn: 5000"
          />
        </div>

        {/* Taksit Sayısı */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-slate-700">
            Taksit Sayısı
          </label>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={installmentCount}
            onChange={(e) => setInstallmentCount(e.target.value)}
            placeholder="Örn: 6"
          />
        </div>

        {/* İlk Ödeme Tarihi */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-slate-700">
            İlk Ödeme Tarihi
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
          />
        </div>

        {/* Her Ayın Günü */}
        <div className="md:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-slate-700">
            Her Ayın Günü
          </label>
          <input
            type="number"
            min={1}
            max={31}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            placeholder="Örn: 15"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
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
        </div>

        {/* Yeni Hasta formunda ayrı bir kaydet butonuna gerek yok; plan hasta ile birlikte kaydedilecek. */}
        {!isEmbeddedInNewPatientForm && (
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isPlanSaving}
            className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {isPlanSaving
              ? 'Plan kaydediliyor...'
              : plan
              ? 'Planı güncelle'
              : 'Plan oluştur'}
          </button>
        )}
      </div>
    </div>
  );
}
