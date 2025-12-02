// src/features/patients/ui.ts
// Public UI surface for the patients feature.
// Prefer importing patients UI components from this file instead of deep paths.
// Example:
//   import { NewPatientFormCard } from '../patients/ui';

export { NewPatientFormCard } from './components/new/NewPatientFormCard';
export { NewPatientDevicesSection } from './components/new/NewPatientDevicesSection';
export { NewPatientPaymentSection } from './components/new/NewPatientPaymentSection';

// İleride:
// export { PatientsTable } from './components/table/PatientsTable';
// export { PatientDetailDrawer } from './components/detail/PatientDetailDrawer';
// export { PatientsImportSection } from './components/import/PatientsImportSection';
// ...
