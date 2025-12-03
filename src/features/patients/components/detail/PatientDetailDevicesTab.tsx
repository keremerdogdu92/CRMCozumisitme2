// src/features/patients/components/detail/PatientDetailDevicesTab.tsx
// Summary: Device & sale summary tab for patient detail drawer.
// Uses aggregated fields from patient_list_with_device on the PatientRow
// (device_brand, device_model, device_total_price, device_ear_side_summary)
// and detailed per-device rows from inventory_items via usePatientDevices.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DeviceRepairRow, PatientDeviceRow, PatientRow } from '../../types';
import { formatAmount } from '../../patientFormatUtils';
import {
  PATIENT_DEVICES_BY_PATIENT_QUERY_KEY,
  usePatientDevices,
} from '../../api/api.devices';
import { useCurrentProfile } from '../../../auth/useCurrentProfile';
import {
  DEVICE_REPAIRS_BY_PATIENT_QUERY_KEY,
  createDeviceRepairForInventoryItem,
  useDeviceRepairs,
} from '../../api/api.repairs';

type PatientDetailDevicesTabProps = {
  patient: PatientRow;
};

function formatEarSummary(summary: PatientRow['device_ear_side_summary']): string {
  switch (summary) {
    case 'right':
      return 'Sağ';
    case 'left':
      return 'Sol';
    case 'bilateral':
      return 'Çift';
    default:
      return '-';
  }
}

function formatEarSide(side: PatientDeviceRow['ear_side']): string {
  switch (side) {
    case 'right':
      return 'Sağ';
    case 'left':
      return 'Sol';
    case 'bilateral':
      return 'Çift';
    default:
      return '-';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '-';
  }
}

