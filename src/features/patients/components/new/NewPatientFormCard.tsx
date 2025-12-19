// src/features/patients/components/new/NewPatientFormCard.tsx
// Summary: Inline "Yeni Hasta" form card. Re-ordered sections so Devices come before SGK/Payment.
// v2.8:
// - Removes UI-only local state for deviceFlowType + sgkPillPrescription.
// - Persists deviceFlowType, chargerInventoryItemId, batteryLines, sgkPillPrescription in formState.
// - Wires NewPatientDevicesSection + NewPatientSgkSection to formState.
//
// Patch v2.9:
// - For deviceFlowType === 'battery_only': allow saving with empty payment rows (SGK-only battery patient).
// - Payment UI stays visible, but required constraints are relaxed for battery_only.
//
// Patch v3.0 (trial → patient flow):
// - When opened from TrialDetailDrawer, form auto-opens (handled in PatientsPage) and
//   basic fields (name/phone/reference) are prefilled.
// - If trial has 1–2 devices, device rows are pre-populated with side/brand/model
//   so that only serial number (inventory item) needs to be selected.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type {
  NewPatientForm,
  BatteryLineDraft,
  NewPatientDeviceDraft,
} from '../../types';
import { InlineCreateCard } from '../../../../components/layout/InlineCreateCard';
import { FormSection } from '../../../../components/layout/FormSection';
import { NewPatientReferenceField } from './NewPatientReferenceField';
import { NewPatientSgkSection } from './NewPatientSgkSection';
import { NewPatientPaymentSection } from './NewPatientPaymentSection';
import { PatientSenetPlanFormCard } from '../billing/PatientSenetPlanFormCard';
import { NewPatientDevicesSection } from './NewPatientDevicesSection';
import { Button } from '../../../../components/ui/Button';
import {
  useNewPatientForm,
  formatCurrencyTry,
} from '../../hooks/useNewPatientForm';

