/**
 * Extraction schemas for GPT-4o vision structured output.
 *
 * Each schema describes the fields to extract from a specific document
 * type. The schemas are plain objects passed into the system prompt so
 * GPT-4o knows which fields to populate and their expected types.
 */

/* ------------------------------------------------------------------ */
/*  Schema type                                                       */
/* ------------------------------------------------------------------ */

export interface FieldSchema {
  type: string;
  description: string;
  items?: FieldSchema;
  properties?: Record<string, FieldSchema>;
}

export interface ExtractionSchema {
  name: string;
  description: string;
  fields: Record<string, FieldSchema>;
}

/* ------------------------------------------------------------------ */
/*  Lease agreement extraction                                        */
/* ------------------------------------------------------------------ */

export const LEASE_EXTRACTION_SCHEMA: ExtractionSchema = {
  name: 'lease_agreement',
  description: 'Residential lease or rental agreement',
  fields: {
    landlord_name: {
      type: 'string',
      description: 'Full legal name of the landlord or property management company',
    },
    landlord_address: {
      type: 'string',
      description: 'Mailing address of the landlord',
    },
    property_address: {
      type: 'string',
      description: 'Full address of the rental property',
    },
    lease_start_date: {
      type: 'string',
      description: 'Lease start date in YYYY-MM-DD format',
    },
    lease_end_date: {
      type: 'string',
      description: 'Lease end date in YYYY-MM-DD format',
    },
    security_deposit_amount: {
      type: 'number',
      description: 'Security deposit amount in USD',
    },
    monthly_rent: {
      type: 'number',
      description: 'Monthly rent amount in USD',
    },
    termination_date: {
      type: 'string',
      description: 'Early termination date if specified, in YYYY-MM-DD format. Null if not present.',
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Itemization of deductions                                         */
/* ------------------------------------------------------------------ */

export const ITEMIZATION_EXTRACTION_SCHEMA: ExtractionSchema = {
  name: 'itemization_of_deductions',
  description: 'Security deposit itemization statement from landlord',
  fields: {
    deductions: {
      type: 'array',
      description: 'List of individual deductions',
      items: {
        type: 'object',
        description: 'A single deduction line item',
        properties: {
          description: {
            type: 'string',
            description: 'Description of the deduction (e.g. "Carpet cleaning", "Wall repair")',
          },
          amount: {
            type: 'number',
            description: 'Deduction amount in USD',
          },
        },
      },
    },
    total_withheld: {
      type: 'number',
      description: 'Total amount withheld from the security deposit in USD',
    },
    total_deposit: {
      type: 'number',
      description: 'Original total security deposit amount in USD',
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Billing / subscription statement                                  */
/* ------------------------------------------------------------------ */

export const BILLING_STATEMENT_SCHEMA: ExtractionSchema = {
  name: 'billing_statement',
  description: 'Billing statement or subscription charge record',
  fields: {
    company_name: {
      type: 'string',
      description: 'Name of the billing company or service provider',
    },
    last_charge_date: {
      type: 'string',
      description: 'Date of the most recent charge in YYYY-MM-DD format',
    },
    monthly_charge: {
      type: 'number',
      description: 'Recurring monthly charge amount in USD',
    },
    account_number: {
      type: 'string',
      description: 'Account or membership number',
    },
    service_type: {
      type: 'string',
      description: 'Type of service (e.g. "gym membership", "streaming", "mobile plan")',
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Schema lookup                                                     */
/* ------------------------------------------------------------------ */

const SCHEMA_MAP: Record<string, ExtractionSchema> = {
  lease_agreement: LEASE_EXTRACTION_SCHEMA,
  itemization_of_deductions: ITEMIZATION_EXTRACTION_SCHEMA,
  billing_statement: BILLING_STATEMENT_SCHEMA,
};

/**
 * Returns the extraction schema for the given schema name.
 * Falls back to the lease schema if the name is unrecognised.
 */
export function getExtractionSchema(schemaName: string): ExtractionSchema {
  return SCHEMA_MAP[schemaName] ?? LEASE_EXTRACTION_SCHEMA;
}
