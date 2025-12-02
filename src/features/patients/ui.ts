// src/features/patients/ui.ts
// Public UI surface for the patients feature.
// Prefer importing patients UI components from this file instead of deep paths.
// Example:
//   import { NewPatientFormCard } from '../features/patients/ui';

export { NewPatientFormCard } from './new/NewPatientFormCard';
export { NewPatientDevicesSection } from './new/NewPatientDevicesSection';
export { NewPatientPaymentSection } from './new/NewPatientPaymentSection';
export { NewPatientSgkSection } from './new/NewPatientSgkSection';
export { NewPatientReferenceField } from './NewPatientReferenceField';

// İleride buraya:
// - PatientsTable
// - PatientDetailDrawer
// - PatientsImportSection
// vb. bileşenler de eklenebilir.
