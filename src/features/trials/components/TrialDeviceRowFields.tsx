// src/features/trials/components/TrialDeviceRowFields.tsx
// Summary: Form fields for a single trial device row, including side, brand, model and prices.
// Loads model options per brand via React Query.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DeviceModelPriceRow, TrialDeviceFormRow } from '../types';
import {
  DEVICE_MODELS_BY_BRAND_QUERY_KEY,
  fetchDeviceModelsByBrand,
} from '../api';

type TrialDeviceRowFieldsProps = {
  row: TrialDeviceFormRow;
  index: number;
  brands: string[];
  deviceSectionDisabled: boolean;
  onChangeRow: (patch: Partial<TrialDeviceFormRow>) => void;
  onRemoveRow: () => void;
  isOnlyRow: boolean;
};

export const TrialDeviceRowFields: React.FC<TrialDeviceRowFieldsProps> = ({
  row,
  index,
  brands,
  deviceSectionDisabled,
  onChangeRow,
  onRemoveRow,
  isOnlyRow,
}) => {
  // Load models for this row's brand
  const {
    data: modelOptions = [],
    isLoading: isLoadingModels,
    isError: isModelsError,
  } = useQuery<DeviceModelPriceRow[]>({
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
              {modelOptions.map((m) => (
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
};
