/docs/inventory-catalog-price-system.md
# Inventory Catalog Price System

This document explains how **catalog-based pricing** works for inventory items
(single item creation and CSV import), and how it is intended to be used.

---

## Overview

Inventory items can have two price fields:

- **purchase_price** → purchase cost (alış fiyatı)
- **list_price** → recommended sale price (tavsiye satış fiyatı)

These prices can be:

1. Entered **manually** by the user  
2. **Automatically filled from the device catalog**  
   (`current_device_model_prices_public` view)

The catalog prices are **time-based** and updated periodically (every 3–6 months),
allowing historical analysis of cost and margins.

---

## Device Catalog (Source of Truth)

Catalog prices are read from:

current_device_model_prices_public

markdown
Kodu kopyala

Lookup keys:
- `org_id`
- `brand`
- `model`
- `item_type` (`hearing_aid` | `charger`)

Returned fields:
- `purchase_price`
- `list_price`

> ⚠️ This view is **read-only** for inventory flows.  
> Actual catalog updates are expected to be handled elsewhere
> (admin tools / future UI).

---

## Single Inventory Item Creation

**File:**  
`src/features/inventory/api.create.ts`

### Behavior

When creating a new inventory item:

1. User enters:
   - brand
   - model
   - itemType
   - serialNo
   - (optional) purchasePrice / listPrice

2. Price resolution logic:

| purchasePrice | listPrice | Result |
|---------------|-----------|--------|
| both filled   | –         | user values used |
| one filled    | –         | user value(s) used |
| both empty    | –         | catalog lookup |
| both empty + catalog missing | ❌ error |

### Error Message (Example)

Katalogta bu marka + model + ürün tipi için fiyat bulunamadı.
Lütfen manuel fiyat girin veya cihaz katalog fiyatlarını önce güncelleyin.

markdown
Kodu kopyala

### Notes

- Charger items ignore `ear_side`
- No silent fallbacks: missing catalog = explicit error

---

## CSV Inventory Import

**Files:**
- `api.import.ts`
- `inventoryImportUtils.ts`

### Supported CSV Headers

Normalized headers (case-insensitive):

Required:
- `brand` or `device_brand`
- `model` or `device_model`
- `item_type`
- `serial_no`

Optional:
- `barcode`
- `status`
- `purchase_price`
- `list_price` or `device_price`
- `purchase_date`
- `notes`
- `patient_national_id` (legacy)

---

## CSV Price Resolution Logic

For **each row**:

1. Parse `purchase_price` and `list_price`
2. If **both are empty**:
   - Try catalog lookup using `(brand, model, item_type)`
3. Outcomes:

| CSV prices | Catalog found | Result |
|-----------|---------------|--------|
| present   | –             | CSV prices used |
| empty     | yes           | catalog prices filled |
| empty     | no            | ❌ blocking error |

### Blocking Error Example

CSV satırında purchase_price ve list_price boş,
ve katalogta bu marka+model+item_type için fiyat bulunamadı.

yaml
Kodu kopyala

---

## Import Job & Row Tracking

Each CSV import creates:

### import_jobs
- one row per import
- tracks:
  - status (`processing`, `completed`, `failed`)
  - total row count
  - error count

### inventory_import_rows
- one row per CSV line
- stores:
  - raw values
  - validation result
  - warnings or blocking errors

Valid rows:
- inserted into `inventory_items`

Invalid rows:
- logged but **not imported**

---

## Warning vs Blocking Error

### Blocking Errors (row NOT imported)

- Missing brand
- Missing model
- Missing serial_no
- Invalid item_type
- Missing prices AND no catalog price

### Warnings (row imported)

- Invalid status (defaults to `in_stock`)
- Invalid date format
- Unparseable price values
- Catalog prices auto-filled

Warnings are concatenated into:
validation_error

yaml
Kodu kopyala

---

## Design Decisions

- **No silent defaults**
- **Catalog is authoritative when prices are omitted**
- **Import logic is pure & testable**
- **Single-item and CSV import behave identically**

---

## Intended Usage Pattern

Recommended workflow:

1. Maintain prices in **device catalog**
2. During stock entry:
   - Leave prices empty unless special case
3. Let system:
   - Auto-fill from catalog
   - Preserve historical accuracy
4. Update catalog prices periodically (quarterly)

---

## Future Improvements (Planned)

- UI for editing catalog prices
- Import option toggle:
  - “Do not use catalog prices”
- Inventory list showing:
  - price source (manual vs catalog)
- Margin & profitability reports based on historical catalog data

---

## Summary

This system ensures:

- Centralized price management
- Historical correctness
- Safe imports
- Explicit error handling
- Consistent behavior across UI & CSV
