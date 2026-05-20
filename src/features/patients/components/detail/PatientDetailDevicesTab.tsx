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
  attachPatientInventoryItem,
  replacePatientInventoryItem,
  updateInventoryItem,
  usePatientDevices,
} from '../../api/api.devices';
import { PATIENTS_QUERY_KEY } from '../../api/api.core';
import {
  INVENTORY_QUERY_KEY,
  useInventoryItems,
} from '../../../inventory/api';
import type { InventoryItemRow } from '../../../inventory/types';
import { useCurrentProfile } from '../../../auth/useCurrentProfile';
import {
  DEVICE_REPAIRS_BY_PATIENT_QUERY_KEY,
  createDeviceRepairForInventoryItem,
  useDeviceRepairs,
} from '../../api/api.repairs';
import { updatePatientSaleAmount } from '../../api/api.patients.update';

type PatientDetailDevicesTabProps = {
  patient: PatientRow;
};

type DeviceAssignModalState =
  | { mode: 'add' }
  | { mode: 'replace'; oldDevice: PatientDeviceRow };

type DeviceAssignFields = {
  inventoryItemId: string;
  earSide: '' | 'right' | 'left' | 'bilateral';
  soldAt: string;
  devicePrice: string;
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

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseOptionalMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatInventoryOption(row: InventoryItemRow): string {
  const identity = row.serial_no || row.barcode || 'Seri yok';
  return `${identity} - ${row.brand} ${row.model}`;
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

  const { data: inventoryRows, isLoading: isInventoryLoading } =
    useInventoryItems();
  const availableInventoryRows: InventoryItemRow[] = (inventoryRows ?? []).filter(
    (row) =>
      row.item_type === 'hearing_aid' &&
      row.status === 'in_stock' &&
      !row.sold_patient_id &&
      !row.deleted_at,
  );

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

  // Edit device modal state
  const [editDevice, setEditDevice] = useState<PatientDeviceRow | null>(null);
  const [editFields, setEditFields] = useState({
    barcode: '',
    serial_no: '',
    ear_side: '' as string,
    purchase_price: '',
    list_price: '',
    device_price: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [assignModal, setAssignModal] = useState<DeviceAssignModalState | null>(
    null,
  );
  const [assignFields, setAssignFields] = useState<DeviceAssignFields>({
    inventoryItemId: '',
    earSide: '',
    soldAt: todayDateInput(),
    devicePrice: '',
  });
  const [isSavingAssign, setIsSavingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Sale amount inline edit state
  const [isEditingSale, setIsEditingSale] = useState(false);
  const [saleAmountDraft, setSaleAmountDraft] = useState('');
  const [isSavingSale, setIsSavingSale] = useState(false);

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

  const openEditModal = (d: PatientDeviceRow) => {
    setEditDevice(d);
    setEditFields({
      barcode: d.barcode ?? '',
      serial_no: d.serial_no ?? '',
      ear_side: d.ear_side ?? '',
      purchase_price: d.purchase_price != null ? String(d.purchase_price) : '',
      list_price: d.list_price != null ? String(d.list_price) : '',
      device_price: d.device_price != null ? String(d.device_price) : '',
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditDevice(null);
    setEditError(null);
  };

  const openAddDeviceModal = () => {
    setAssignModal({ mode: 'add' });
    setAssignFields({
      inventoryItemId: '',
      earSide: '',
      soldAt: todayDateInput(),
      devicePrice: '',
    });
    setAssignError(null);
  };

  const openReplaceDeviceModal = (device: PatientDeviceRow) => {
    setAssignModal({ mode: 'replace', oldDevice: device });
    setAssignFields({
      inventoryItemId: '',
      earSide: device.ear_side ?? '',
      soldAt: todayDateInput(),
      devicePrice: device.device_price != null ? String(device.device_price) : '',
    });
    setAssignError(null);
  };

  const closeAssignModal = () => {
    setAssignModal(null);
    setAssignError(null);
  };

  const handleSelectAssignInventory = (inventoryItemId: string) => {
    const selected = availableInventoryRows.find((row) => row.id === inventoryItemId);
    setAssignFields((fields) => ({
      ...fields,
      inventoryItemId,
      devicePrice:
        selected?.list_price != null ? String(selected.list_price) : fields.devicePrice,
    }));
  };

  const handleSaveEdit = async () => {
    if (!editDevice) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      const earVal = editFields.ear_side;
      const ear: 'right' | 'left' | 'bilateral' | null =
        earVal === 'right' || earVal === 'left' || earVal === 'bilateral'
          ? earVal
          : null;

      await updateInventoryItem(editDevice.id, {
        barcode: editFields.barcode || null,
        serial_no: editFields.serial_no || null,
        ear_side: ear,
        purchase_price: editFields.purchase_price
          ? Number(editFields.purchase_price)
          : null,
        list_price: editFields.list_price
          ? Number(editFields.list_price)
          : null,
        device_price: editFields.device_price
          ? Number(editFields.device_price)
          : null,
      });

      closeEditModal();
      queryClient.invalidateQueries({
        queryKey: PATIENT_DEVICES_BY_PATIENT_QUERY_KEY(patient.id),
      });
    } catch (err) {
      console.error('updateInventoryItem error:', err);
      setEditError(
        err instanceof Error ? err.message : 'Cihaz güncellenirken hata oluştu.',
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveAssignDevice = async () => {
    if (!assignModal) return;

    if (!assignFields.inventoryItemId) {
      setAssignError('Stoktan bağlanacak cihazı seçin.');
      return;
    }
    if (
      assignFields.earSide !== 'right' &&
      assignFields.earSide !== 'left' &&
      assignFields.earSide !== 'bilateral'
    ) {
      setAssignError('Kulak tarafını seçin.');
      return;
    }

    const devicePrice = parseOptionalMoney(assignFields.devicePrice);
    if (assignFields.devicePrice.trim() && devicePrice == null) {
      setAssignError('Cihaz fiyatı geçersiz. Örnek: 12500 veya 12.500,50');
      return;
    }

    const soldAt = dateInputToIso(assignFields.soldAt);
    if (assignFields.soldAt.trim() && !soldAt) {
      setAssignError('Satış tarihi geçersiz.');
      return;
    }

    setIsSavingAssign(true);
    setAssignError(null);

    try {
      if (assignModal.mode === 'replace') {
        await replacePatientInventoryItem({
          patientId: patient.id,
          oldInventoryItemId: assignModal.oldDevice.id,
          inventoryItemId: assignFields.inventoryItemId,
          earSide: assignFields.earSide,
          soldAt,
          devicePrice,
        });
      } else {
        await attachPatientInventoryItem({
          patientId: patient.id,
          inventoryItemId: assignFields.inventoryItemId,
          earSide: assignFields.earSide,
          soldAt,
          devicePrice,
        });
      }

      closeAssignModal();
      await queryClient.invalidateQueries({
        queryKey: PATIENT_DEVICES_BY_PATIENT_QUERY_KEY(patient.id),
      });
      await queryClient.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    } catch (err) {
      console.error('handleSaveAssignDevice error:', err);
      setAssignError(
        err instanceof Error
          ? err.message
          : 'Cihaz bağlanırken beklenmeyen bir hata oluştu.',
      );
    } finally {
      setIsSavingAssign(false);
    }
  };

  const handleSaveSaleAmount = async () => {
    setIsSavingSale(true);
    try {
      const num = saleAmountDraft.trim() ? Number(saleAmountDraft) : null;
      await updatePatientSaleAmount({
        id: patient.id,
        saleTotalAmount: num != null && Number.isFinite(num) ? num : null,
      });
      setIsEditingSale(false);
      // Invalidate patient list so drawer re-renders with updated value
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    } catch (err) {
      console.error('updatePatientSaleAmount error:', err);
    } finally {
      setIsSavingSale(false);
    }
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

        {/* Actual sale price total (first sale) — inline editable */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Gerçek Satış Fiyatı</span>
          {isEditingSale ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                className="w-28 rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs"
                value={saleAmountDraft}
                onChange={(e) => setSaleAmountDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSaleAmount();
                  if (e.key === 'Escape') setIsEditingSale(false);
                }}
              />
              <button
                type="button"
                className="text-[11px] font-semibold text-primary-600 disabled:opacity-50"
                onClick={handleSaveSaleAmount}
                disabled={isSavingSale}
              >
                {isSavingSale ? '...' : 'Kaydet'}
              </button>
              <button
                type="button"
                className="text-[11px] text-slate-400"
                onClick={() => setIsEditingSale(false)}
                disabled={isSavingSale}
              >
                İptal
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1">
              <span className="text-xs font-semibold text-slate-900">{saleTotal}</span>
              <button
                type="button"
                className="text-[11px] text-blue-600 underline"
                onClick={() => {
                  setSaleAmountDraft(
                    patient.sale_total_amount != null
                      ? String(patient.sale_total_amount)
                      : '',
                  );
                  setIsEditingSale(true);
                }}
              >
                Düzenle
              </button>
            </span>
          )}
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
        <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-slate-500">
          Kulak Bazında Cihazlar
        </h4>
          <button
            type="button"
            className="rounded-md border border-primary-200 px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            onClick={openAddDeviceModal}
            disabled={isInventoryLoading || isSavingAssign}
          >
            Cihaz ekle
          </button>
        </div>

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

                    <div className="mt-1 flex gap-3">
                      <button
                        type="button"
                        className="text-[11px] text-blue-600 underline"
                        onClick={() => openEditModal(d)}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-primary-700 underline"
                        onClick={() => openReplaceDeviceModal(d)}
                      >
                        Cihaz değiştir
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-slate-500 underline"
                        onClick={() => openRepairModalForDevice(d)}
                      >
                        Tamir süreci başlat
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
      </div>

      {assignModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-3">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-lg">
            <h5 className="text-sm font-semibold text-slate-900">
              {assignModal.mode === 'replace'
                ? 'Cihaz değiştir'
                : 'Stoktan cihaz ekle'}
            </h5>
            {assignModal.mode === 'replace' && (
              <p className="mt-1 text-[11px] text-slate-500">
                Eski cihaz stoka döner; seçtiğiniz yeni cihaz bu hastaya satıldı
                olarak bağlanır.
              </p>
            )}

            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  Stoktaki cihaz
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  value={assignFields.inventoryItemId}
                  onChange={(e) => handleSelectAssignInventory(e.target.value)}
                  disabled={isInventoryLoading || isSavingAssign}
                >
                  <option value="">
                    {availableInventoryRows.length > 0
                      ? 'Cihaz seçin'
                      : 'Stokta bağlanabilir cihaz yok'}
                  </option>
                  {availableInventoryRows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatInventoryOption(row)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Kulak
                  </label>
                  <select
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={assignFields.earSide}
                    onChange={(e) =>
                      setAssignFields((fields) => ({
                        ...fields,
                        earSide: e.target.value as DeviceAssignFields['earSide'],
                      }))
                    }
                    disabled={isSavingAssign}
                  >
                    <option value="">Seçiniz</option>
                    <option value="right">Sağ</option>
                    <option value="left">Sol</option>
                    <option value="bilateral">Çift</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Satış tarihi
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={assignFields.soldAt}
                    onChange={(e) =>
                      setAssignFields((fields) => ({
                        ...fields,
                        soldAt: e.target.value,
                      }))
                    }
                    disabled={isSavingAssign}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Cihaz fiyatı
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={assignFields.devicePrice}
                    onChange={(e) =>
                      setAssignFields((fields) => ({
                        ...fields,
                        devicePrice: e.target.value,
                      }))
                    }
                    placeholder="Opsiyonel"
                    disabled={isSavingAssign}
                  />
                </div>
              </div>

              {assignError && (
                <p className="text-[11px] text-red-600">{assignError}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="text-[11px] text-slate-600 underline"
                onClick={closeAssignModal}
                disabled={isSavingAssign}
              >
                İptal
              </button>
              <button
                type="button"
                className="rounded-md bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50"
                onClick={handleSaveAssignDevice}
                disabled={isSavingAssign}
              >
                {isSavingAssign ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Edit device modal */}
      {editDevice && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-3">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg">
            <h5 className="text-sm font-semibold text-slate-900">
              Cihaz Düzenle:{' '}
              {[editDevice.brand, editDevice.model].filter(Boolean).join(' ')}
            </h5>

            <div className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Barkod
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={editFields.barcode}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, barcode: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Seri No
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={editFields.serial_no}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, serial_no: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-600">
                  Kulak Tarafı
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                  value={editFields.ear_side}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, ear_side: e.target.value }))
                  }
                >
                  <option value="">Seçiniz</option>
                  <option value="right">Sağ</option>
                  <option value="left">Sol</option>
                  <option value="bilateral">Çift</option>
                </select>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Alış Fiyatı
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={editFields.purchase_price}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        purchase_price: e.target.value,
                      }))
                    }
                    placeholder="₺"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Liste Fiyatı
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={editFields.list_price}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        list_price: e.target.value,
                      }))
                    }
                    placeholder="₺"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-600">
                    Cihaz Fiyatı
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    value={editFields.device_price}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        device_price: e.target.value,
                      }))
                    }
                    placeholder="₺"
                  />
                </div>
              </div>

              {editError && (
                <p className="text-[11px] text-red-600">{editError}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="text-[11px] text-slate-600 underline"
                onClick={closeEditModal}
                disabled={isSavingEdit}
              >
                İptal
              </button>
              <button
                type="button"
                className="rounded-md bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Kaydediliyor...' : 'Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
