// src/features/patients/NewPatientReferenceField.tsx
// Reference search + dropdown used in the NewPatientFormCard.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchReferencesByName } from '../references/api';

type ReferenceSearchResult = {
  id: string;
  full_name: string;
};

type NewPatientReferenceFieldProps = {
  referenceId: string | null;
  referenceName: string;
  onChangeReference: (payload: { id: string | null; name: string }) => void;
};

export function NewPatientReferenceField({
  referenceId,
  referenceName,
  onChangeReference,
}: NewPatientReferenceFieldProps) {
  const [search, setSearch] = useState(referenceName || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    // Sync external reset into local input value
    setSearch(referenceName || '');
  }, [referenceName]);

  const {
    data: referenceOptions = [],
    isLoading: isReferenceLoading,
    isError: isReferenceError,
  } = useQuery<ReferenceSearchResult[]>({
    queryKey: ['reference-search-for-patient', search],
    queryFn: () => searchReferencesByName(search),
    enabled: isDropdownOpen && search.trim().length >= 2,
  });

  const handleInputChange = (value: string) => {
    setSearch(value);
    onChangeReference({ id: null, name: value });

    if (value.trim().length >= 2) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleSelectReference = (ref: ReferenceSearchResult) => {
    onChangeReference({ id: ref.id, name: ref.full_name });
    setSearch(ref.full_name);
    setIsDropdownOpen(false);
  };

  const handleClearReference = () => {
    onChangeReference({ id: null, name: '' });
    setSearch('');
    setIsDropdownOpen(false);
  };

  return (
    <>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        Referans (opsiyonel)
      </label>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (search.trim().length >= 2) {
              setIsDropdownOpen(true);
            }
          }}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="En az 2 harf yazın..."
        />
        {referenceId && (
          <button
            type="button"
            onClick={handleClearReference}
            className="absolute inset-y-0 right-2 my-auto text-xs text-slate-400 hover:text-slate-600"
          >
            Temizle
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        En az 2 harf yazınca kayıtlı referanslar listelenir; biri
        seçerseniz hasta o referansa bağlanmış olur (şimdilik yalnızca
        form içinde tutuluyor).
      </p>

      {isDropdownOpen && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {isReferenceLoading && (
            <div className="px-3 py-2 text-[11px] text-slate-500">
              Referanslar yükleniyor...
            </div>
          )}
          {isReferenceError && (
            <div className="px-3 py-2 text-[11px] text-red-600">
              Referanslar alınırken hata oluştu.
            </div>
          )}
          {!isReferenceLoading &&
            !isReferenceError &&
            search.trim().length >= 2 &&
            referenceOptions.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-slate-500">
                Eşleşen referans bulunamadı.
              </div>
            )}
          {!isReferenceLoading &&
            !isReferenceError &&
            referenceOptions.length > 0 && (
              <ul className="text-xs text-slate-800">
                {referenceOptions.map((ref) => (
                  <li key={ref.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectReference(ref)}
                      className="flex w-full items-center px-3 py-1.5 text-left hover:bg-slate-100"
                    >
                      {ref.full_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </>
  );
}
