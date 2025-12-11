// src/features/trials/TrialNewFormCard.tsx
// Inline create card wrapper for creating new trial records using InlineCreateCard,
// including one or more trial device rows.

import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import type { NewTrialForm, DeviceModelPriceRow, TrialDeviceFormRow } from './types';
import {
  DEVICE_BRANDS_QUERY_KEY,
  DEVICE_MODELS_BY_BRAND_QUERY_KEY,
  fetchDeviceBrands,
  fetchDeviceModelsByBrand,
} from './api';
import { searchReferencesByName } from '../references/api';

type TrialNewFormCardProps = {
  open: boolean;
  onToggle: () => void;
  values: NewTrialForm;
  onChange: (patch: Partial<NewTrialForm>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

type DeviceRowProps = {
  row: TrialDeviceFormRow;
  index: number;
  brands: string[];
  deviceSectionDisabled: boolean;
  onChangeRow: (patch: Partial<TrialDeviceFormRow>) => void;
  onRemoveRow: () => void;
  isOnlyRow: boolean;
};

function DeviceRowFields({
  row,
  index,
  brands,
  deviceSectionDisabled,
  onChangeRow,
  onRemoveRow,
  isOnlyRow,
}: DeviceRowProps) {
  // Load models for this row's brand
  const {
    data: modelOptions = [],
    isLoading: isLoadingModels,
    isError: isModelsError,
  } = useQuery({
    queryKey: DEVICE_MODELS_BY_BRAND_QUERY_KEY(row.brand),
    queryFn: () => fetchDeviceModelsByBrand(row.brand),
    enabled: !!row.brand,
  });

  const handleSideChange = (side: string) => {
    const found = modelOptions.find((m) => m.model === row.model);
    if (!found) {
      onChangeRow({ side });
      return;
    }

    const perDevice = found.list_price;
    const total = side === 'both' || side === '' ? perDevice * 2 : perDevice;

    onChangeRow({
      side,
      listPrice: total.toFixed(2),
    });
  };

  const handleBrandChange = (brand: string) => {
    onChangeRow({
      brand,
      model: '',
      listPrice: '',
    });
  };

  const handleModelChange = (modelValue: string) => {
    const found = modelOptions.find((m) => m.model === modelValue);
    if (!found) {
      onChangeRow({
        model: modelValue,
        listPrice: '',
      });
      return;
    }

    const perDevice = found.list_price;
    const total = row.side === 'both' || row.side === '' ? perDevice * 2 : perDevice;

    onChangeRow({
      model: modelValue,
      listPrice: total.toFixed(2),
    });
  };

  return (
    <>
      {/* Row header with remove button */}
      <div className="md:col-span-4 mt-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700">
          Cihaz {index + 1}
        </p>
        {!isOnlyRow && (
          <button
            type="button"
            onClick={onRemoveRow}
            className="text-[11px] text-red-600 hover:underline"
          >
            Satırı Sil
          </button>
        )}
      </div>

      {/* Side */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Kulak Yönü
        </label>
        <select
          value={row.side}
          onChange={(e) => handleSideChange(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
          disabled={deviceSectionDisabled}
        >
          <option value="">Seçin...</option>
          <option value="both">Her iki kulak</option>
          <option value="right">Sağ</option>
          <option value="left">Sol</option>
        </select>
      </div>

      {/* Brand */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Marka
        </label>
        <select
          value={row.brand}
          onChange={(e) => handleBrandChange(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
          disabled={deviceSectionDisabled}
        >
          {brands.length === 0 && <option>Markalar yükleniyor...</option>}
          {brands.length > 0 && (
            <>
              <option value="">Seçin...</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Model
        </label>
        <select
          value={row.model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
          disabled={!row.brand || isLoadingModels || isModelsError}
        >
          {!row.brand && <option>Önce marka seçin</option>}
          {row.brand && isLoadingModels && <option>Modeller yükleniyor...</option>}
          {row.brand && isModelsError && <option>Modeller alınamadı</option>}
          {row.brand && !isLoadingModels && !isModelsError && (
            <>
              <option value="">Seçin...</option>
              {modelOptions.map((m: DeviceModelPriceRow) => (
                <option key={m.id} value={m.model}>
                  {m.model}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Suggested list price (readonly) */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Önerilen Liste Fiyatı (toplam)
        </label>
        <input
          type="text"
          value={row.listPrice}
          readOnly
          className="w-full rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          placeholder={
            row.brand && row.model
              ? 'Model seçildiğinde otomatik dolar'
              : 'Önce marka ve model seçin'
          }
        />
      </div>

      {/* Quote price (user-entered) */}
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Toplam Satış Fiyatı
        </label>
        <input
          type="text"
          value={row.quotePrice}
          onChange={(e) => onChangeRow({ quotePrice: e.target.value })}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Örn. 35000"
          required
          disabled={deviceSectionDisabled}
        />
      </div>

      {/* Spacer to align grid */}
      <div className="md:col-span-2" />
    </>
  );
}

export function TrialNewFormCard({
  open,
  onToggle,
  values,
  onChange,
  onSubmit,
  isSubmitting,
  errorMessage,
}: TrialNewFormCardProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!values.fullName.trim()) return;

    const validDevices = (values.devices ?? []).filter(
      (d) => d.brand && d.model && d.quotePrice.trim(),
    );
    if (validDevices.length === 0) return;

    onSubmit();
  };

  const referenceSearchTerm = values.referenceName ?? '';
  const trimmedReferenceSearchTerm = referenceSearchTerm.trim();
  const showReferenceDropdown =
    trimmedReferenceSearchTerm.length >= 2 && !values.referenceId;

  const {
    data: referenceOptions = [],
    isLoading: isLoadingReferences,
    isError: isReferencesError,
  } = useQuery<{ id: string; full_name: string }[]>({
    queryKey: ['reference-search', trimmedReferenceSearchTerm],
    queryFn: () => searchReferencesByName(trimmedReferenceSearchTerm),
    enabled: showReferenceDropdown,
  });

  // Load device brands once
  const {
    data: brandOptions = [],
    isLoading: isLoadingBrands,
    isError: isBrandsError,
  } = useQuery({
    queryKey: DEVICE_BRANDS_QUERY_KEY,
    queryFn: fetchDeviceBrands,
  });

  const deviceSectionDisabled = isLoadingBrands || isBrandsError;

  const updateDeviceRow = (index: number, patch: Partial<TrialDeviceFormRow>) => {
    const next = values.devices.map((row, idx) =>
      idx === index ? { ...row, ...patch } : row,
    );
    onChange({ devices: next });
  };

  const removeDeviceRow = (index: number) => {
    if (values.devices.length <= 1) {
      // If only one row, just clear it instead of removing
      const cleared: TrialDeviceFormRow = {
        ...values.devices[0],
        side: '',
        brand: '',
        model: '',
        listPrice: '',
        quotePrice: '',
      };
      onChange({ devices: [cleared] });
      return;
    }

    const next = values.devices.filter((_, idx) => idx !== index);
    onChange({ devices: next });
  };

  const addDeviceRow = () => {
    const newRow: TrialDeviceFormRow = {
      rowKey: `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      side: '',
      brand: '',
      model: '',
      listPrice: '',
      quotePrice: '',
    };
    onChange({ devices: [...values.devices, newRow] });
  };

  return (
    <InlineCreateCard
      title="Yeni Deneme Hastası"
      description="Deneme için gelen kişiyi ve denediği cihazları birlikte kaydedin."
      open={open}
      onToggle={onToggle}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 md:grid-cols-4 md:items-start"
      >
        {/* Patient fields */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Ad Soyad
          </label>
          <input
            type="text"
            required
            value={values.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Ayşe Deneme"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Telefon
          </label>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="05XXXXXXXXX"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            İlk Görüşme Tarihi
          </label>
          <input
            type="datetime-local"
            value={values.firstMeetAt}
            onChange={(e) => onChange({ firstMeetAt: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Sonraki Randevu
          </label>
          <input
            type="datetime-local"
            value={values.nextMeetAt}
            onChange={(e) => onChange({ nextMeetAt: e.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Referans (opsiyonel)
          </label>
          <input
            type="text"
            value={values.referenceName ?? ''}
            onChange={(e) =>
              onChange({
                referenceName: e.target.value,
                // Editing text clears any previously selected id;
                // picking from the list will set it again.
                referenceId: null,
              })
            }
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. Dr. Ahmet, Medikal XYZ"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            En az 2 harf yazınca kayıtlı referanslar listelenir; birini seçerseniz bu
            deneme o referansa bağlanır.
          </p>
          {showReferenceDropdown && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white text-xs shadow-sm">
              {isLoadingReferences && (
                <div className="px-2 py-1 text-slate-500">Aranıyor...</div>
              )}
              {isReferencesError && !isLoadingReferences && (
                <div className="px-2 py-1 text-red-600">
                  Referanslar yüklenemedi.
                </div>
              )}
              {!isLoadingReferences &&
                !isReferencesError &&
                referenceOptions.length === 0 && (
                  <div className="px-2 py-1 text-slate-500">
                    Eşleşen referans bulunamadı.
                  </div>
                )}
              {!isLoadingReferences &&
                !isReferencesError &&
                referenceOptions.length > 0 && (
                  <ul>
                    {referenceOptions.map((ref) => (
                      <li key={ref.id}>
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              referenceId: ref.id,
                              referenceName: ref.full_name,
                            })
                          }
                          className="flex w-full items-center justify-between px-2 py-1 hover:bg-slate-50"
                        >
                          <span className="truncate">{ref.full_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}
        </div>

        {/* Note field */}
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Not (opsiyonel)
          </label>
          <textarea
            value={values.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Örn. İlk görüşmede sağ kulağa daha yatkın, kızıyla birlikte geldi, sessiz ortam tercih ediyor."
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Bu alan sadece iç notlar içindir; hastaya gösterilen teklif çıktısında yer almaz.
          </p>
        </div>

        {/* Divider */}
        <div className="md:col-span-4 h-px bg-slate-200 my-2" />

        {/* Device section header */}
        <div className="md:col-span-4">
          <p className="text-xs font-semibold text-slate-700">Deneme Cihazları</p>
          <p className="text-[11px] text-slate-500">
            Aynı deneme için birden fazla cihaz satırı ekleyebilirsiniz. Fiyat
            alanına bu satıra ait toplam satış fiyatını yazın (tek/çift, aksesuar
            dahil veya hariç olabilir).
          </p>
        </div>

        {/* Device rows */}
        {values.devices.map((row, index) => (
          <DeviceRowFields
            key={row.rowKey}
            row={row}
            index={index}
            brands={brandOptions}
            deviceSectionDisabled={deviceSectionDisabled}
            onChangeRow={(patch) => updateDeviceRow(index, patch)}
            onRemoveRow={() => removeDeviceRow(index)}
            isOnlyRow={values.devices.length === 1}
          />
        ))}

        {/* Add device row button */}
        <div className="md:col-span-4 flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={addDeviceRow}
            className="text-xs font-medium text-primary-700 hover:underline"
            disabled={deviceSectionDisabled || isSubmitting}
          >
            + Yeni cihaz satırı ekle
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </InlineCreateCard>
  );
}
