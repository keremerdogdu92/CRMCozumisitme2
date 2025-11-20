// src/features/trials/TrialNewFormCard.tsx
// Inline create card wrapper for creating new trial records using InlineCreateCard.

import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InlineCreateCard } from '../../components/layout/InlineCreateCard';
import type { NewTrialForm, DeviceModelPriceRow } from './types';
import {
  DEVICE_BRANDS_QUERY_KEY,
  DEVICE_MODELS_BY_BRAND_QUERY_KEY,
  fetchDeviceBrands,
  fetchDeviceModelsByBrand,
} from './api';

type TrialNewFormCardProps = {
  open: boolean;
  onToggle: () => void;
  values: NewTrialForm;
  onChange: (patch: Partial<NewTrialForm>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
};

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
    if (!values.deviceBrand || !values.deviceModel || !values.deviceQuotePrice.trim()) return;
    onSubmit();
  };

  // Load device brands
  const {
    data: brandOptions = [],
    isLoading: isLoadingBrands,
    isError: isBrandsError,
  } = useQuery({
    queryKey: DEVICE_BRANDS_QUERY_KEY,
    queryFn: fetchDeviceBrands,
  });

  // Load models when a brand is selected
  const {
    data: modelOptions = [],
    isLoading: isLoadingModels,
    isError: isModelsError,
  } = useQuery({
    queryKey: DEVICE_MODELS_BY_BRAND_QUERY_KEY(values.deviceBrand),
    queryFn: () => fetchDeviceModelsByBrand(values.deviceBrand),
    enabled: !!values.deviceBrand,
  });

  const handleBrandChange = (brand: string) => {
    onChange({
      deviceBrand: brand,
      deviceModel: '',
      deviceListPrice: '',
    });
  };

  const handleModelChange = (modelValue: string, models: DeviceModelPriceRow[]) => {
    const found = models.find((m) => m.model === modelValue);
    if (!found) {
      onChange({
        deviceModel: modelValue,
        deviceListPrice: '',
      });
      return;
    }

    const perDevice = found.list_price;
    const total =
      values.deviceSide === 'both' || values.deviceSide === ''
        ? perDevice * 2
        : perDevice;

    onChange({
      deviceModel: modelValue,
      deviceListPrice: total.toFixed(2),
    });
  };

  const handleSideChange = (side: string, models: DeviceModelPriceRow[]) => {
    const found = models.find((m) => m.model === values.deviceModel);
    if (!found) {
      onChange({
        deviceSide: side,
      });
      return;
    }

    const perDevice = found.list_price;
    const total =
      side === 'both' || side === ''
        ? perDevice * 2
        : perDevice;

    onChange({
      deviceSide: side,
      deviceListPrice: total.toFixed(2),
    });
  };

  const deviceSectionDisabled = isLoadingBrands || isBrandsError;

  return (
    <InlineCreateCard
      title="Yeni Deneme Hastası"
      description="Deneme için gelen kişiyi ve denediği cihazı birlikte kaydedin."
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

        {/* Divider */}
        <div className="md:col-span-4 h-px bg-slate-200 my-2" />

        {/* Device section header */}
        <div className="md:col-span-4">
          <p className="text-xs font-semibold text-slate-700">
            Deneme Cihazı
          </p>
          <p className="text-[11px] text-slate-500">
            Genelde iki kulak için aynı marka ve model seçilir. Fiyat alanına verdiğiniz
            toplam fiyatı yazın (tek/çift, aksesuar olabilir veya olmayabilir).
          </p>
        </div>

        {/* Device side */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Kulak Yönü
          </label>
          <select
            value={values.deviceSide}
            onChange={(e) => handleSideChange(e.target.value, modelOptions)}
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

        {/* Device brand */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Marka
          </label>
          <select
            value={values.deviceBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
            disabled={deviceSectionDisabled}
          >
            {isLoadingBrands && <option>Markalar yükleniyor...</option>}
            {isBrandsError && <option>Markalar alınamadı</option>}
            {!isLoadingBrands && !isBrandsError && (
              <>
                <option value="">Seçin...</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Device model */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Model
          </label>
          <select
            value={values.deviceModel}
            onChange={(e) => handleModelChange(e.target.value, modelOptions)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
            disabled={!values.deviceBrand || isLoadingModels || isModelsError}
          >
            {!values.deviceBrand && <option>Önce marka seçin</option>}
            {values.deviceBrand && isLoadingModels && <option>Modeller yükleniyor...</option>}
            {values.deviceBrand && isModelsError && <option>Modeller alınamadı</option>}
            {values.deviceBrand && !isLoadingModels && !isModelsError && (
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
            value={values.deviceListPrice}
            readOnly
            className="w-full rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            placeholder={
              values.deviceBrand && values.deviceModel
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
            value={values.deviceQuotePrice}
            onChange={(e) => onChange({ deviceQuotePrice: e.target.value })}
            classN
