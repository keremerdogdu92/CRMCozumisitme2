// src/features/patients/api.ts
// Public barrel for Patients API helpers; keeps legacy imports working
// after moving core modules into ./api/ subfolder.

export * from './api/api.core';
export * from './api/api.import';
export * from './api/api.patients';
export * from './api/api.payments';
export * from './types';