type NewPatientFormCardProps = {
  open: boolean;
  onToggle: () => void;
  onSubmit: (values: NewPatientForm) => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

type FromTrialState = {
  fromTrial?: {
    trialId: string;
    fullName: string;
    phone: string | null;
    referenceId: string | null;
    referenceName?: string | null;
    note?: string | null;
  };
  fromTrialDevices?: {
    side: NewPatientDeviceDraft['side'] | null;
    brand: string | null;
    model: string | null;
  }[];
};

export function NewPatientFormCard({
  open,
  onToggle,
  onSubmit,
  isSubmitting,
  errorMessage,
}: NewPatientFormCardProps) {
  const location = useLocation() as { state?: FromTrialState };
  const fromTrial = location.state?.fromTrial;
  const fromTrialDevices = location.state?.fromTrialDevices ?? [];

  const [fromTrialApplied, setFromTrialApplied] = useState(false);

  const {
    formState,
    setFormState,
    paymentRows,
    handleAddPaymentRow,
    handleChangePaymentRow,
    handleRemovePaymentRow,
    deviceDrafts,
    setDeviceDrafts,
    handleAddDeviceRow,
    handleChangeDeviceRow,
    handleRemoveDeviceRow,
    senetUpfrontPaid,
    setSenetUpfrontPaid,
    senetInstallmentCount,
    setSenetInstallmentCount,
    senetFirstDueDate,
    setSenetFirstDueDate,
    senetDayOfMonth,
    setSenetDayOfMonth,
    paymentsTotal,
    hasSenetPayment,
    handleSubmit,
    combinedError,
  } = useNewPatientForm({
    onSubmit,
    externalErrorMessage: errorMessage,
  });

  // Eğer form deneme (trial) detayından açıldıysa, ilk render'da temel alanları
  // ve varsa cihaz bilgilerini doldur.
  useEffect(() => {
    if (!fromTrial || fromTrialApplied) return;

    const mappedDevices: NewPatientDeviceDraft[] =
      fromTrialDevices && fromTrialDevices.length > 0
        ? fromTrialDevices
            .filter(
              (d) =>
                (d.brand && d.brand.trim().length > 0) ||
                (d.model && d.model.trim().length > 0),
            )
            .slice(0, 2)
            .map((d) => ({
              inventoryItemId: null,
              side: (d.side ?? '') as NewPatientDeviceDraft['side'],
              brand: d.brand?.trim() ?? '',
              model: d.model?.trim() ?? '',
              listPrice: '',
              salePrice: '',
              note: '',
            }))
        : [];

    setFormState((s) => {
      const nextBase = {
        ...s,
        fullName: fromTrial.fullName || s.fullName,
        phone: fromTrial.phone ?? s.phone,
        referenceId: fromTrial.referenceId ?? s.referenceId,
        referenceName:
          fromTrial.referenceName != null && fromTrial.referenceName !== ''
            ? fromTrial.referenceName
            : s.referenceName,
      };

      if (mappedDevices.length > 0) {
        return {
          ...nextBase,
          sgkDeviceCount:
            mappedDevices.length >= 2
              ? '2'
              : (nextBase.sgkDeviceCount ?? '1'),
        };
      }

      return nextBase;
    });

    if (mappedDevices.length > 0) {
      setDeviceDrafts(mappedDevices);
    }

    setFromTrialApplied(true);
  }, [
    fromTrial,
    fromTrialApplied,
    fromTrialDevices,
    setFormState,
    setDeviceDrafts,
  ]);

  const deviceFlowType = formState.deviceFlowType ?? 'rechargeable_device';
  const isBatteryOnly = deviceFlowType === 'battery_only';

  return (
    <InlineCreateCard
      title="Yeni Hasta Ekle"
      description="Yeni kayıt için kısa form. Özlük, SGK ve ödeme bilgileri ana listede uyarıları tetikler."
      open={open}
      onToggle={onToggle}
      errorMessage={combinedError}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Özlük bilgileri bloğu */}
        <FormSection
          title="Özlük Bilgileri"
          description='Bu bilgiler hasta detayında "Özlük Bilgileri" bölümünde görüntülenir. Doldurmak zorunlu değildir; gerektiğinde daha sonra da güncellenebilir.'
        >
          <div className="grid gap-3 md:grid-cols-12">
            {/* Column 1: Ad Soyad + T.C. Kimlik No */}
            <div className="space-y-2 md:col-span-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  required
                  value={formState.fullName}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      fullName: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Örn. Ahmet Yılmaz"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  T.C. Kimlik No
                </label>
                <input
                  type="text"
                  required
                  value={formState.nationalId}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      nationalId: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="11 haneli T.C. no"
                />
              </div>
            </div>

            {/* Column 2: Telefon + Yakın Telefon */}
            <div className="space-y-2 md:col-span-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Telefon
                </label>
                <input
                  type="tel"
                  required
                  value={formState.phone}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      phone: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="05XXXXXXXXX veya +49..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Yakın Telefonu
                </label>
                <input
                  type="tel"
                  value={formState.kinPhone}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      kinPhone: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Acil durumda aranacak kişi"
                />
              </div>
            </div>

            {/* Column 3: Referans + Adres */}
            <div className="space-y-2 md:col-span-4">
              <div className="relative">
                <NewPatientReferenceField
                  referenceId={formState.referenceId}
                  referenceName={formState.referenceName}
                  onChangeReference={({
                    id,
                    name,
                  }: {
                    id: string | null;
                    name: string;
                  }) =>
                    setFormState((s) => ({
                      ...s,
                      referenceId: id,
                      referenceName: name,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Adres
                </label>
                <textarea
                  value={formState.address}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      address: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Kısa adres bilgisi"
                />
              </div>
            </div>
          </div>
        </FormSection>

        {/* Cihazlar bloğu (ÖNCE) */}
        <FormSection
          title="Cihazlar"
          description="Önce cihaz/pil tipini seçin. Seçime göre cihaz satırları, şarj aleti veya pil kutusu açılır."
        >
          <NewPatientDevicesSection
            deviceFlowType={deviceFlowType}
            onChangeDeviceFlowType={(value) =>
              setFormState((s) => ({
                ...s,
                deviceFlowType: value,
                // Keep charger selection only for rechargeable flow.
                chargerInventoryItemId:
                  value === 'rechargeable_device'
                    ? s.chargerInventoryItemId ?? null
                    : null,
                // Keep battery lines only for battery flows (but do not clear them to avoid data loss).
              }))
            }
            chargerInventoryItemId={formState.chargerInventoryItemId ?? null}
            onChangeChargerInventoryItemId={(id) =>
              setFormState((s) => ({
                ...s,
                chargerInventoryItemId: id,
              }))
            }
            batteryLines={(formState.batteryLines ?? []) as BatteryLineDraft[]}
            onChangeBatteryLines={(lines) =>
              setFormState((s) => ({
                ...s,
                batteryLines: lines,
              }))
            }
            items={deviceDrafts}
            onAddRow={handleAddDeviceRow}
            onChangeRow={handleChangeDeviceRow}
            onRemoveRow={handleRemoveDeviceRow}
          />
        </FormSection>

        {/* SGK + Ödeme bloğu (SONRA) */}
        <FormSection title="SGK ve Ödeme">
          <div className="grid gap-3 md:grid-cols-12 md:items-start">
            <div className="md:col-span-4">
              <NewPatientSgkSection
                deviceFlowType={deviceFlowType}
                sgkPillPrescription={!!formState.sgkPillPrescription}
                onChangeSgkPillPrescription={(v) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPillPrescription: v,
                  }))
                }
                sgkFlag={formState.sgkFlag}
                sgkPrescriptionReceived={formState.sgkPrescriptionReceived}
                sgkRecordedToSystem={formState.sgkRecordedToSystem}
                sgkProfileId={formState.sgkProfileId ?? ''}
                sgkExpectedReimbursement={
                  formState.sgkExpectedReimbursement ?? ''
                }
                sgkExpectedMonth={formState.sgkExpectedMonth ?? ''}
                sgkPrescriptionNo={formState.sgkPrescriptionNo ?? ''}
                sgkDeviceCount={formState.sgkDeviceCount ?? '1'}
                onChangeSgkFlag={(value: boolean) =>
                  setFormState((s) => ({
                    ...s,
                    sgkFlag: value,
                    sgkPrescriptionReceived: value
                      ? s.sgkPrescriptionReceived
                      : false,
                    sgkRecordedToSystem: value
                      ? s.sgkRecordedToSystem
                      : false,
                    sgkProfileId: value ? s.sgkProfileId ?? '' : '',
                    sgkExpectedReimbursement: value
                      ? s.sgkExpectedReimbursement ?? ''
                      : '',
                    sgkExpectedMonth: value ? s.sgkExpectedMonth ?? '' : '',
                    sgkPrescriptionNo: value ? s.sgkPrescriptionNo ?? '' : '',
                    sgkDeviceCount: value ? s.sgkDeviceCount ?? '1' : '1',
                    sgkPillPrescription: value ? !!s.sgkPillPrescription : false,
                  }))
                }
                onChangeSgkPrescriptionReceived={(value: boolean) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPrescriptionReceived: value,
                  }))
                }
                onChangeSgkRecordedToSystem={(value: boolean) =>
                  setFormState((s) => ({
                    ...s,
                    sgkRecordedToSystem: value,
                  }))
                }
                onChangeSgkProfileId={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkProfileId: value,
                  }))
                }
                onChangeSgkExpectedReimbursement={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkExpectedReimbursement: value,
                  }))
                }
                onChangeSgkExpectedMonth={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkExpectedMonth: value,
                  }))
                }
                onChangeSgkPrescriptionNo={(value: string) =>
                  setFormState((s) => ({
                    ...s,
                    sgkPrescriptionNo: value,
                  }))
                }
                onChangeSgkDeviceCount={(value: '1' | '2') =>
                  setFormState((s) => ({
                    ...s,
                    sgkDeviceCount: value,
                  }))
                }
              />
            </div>

            <div className="md:col-span-8 space-y-3">
              {paymentRows.map((row, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">
                      Ödeme #{index + 1}
                    </span>
                    {paymentRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePaymentRow(index)}
                        className="text-[11px] font-medium text-red-600 hover:underline"
                      >
                        Satırı sil
                      </button>
                    )}
                  </div>

                  <NewPatientPaymentSection
                    allowEmpty={isBatteryOnly}
                    paymentMethod={row.paymentMethod}
                    saleTotal={row.amount}
                    cardFeeRate={row.cardFeeRate}
                    onChangePaymentMethod={(value) =>
                      handleChangePaymentRow(index, { paymentMethod: value })
                    }
                    onChangeSaleTotal={(value) =>
                      handleChangePaymentRow(index, { amount: value })
                    }
                    onChangeCardFeeRate={(value) =>
                      handleChangePaymentRow(index, { cardFeeRate: value })
                    }
                  />
                </div>
              ))}

              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleAddPaymentRow}
                  className="inline-flex items-center rounded-md border border-dashed border-primary-300 px-3 py-1.5 text-xs font-medium text-primary-700 hover:border-primary-400 hover:bg-primary-50"
                >
                  Yeni ödeme satırı ekle
                </button>
                <p className="text-[11px] text-slate-700">
                  Çoklu ödemelerin toplamı:{' '}
                  <span className="font-semibold">
                    {formatCurrencyTry(
                      paymentsTotal > 0 ? paymentsTotal : null,
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {hasSenetPayment && (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-slate-600">
                Aşağıdaki alanlar bu yeni hasta için senet planı taslağını
                tutar. Hasta kaydından sonra bu bilgiler detay ekranındaki
                Ödemeler sekmesinde de düzenlenebilir.
              </p>

              <PatientSenetPlanFormCard
                plan={null}
                saleTotal={paymentsTotal.toString()}
                upfrontPaid={senetUpfrontPaid}
                installmentCount={senetInstallmentCount}
                firstDueDate={senetFirstDueDate}
                dayOfMonth={senetDayOfMonth}
                setSaleTotal={(_v: string) => {
                  return;
                }}
                setUpfrontPaid={setSenetUpfrontPaid}
                setInstallmentCount={setSenetInstallmentCount}
                setFirstDueDate={setSenetFirstDueDate}
                setDayOfMonth={setSenetDayOfMonth}
                isPlanSaveError={false}
                planSaveError={null}
                isPlanError={false}
                planError={null}
                isPlanSaving={false}
                patientId=""
                upsertPlan={async () => {
                  return;
                }}
              />
            </div>
          )}
        </FormSection>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
