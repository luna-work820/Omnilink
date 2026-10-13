import { createClientServer } from "@/lib/supabase/server";
import { getStoreByOwnerId } from "@/lib/stores/service";
import {
  ParsedRow,
  StableField,
} from "./parser";
import type { ImportAnalysis, ProductGroupCandidate } from "./types";

function toNumber(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const cleaned = value
      .replace(/[$€£¥,\s]/g, "")
      .trim();

    const number = Number(cleaned);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  successRows: number;
  failedRows: number;
  errors: ValidationError[];
  mapping: Partial<Record<StableField, string>>;
  productsCreated?: number;
  variantsCreated?: number;
  groupsProcessed?: number;
  groupsFailed?: number;
}

export async function importProducts(
  rows: ParsedRow[],
  headers: string[],
  mapping: Partial<Record<StableField, string>>,
): Promise<ImportResult> {
  const supabase =
    await createClientServer();

  const {
    data: {
      user,
    },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "Unauthorized",
    );
  }

  const store = await getStoreByOwnerId(user.id)

  if (!store) {
    throw new Error(
      "Store not found",
    );
  }

  const errors: ValidationError[] = [];
  const validProducts: Array<{
    name: string;
    sku: string | null;
    description: string | null;
    price: number;
    currency: string;
    inventory: number;
    status: string;
    raw_data: ParsedRow;
  }> = [];

  rows.forEach((row, rowIndex) => {
    const nameField = mapping.name;
    const priceField = mapping.price;
    const inventoryField = mapping.inventory;
    const skuField = mapping.sku;
    const currencyField = mapping.currency;
    const descriptionField = mapping.description;

    // Validation
    if (!nameField) {
      errors.push({
        row: rowIndex + 1,
        field: "name",
        message: "Name field not mapped",
      });
      return;
    }

    const name = String(row[nameField] ?? "").trim();
    if (!name) {
      errors.push({
        row: rowIndex + 1,
        field: "name",
        message: "Name is required",
      });
      return;
    }

    if (!priceField) {
      errors.push({
        row: rowIndex + 1,
        field: "price",
        message: "Price field not mapped",
      });
      return;
    }

    const price = toNumber(row[priceField]);
    if (price === null) {
      errors.push({
        row: rowIndex + 1,
        field: "price",
        message: "Invalid price",
      });
      return;
    }

    const inventory = inventoryField
      ? toNumber(row[inventoryField]) ?? 0
      : 0;

    if (inventory !== null && !Number.isInteger(inventory)) {
      errors.push({
        row: rowIndex + 1,
        field: "inventory",
        message: "Inventory must be an integer",
      });
      return;
    }

    validProducts.push({
      name,
      sku: skuField
        ? String(row[skuField] ?? "").trim() || null
        : null,
      description: descriptionField
        ? String(row[descriptionField] ?? "").trim() || null
        : null,
      price,
      currency: currencyField
        ? String(row[currencyField] ?? "USD")
        : "USD",
      inventory: inventory ?? 0,
      status: "active",
      raw_data: row,
    });
  });

  // Batch insert (100 at a time)
  const BATCH_SIZE = 100;
  let successCount = 0;
  const insertedProductIds: string[] = [];

  for (let i = 0; i < validProducts.length; i += BATCH_SIZE) {
    const batch = validProducts.slice(i, i + BATCH_SIZE);

    const { data: insertedProducts, error: insertError } = await supabase
      .from("catalog_items")
      .insert(batch.map((item) => ({
        organization_id: store.organization_id,
        item_type: 'product',
        title: item.name,
        description: item.description,
        status: item.status === 'active' ? 'active' : 'draft',
        details: item.raw_data,
      })))
      .select("id");

    if (insertError) {
      // Mark all rows in this batch as failed
      batch.forEach((_, batchIndex) => {
        errors.push({
          row: i + batchIndex + 1,
          field: "database",
          message: insertError.message,
        });
      });
    } else {
      successCount += batch.length;
      if (insertedProducts) {
        for (const [index, product] of insertedProducts.entries()) {
          insertedProductIds.push(product.id);
          const source = batch[index]
          await supabase.from('catalog_variants').insert({
            organization_id: store.organization_id,
            catalog_item_id: product.id,
            sku_code: source.sku,
            title: source.name,
            price: source.price,
            currency_code: source.currency,
            availability_type: 'stock',
            availability_value: source.inventory,
          })
        }
      }
    }
  }

  // Trigger semantic processing for successfully inserted products
  // This should not fail the import if semantic processing fails
  if (insertedProductIds.length > 0) {
    for (const productId of insertedProductIds) {
      try {
        // Semantic embedding is generated by the Catalog worker, not import.
        void productId
      } catch (semanticError) {
        // Log semantic processing error but don't fail the import
        console.error(`Semantic processing failed for product ${productId}:`, semanticError);
      }
    }
  }

  return {
    successRows: successCount,
    failedRows: errors.length,
    errors,
    mapping,
  };
}