export function PatientDetailDevicesTab({ patient }: PatientDetailDevicesTabProps) {
  const queryClient = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const hasDeviceSummary = !!patient.device_brand || !!patient.device_model;

  const deviceLabel = hasDeviceSummary
    ? [patient.device_brand, patient.device_model].filter(Boolean).join(' ')
    : '-';

  const recommendedTotal =
    patient.device_total_price != null
      ? formatAmount(patient.device_total_price)
      : '-';

  const saleTotal =
    patient.sale_total_amount != null ? formatAmount(patient.sale_total_amount) : '-';

  const earSummaryLabel = formatEarSummary(patient.device_ear_side_summary);

  const { data: devices, isLoading } = usePatientDevices(patient.id);
  const deviceRows: PatientDeviceRow[] = devices ?? [];

  const { data: repairs } = useDeviceRepairs(patient.id);
  const allRepairs: DeviceRepairRow[] = repairs ?? [];
  const repairsByInventoryId = new Map<string, DeviceRepairRow[]>();

  allRepairs.forEach((r) => {
    if (!r.inventory_item_id) return;
    const arr = repairsByInventoryId.get(r.inventory_item_id) ?? [];
    arr.push(r);
    repairsByInventoryId.set(r.inventory_item_id, arr);
  });

  const [repairDevice, setRepairDevice] = useState<PatientDeviceRow | null>(null);
  const [repairReason, setRepairReason] = useState('');
  const [repairCargoCompany, setRepairCargoCompany] = useState('');
  const [repairCargoTrackingNo, setRepairCargoTrackingNo] = useState('');
  const [repairShipNow, setRepairShipNow] = useState(true);
  const [isSavingRepair, setIsSavingRepair] = useState(false);
  const [repairError, setRepairError] = useState<string | null>(null);

  const openRepairModalForDevice = (device: PatientDeviceRow) => {
    setRepairDevice(device);
    setRepairReason('');
    setRepairCargoCompany('');
    setRepairCargoTrackingNo('');
    setRepairShipNow(true);
    setRepairError(null);
  };

  const closeRepairModal = () => {
    setRepairDevice(null);
    setRepairReason('');
    setRepairCargoCompany('');
    setRepairCargoTrackingNo('');
    setRepairShipNow(true);
    setRepairError(null);
  };

  const handleSaveRepair = async () => {
    if (!repairDevice) return;
    if (!profile?.org_id) {
      setRepairError('Profil org_id bulunamadı. Yetkiyi kontrol edin.');
      return;
    }

    setIsSavingRepair(true);
    setRepairError(null);

    try {
      await createDeviceRepairForInventoryItem({
        orgId: profile.org_id,
        patientId: patient.id,
        inventoryItemId: repairDevice.id,
        reasonNote: repairReason,
        cargoCompany: repairCargoCompany || undefined,
        cargoTrackingNo: repairCargoTrackingNo || undefined,
        shipImmediately: repairShipNow,
      });

      closeRepairModal();
      queryClient.invalidateQueries({
        queryKey: DEVICE_REPAIRS_BY_PATIENT_QUERY_KEY(patient.id),
      });
      queryClient.invalidateQueries({
        queryKey: PATIENT_DEVICES_BY_PATIENT_QUERY_KEY(patient.id),
      });
    } catch (err) {
      console.error('createDeviceRepairForInventoryItem error:', err);
      setRepairError(
        err instanceof Error ? err.message : 'Tamir kaydı açılırken hata oluştu.',
      );
    } finally {
      setIsSavingRepair(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Overall device summary card */}
      <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">Cihaz</h4>

        {/* Device model */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Cihaz Modeli</span>
          <span className="max-w-[220px] text-right text-xs font-medium text-slate-900">
            {deviceLabel}
          </span>
        </div>

        {/* Ear summary */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Kulak</span>
          <span className="text-xs font-medium text-slate-900">{earSummaryLabel}</span>
        </div>

        {/* Recommended price total */}
        <div className="mt-1 flex justify-between gap-2 border-t border-slate-200 pt-1">
          <span className="text-xs text-slate-500">Tavsiye Satış Toplamı</span>
          <span className="text-xs font-semibold text-slate-900">
            {recommendedTotal}
          </span>
        </div>

        {/* Actual sale price total (first sale) */}
        <div className="flex justify-between gap-2">
          <span className="text-xs text-slate-500">Gerçek Satış Fiyatı (ilk satış)</span>
          <span className="text-xs font-semibold text-slate-900">{saleTotal}</span>
        </div>

        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          Tavsiye satış toplamı, stokta bu hastaya bağlanan cihazların liste
          fiyatlarının toplamıdır. Gerçek satış fiyatı ise hasta kaydında girilen ilk satış
          tutarını gösterir. Sonradan eklenen aksesuar ve tamirler ayrı kalemler olarak
          izlenecektir.
        </p>

        {!hasDeviceSummary && (
          <p className="mt-1 text-[11px] text-slate-500">
            Bu hastaya bağlı cihaz kaydı henüz görünmüyor. Stok modülünden cihaz
            bağlandığında burada listelenecek.
          </p>
        )}
      </div>

      {/* Per-ear device breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Kulak Bazında Cihazlar
        </h4>

        {isLoading && (
          <p className="text-[11px] text-slate-500">Cihazlar yükleniyor…</p>
        )}

        {!isLoading && deviceRows.length === 0 && (
          <p className="text-[11px] text-slate-500">
            Bu hastaya bağlı stok cihazı bulunamadı. Satışı yapılan cihazları stok
            modülünden bu hastaya bağladığınızda burada görünecek.
          </p>
        )}

        {!isLoading &&
          deviceRows.map((d) => (
            <div
              key={d.id}
              className="space-y-1 rounded-md border border-slate-100 bg-white px-3 py-2 shadow-sm"
            >
              {/* Ear + model header */}
              <div className="flex justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase text-slate-500">Kulak</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {formatEarSide(d.ear_side)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[11px] uppercase text-slate-500">
                    Marka / Model
                  </span>
                  <span className="text-xs font-medium text-slate-900">
                    {[d.brand, d.model].filter(Boolean).join(' ')}
                  </span>
                </div>
              </div>

              {/* Barcode / Serial */}
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase text-slate-500">Barkod</span>
                  <span className="text-[11px] text-slate-900">{d.barcode || '-'}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[11px] uppercase text-slate-500">Seri No</span>
                  <span className="text-[11px] text-slate-900">{d.serial_no || '-'}</span>
                </div>
              </div>

              {/* Sale date only - no per-ear prices */}
              <div className="mt-1 flex justify-between gap-2">
                <span className="text-[11px] uppercase text-slate-500">Satış Tarihi</span>
                <span className="text-[11px] text-slate-900">{formatDate(d.sold_at)}</span>
              </div>

              {(() => {
                const deviceRepairs = repairsByInventoryId.get(d.id) ?? [];
                const totalRepairs = deviceRepairs.length;
                return (
                  <>
                    {totalRepairs > 0 && (
                      <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-slate-200 pt-1">
                        <span className="text-[11px] text-slate-500">Tamir geçmişi</span>
                        <span className="text-[11px] font-medium text-slate-900">
                          {totalRepairs} kez tamire gitti
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="mt-1 text-left text-[11px] text-slate-500 underline"
                      onClick={() => openRepairModalForDevice(d)}
                    >
                      Tamir süreci başlat
                    </button>
                  </>
                );
              })()}
            </div>
          ))}
      </div>

      {repairDevice && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-3">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h5 className="text-sm font-semibold text-slate-900">
              Tamire gönder:{' '}
              {[repairDevice.brand, repairDevice.model].filter(Boolean).join(' ')}
            </h5>
            <p className="mt-1 text-[11px] text-slate-500">
              Bu alan nadiren kullanılacak; lütfen neden tamire gittiğini kısaca not edin.
            </p>

            <div className="mt-3 space-y-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  Neden / Not
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  rows={2}
                  value={repairReason}
                  onChange={(e) => setRepairReason(e.target.value)}
                  placeholder="Örn: Sağ kulak üstten su aldı, mikrofon çalışmıyor"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Kargo / Kuryesi
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={repairCargoCompany}
                    onChange={(e) => setRepairCargoCompany(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Takip No
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={repairCargoTrackingNo}
                    onChange={(e) => setRepairCargoTrackingNo(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={repairShipNow}
                  onChange={(e) => setRepairShipNow(e.target.checked)}
                />
                Servise şimdi kargolandı (durum: shipped)
              </label>

              {repairError && (
                <p className="text-[11px] text-red-600">{repairError}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="text-[11px] text-slate-600 underline"
                onClick={closeRepairModal}
                disabled={isSavingRepair}
              >
                İptal
              </button>
              <button
                type="button"
                className="rounded-md bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50"
                onClick={handleSaveRepair}
                disabled={isSavingRepair}
              >
                {isSavingRepair ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
