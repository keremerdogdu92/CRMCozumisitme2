// src/features/trials/components/ReferenceAutocompleteInput.tsx
// Summary: Shared reference autocomplete input with dropdown suggestions.
// Used in trial and meeting forms to select an existing reference by name.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchReferencesByName } from '../../references/api';

type ReferenceAutocompleteInputProps = {
  value: string;
  referenceId: string | null;
  onChange: (patch: { referenceId: string | null; referenceName: string }) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
};

type ReferenceOption = {
  id: string;
  full_name: string;
};

export const ReferenceAutocompleteInput: React.FC<ReferenceAutocompleteInputProps> =
  ({
    value,
    referenceId,
    onChange,
    label = 'Referans (opsiyonel)',
    helperText = 'En az 2 harf yazınca kayıtlı referanslar listelenir; birini seçerseniz bu kayıt o referansa bağlanır.',
    disabled = false,
  }) => {
    const trimmed = value.trim();
    const showDropdown = trimmed.length >= 2 && !referenceId && !disabled;

    const {
      data: referenceOptions = [],
      isLoading: isLoadingReferences,
      isError: isReferencesError,
    } = useQuery<ReferenceOption[]>({
      queryKey: ['reference-search', trimmed],
      queryFn: () => searchReferencesByName(trimmed),
      enabled: showDropdown,
    });

    const handleTextChange = (next: string) => {
      // Typing clears any previous selection; parent keeps both name and id.
      onChange({
        referenceName: next,
        referenceId: null,
      });
    };

    const handleSelect = (option: ReferenceOption) => {
      onChange({
        referenceId: option.id,
        referenceName: option.full_name,
      });
    };

    return (
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Örn. Dr. Ahmet, Medikal XYZ"
        />
        {helperText && (
          <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
        )}

        {showDropdown && (
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
                        onClick={() => handleSelect(ref)}
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
    );
  };
