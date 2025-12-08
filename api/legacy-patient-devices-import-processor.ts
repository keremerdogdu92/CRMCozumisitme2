// api/legacy-patient-devices-import-processor.ts
// Summary: Serverless processor for LEGACY patient-device CSV imports.
// Phase 1: validates staging rows (patients_legacy_devices_import_rows),
// links them to patients by patient_national_id, and updates row/job status.
// It does NOT yet insert into devices / patient_devices – that will be Phase 2.
