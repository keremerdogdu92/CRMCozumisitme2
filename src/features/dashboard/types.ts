// src/features/dashboard/types.ts
// Shared dashboard data contract to keep UI and API aligned.

/**
 * KPI aggregates are evaluated in Europe/Istanbul timezone using month windows:
 * [monthStart 00:00, nextMonthStart 00:00).
 *
 * All queries must stay org-scoped and exclude soft-deleted rows (deleted_at IS NULL) where applicable.
 */
export type DashboardKpis = {
  /**
   * Monthly revenue as "sales total" (NOT cash-in).
   *
   * Source of truth:
   * - patients.sale_total_amount
   *
   * Month attribution:
   * - patients.created_at is used as the booking month for Sprint-0.
   *
   * Filters:
   * - patients.deleted_at IS NULL
   * - sale_total_amount IS NOT NULL
   */
  revenueTotal: number;

  /**
   * Sum of expected SGK reimbursement for patients whose SGK record was entered into the SGK system
   * during the month window.
   *
   * Source of truth:
   * - patients.sgk_recorded_to_system_at within [monthStart, nextMonthStart)
   * - patients.sgk_expected_reimbursement summed (NULL treated as 0)
   *
   * Filters:
   * - patients.deleted_at IS NULL
   * - org-scoped
   */
  sgkEnteredThisMonthTotal: number;
  deviceSgkEnteredThisMonthTotal: number;
  batterySgkEnteredThisMonthTotal: number;

  /**
   * Sum of expected SGK reimbursement that is due/expected to be paid in the selected month.
   *
   * Source of truth:
   * - patients.sgk_expected_reimbursement_month (date) represents the month the reimbursement is expected.
   * - Match by month (e.g. date_trunc('month', sgk_expected_reimbursement_month) == selected month start).
   * - Sum patients.sgk_expected_reimbursement (NULL treated as 0)
   *
   * Filters:
   * - patients.deleted_at IS NULL
   * - org-scoped
   */
  sgkDueThisMonthTotal: number;
  deviceSgkDueThisMonthTotal: number;
  batterySgkDueThisMonthTotal: number;

  /**
   * Count of hearing aids sold in the month window.
   *
   * Source of truth:
   * - inventory_items where item_type = 'hearing_aid' AND status = 'sold'
   * - inventory_items.sold_at inside [monthStart, nextMonthStart)
   *
   * Filters:
   * - inventory_items.deleted_at IS NULL
   * - org-scoped
   */
  devicesSoldCount: number;

  /**
   * Distinct patients who purchased hearing aids in the month window.
   *
   * Source of truth:
   * - inventory_items.sold_patient_id (distinct) with the same filters as devicesSoldCount
   */
  devicePatientsCount: number;

  /**
   * Total card processing fees for sales booked in the month window (TL).
   *
   * Source of truth (Sprint-0):
   * - patients.card_fee_amount summed for patients booked in the month window (patients.created_at)
   *
   * Filters:
   * - patients.deleted_at IS NULL
   * - card_fee_amount IS NOT NULL
   * - org-scoped
   */
  cardFeeTotal: number;

  /**
   * Commission amount accrued to references for sales booked in the month window (TL).
   *
   * Source of truth:
   * - patients.reference_id -> references
   * - references.commission_scheme determines calculation:
   *   - 'percent' => patients.sale_total_amount * (references.commission_percent / 100)
   *   - 'fixed'   => references.commission_fixed
   * - Unknown scheme => 0 (and should be logged server-side)
   *
   * Filters:
   * - patients.deleted_at IS NULL
   * - org-scoped
   */
  referenceCommissionTotal: number;

  /**
   * Outstanding installment amount due within the selected month (unpaid portion).
   *
   * Data model note:
   * - patient_installment_plans holds plan header only; there is no per-installment paid flag.
   * - Payments are recorded in meeting_payments (method = 'Senet') and must be matched to plan schedule.
   *
   * Sprint-0 approach:
   * - Build monthly installment schedule from:
   *   first_due_date, day_of_month, installment_count, installment_amount
   * - Distribute patient payments FIFO across installments
   * - Return remaining unpaid amount for the installment due in the selected month
   *
   * Filters:
   * - org-scoped
   */
  unpaidInstallmentsDueThisMonth: number;
  criticalStockModelCount: number;
  lowStockModelCount: number;
  importErrorJobCount: number;
  inventoryImportErrorRowCount: number;
};

export type DashboardTask = {
  id: string;
  title: string;
  /** Due timestamp as ISO string (timestamptz). Render in Europe/Istanbul. */
  dueAt: string | null;
  isCompleted: boolean;
  /**
   * Optional navigation hints for UI routing (Sprint-0).
   * Keep nullable to avoid hard-coupling until task UX stabilizes.
   */
  patientId?: string | null;
  meetingId?: string | null;
};

export type UpcomingMeetingItem = {
  id: string;
  meetingType: 'patient' | 'trial' | 'reference' | 'other';
  subject: string | null;
  subjectName: string | null;
  /** Meeting time as ISO string (timestamptz). Render in Europe/Istanbul. */
  at: string | null;
  /** Optional follow-up time as ISO string (timestamptz). Render in Europe/Istanbul. */
  nextAt: string | null;
  followUpAt: string | null;
  alertSeverity: 'warning' | 'error';
};

export type StockWarningItem = {
  catalogModelId: string;
  brand: string;
  model: string;
  itemType: string;
  inStockCount: number;
  minimumStock: number;
  thresholdScope: 'general' | 'model';
  severity: 'warning' | 'error';
};

export type LowSatisfactionMeetingItem = {
  id: string;
  subjectName: string | null;
  subject: string | null;
  at: string | null;
  satisfaction10: number;
};

export type DashboardResponse = {
  kpis: DashboardKpis;
  tasks: DashboardTask[];
  upcomingMeetings: UpcomingMeetingItem[];
  stockWarnings: StockWarningItem[];
  lowSatisfactionMeetings: LowSatisfactionMeetingItem[];
};
