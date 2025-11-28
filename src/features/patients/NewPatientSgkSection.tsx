// src/features/patients/NewPatientSgkSection.tsx
// SGK triple checkbox block used in the NewPatientFormCard.

type NewPatientSgkSectionProps = {
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;
};

export function NewPatientSgkSection({
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
}: NewPatientSgkSectionProps) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          id="sgk-flag"
          type="checkbox"
          checked={sgkFlag}
          onChange={(e) => {
            const checked = e.target.checked;
            onChangeSgkFlag(checked);
            if (!checked) {
              // When SGK is turned off, derived flags must be reset
              onChangeSgkPrescriptionReceived(false);
              onChangeSgkRecordedToSystem(false);
            }
          }}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <label
          htmlFor="sgk-flag"
          className="select-none text-xs font-medium text-slate-700"
        >
          SGK hastası
        </label>
      </div>

      <div className="flex flex-col gap-1 pl-5 text-xs">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!sgkFlag}
            checked={sgkPrescriptionReceived}
            onChange={(e) =>
              onChangeSgkPrescriptionReceived(e.target.checked)
            }
            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          />
          <span>Reçete geldi mi?</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!sgkFlag}
            checked={sgkRecordedToSystem}
            onChange={(e) =>
              onChangeSgkRecordedToSystem(e.target.checked)
            }
            className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          />
          <span>Sisteme işlendi mi?</span>
        </label>
      </div>
    </div>
  );
}
