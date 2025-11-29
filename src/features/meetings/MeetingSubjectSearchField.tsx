// src/features/meetings/MeetingSubjectSearchField.tsx
// Subject search field for meetings (patients, trials, references) with autocomplete.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeetingType } from './types';
import { searchPatientsByName } from '../patients/api';
import { searchTrialsByName } from '../trials/api';
import { searchReferencesByName } from '../references/api';

type SubjectOption = {
  id: string;
  name: string;
};

function useSubjectSearch(meetingType: MeetingType, term: string) {
  // This picker works for patients, trials and references.
  const enabledTypes: MeetingType[] = ['patient', 'trial', 'reference'];

  return useQuery<SubjectOption[]>({
    queryKey: ['meeting-subject-search', meetingType, term],
    enabled: term.trim().length >= 2 && enabledTypes.includes(meetingType),
    queryFn: async () => {
      const q = term.trim();
      if (!q) return [];

      if (meetingType === 'patient') {
        const rows = await searchPatientsByName(q);
        return rows.map((r) => ({ id: r.id, name: r.full_name }));
      }

      if (meetingType === 'trial') {
        const rows = await searchTrialsByName(q);
        return rows.map((r) => ({ id: r.id, name: r.full_name }));
      }

      if (meetingType === 'reference') {
        const rows = await searchReferencesByName(q);
        return rows.map((r) => ({ id: r.id, name: r.full_name }));
      }

      return [];
    },
  });
}

interface MeetingSubjectSearchFieldProps {
  meetingType: MeetingType;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
}

export function MeetingSubjectSearchField({
  meetingType,
  selectedName,
  onSelect,
}: MeetingSubjectSearchFieldProps) {
  const [inputValue, setInputValue] = useState(selectedName ?? '');
  const [touched, setTouched] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: options = [], isFetching } = useSubjectSearch(
    meetingType,
    inputValue,
  );

  // Sync external selectedName → local input when form resets
  useEffect(() => {
    if (!touched) {
      setInputValue(selectedName ?? '');
    }
  }, [selectedName, touched]);

  const showDropdown =
    isOpen && inputValue.trim().length >= 2 && options.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        value={inputValue}
        onChange={(e) => {
          setTouched(true);
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          // Small delay so click on list item still works
          setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder="İsimle ara (en az 2 harf)..."
      />

      <p className="mt-1 text-[11px] text-slate-500">
        {isFetching
          ? 'Kişiler aranıyor...'
          : 'Sonuçlardan birini seçtiğinizde görüşme bu kartla ilişkilendirilecek.'}
      </p>

      {showDropdown && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white text-xs shadow-lg">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="cursor-pointer px-2 py-1 hover:bg-slate-100"
              onMouseDown={(e) => {
                // Use onMouseDown so it fires before input blur
                e.preventDefault();
                onSelect(opt.id, opt.name);
                setInputValue(opt.name);
                setTouched(false);
                setIsOpen(false);
              }}
            >
              {opt.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