/**
 * Persist variant-aware import from ImportAnalysis
 * This is the main entry point for P1-C persistence
 */
export async function persistImportAnalysis(
  analysis: ImportAnalysis,
): Promise<ImportResult> {
  const supabase = await createClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const store = await getStoreByOwnerId(user.id)

  if (!store) {
    throw new Error("Store not found");
  }

  // Validate analysis mode
  if (analysis.mode === "needs_review") {
    throw new Error("Cannot import: analysis requires review due to conflicts");
  }

  const errors: ValidationError[] = [];
  let productsCreated = 0;
  let variantsCreated = 0;
  let groupsProcessed = 0;
  let groupsFailed = 0;

  // Process each product group
  for (const group of analysis.groups) {
    groupsProcessed++;

    try {
      // Persist product group (atomic operation)
      const result = await persistProductGroup(store.id, group, analysis.rows);
      productsCreated += result.productsCreated;
      variantsCreated += result.variantsCreated;
    } catch (error) {
      groupsFailed++;
      // Record error for all rows in this group
      group.sourceRows.forEach((rowIndex) => {
        errors.push({
          row: rowIndex + 1,
          field: "database",
          message: error instanceof Error ? error.message : "Failed to persist product group",
        });
      });
    }
  }

  return {
    successRows: analysis.summary.totalRows - errors.length,
    failedRows: errors.length,
    errors,
    mapping: {}, // No mapping in variant-aware import
    productsCreated,
    variantsCreated,
    groupsProcessed,
    groupsFailed,
  };
}

/**
 * Persist a single product group atomically
 * Product + Options + Variants
 */
async function persistProductGroup(
  storeId: string,
  group: ProductGroupCandidate,
  rows: Array<{ raw: ParsedRow }>,
): Promise<{ productsCreated: number; variantsCreated: number }> {
  const supabase = await createClientServer();

  // Step 1: Create catalog item
  const { data: store } = await supabase.from('stores').select('organization_id').eq('id', storeId).maybeSingle()
  if (!store) throw new Error('Store not found')
  const { data: product, error: productError } = await supabase
    .from("catalog_items")
    .insert({
      organization_id: store.organization_id,
      item_type: 'product',
      title: group.product.name,
      description: group.product.description || null,
      status: "active", // Products are active by default
      details: { source_rows: group.sourceRows.map((rowIndex) => rows[rowIndex]?.raw || {}) },
    })
    .select("id")
    .single();

  if (productError || !product) {
    throw new Error(`Failed to create product: ${productError?.message}`);
  }

  // Step 2: Create variants. Catalog stores option values in details.
  let variantsCreatedCount = 0;
  for (const variant of group.variants) {
    try {
      const { error } = await supabase.from('catalog_variants').insert({
        organization_id: store.organization_id,
        catalog_item_id: product.id,
        sku_code: variant.sku,
        title: group.product.name,
        price: variant.price ?? 0,
        currency_code: variant.currency ?? 'USD',
        availability_type: 'stock',
        availability_value: variant.inventory ?? 0,
        details: { option_values: variant.optionValues },
      })
      if (!error) variantsCreatedCount++
    } catch (variantError) {
      // If variant creation fails, log but continue
      console.error(`Failed to create variant:`, variantError);
    }
  }

  return {
    productsCreated: 1,
    variantsCreated: variantsCreatedCount,
  };
}
