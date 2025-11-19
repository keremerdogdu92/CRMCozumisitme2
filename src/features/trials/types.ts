// src/features/trials/types.ts
// Shared TypeScript types for trial (deneme) entities used in UI and API.

export type TrialRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  first_meet_at: string | null;
  next_meet_at: string | null;
  created_at: string;
  reference_id: string | null;
};

export type NewTrialForm = {
  // Patient-facing fields
  fullName: string;
  phone: string;
  firstMeetAt: string; // datetime-local string, can be empty
  nextMeetAt: string;  // datetime-local string, can be empty

  // Device trial fields (required for a valid trial)
  deviceSide: string;         // e.g. 'both', 'left', 'right'
  deviceBrand: string;        // brand text
  deviceModel: string;        // model text (for trial_devices.model)
  deviceListPrice: string;    // readonly UI field, suggested list price
  deviceQuotePrice: string;   // user-entered total quote (2 devices + accessories)
};

/**
 * Current device model price row as exposed by the
 * current_device_model_prices_public view.
 */
export type DeviceModelPriceRow = {
  id: string;
  brand: string;
  model: string;
  list_price: number;
};
