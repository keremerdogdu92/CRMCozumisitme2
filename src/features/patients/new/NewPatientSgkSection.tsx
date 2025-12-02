// src/features/patients/components/new/NewPatientSgkSection.tsx
// SGK block used in the NewPatientFormCard: flag + checkboxes +
// SGK profile dropdown + expected reimbursement (locked) + month (locked).

import { SGK_PROFILES } from '../../sgkProfiles';

type NewPatientSgkSectionProps = {
  sgkFlag: boolean;
  sgkPrescriptionReceived: boolean;
  sgkRecordedToSystem: boolean;
  sgkProfileId: string;
  sgkExpectedReimbursement: string;
  sgkExpectedMonth: string;
  onChangeSgkFlag: (value: boolean) => void;
  onChangeSgkPrescriptionReceived: (value: boolean) => void;
  onChangeSgkRecordedToSystem: (value: boolean) => void;
  onChangeSgkProfileId: (value: string) => void;
  onChangeSgkExpectedReimbursement: (value: string) => void;
  onChangeSgkExpectedMonth: (value: string) => void; // "yyyy-MM"
};

export function NewPatientSgkSection({
  sgkFlag,
  sgkPrescriptionReceived,
  sgkRecordedToSystem,
  sgkProfileId,
  sgkExpectedReimbursement,
  sgkExpectedMonth,
  onChangeSgkFlag,
  onChangeSgkPrescriptionReceived,
  onChangeSgkRecordedToSystem,
  onChangeSgkProfileId,
  onChangeSgkExpectedReimbursement,
  onChangeSgkExpectedMonth,
}: NewPatientSgkSectionProps) {
  const handleToggleSgkFlag = (checked: boolean) => {
    onChangeSgkFlag(checked);
    if (!checked) {
      // When SGK is turned off, derived flags and profile fields must be reset.
      onChangeSgkPrescriptionReceived(false);
      onChangeSgkRecordedToSystem(false);
      onChangeSgkProfileId('');
      onChangeSgkExpectedReimbursement('');
      onChangeSgkExpectedMonth('');
    }
  };

  const handleChangeProfile = (value: string) => {
    onChangeSgkProfileId(value);

    const profile = SGK_PROFILES.find((p) => p.id === value);
    if (profile) {
      // 3rd column: net amount that SGK is expected to pay to the firm.
      // Keep it as a TL string; allow comma in UI.
      const asString = profile.netToFirm.toString().replace('.', ',');
      onChangeSgkExpectedReimbursement(asString);

      // Default expected month = 3 months after "now".
      const base = new Date();
      base.setMonth(base.getMonth() + 3);
      const yyyy = base.getFullYear();
      const mm = String(base.getMonth() + 1).padStart(2, '0');
      onChangeSgkExpectedMonth(`${yyyy}-${mm}`); // type="month" format (yyyy-MM)
    } else {
      onChangeSgkExpectedReimbursement('');
      onChangeSgkExpectedMonth('');
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2">
