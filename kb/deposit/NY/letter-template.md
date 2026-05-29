# New York Security Deposit Demand Letter Template

## Template Variables
All `{{variables}}` are populated from the diagnostic and parsed document data.

---

{{sender_name}}
{{sender_address}}
{{sender_city_state_zip}}
{{sender_email}}
{{sender_phone}}

{{current_date}}

{{landlord_name}}
{{landlord_address}}
{{landlord_city_state_zip}}

**RE: Demand for Return of Security Deposit**
**Property: {{property_address}}**
**Lease Period: {{lease_start_date}} through {{lease_end_date}}**
**Security Deposit Paid: ${{deposit_amount}}**

Dear {{landlord_name}},

I am writing regarding the security deposit of ${{deposit_amount}} paid in connection with my tenancy at the above-referenced property.

My tenancy ended and I vacated the property on {{move_out_date}}. Under New York General Obligations Law §7-108(1-a)(e), as amended by the Housing Stability and Tenant Protection Act of 2019, a landlord is required to return the tenant's security deposit, along with an itemized statement of any deductions, within 14 days after the tenant vacates the premises.

{{#if itemization_status == "nothing"}}
As of the date of this letter — {{days_since_moveout}} days after my move-out — I have not received my security deposit or any itemized statement of deductions. The 14-day period has expired.
{{/if}}

{{#if itemization_status == "partial_return_no_itemization"}}
I received ${{amount_returned}} but no itemized statement of deductions as required by N.Y. Gen. Oblig. Law §7-108(1-a)(c). The remaining ${{amount_withheld}} was retained without the required written explanation.
{{/if}}

{{#if itemization_status == "partial_return_with_itemization" || itemization_status == "letter_only"}}
I have reviewed the itemized statement of deductions. I dispute the following deductions totaling ${{total_disputed}}:

{{> itemized_rebuttal_table}}

Under N.Y. Gen. Oblig. Law §7-108(1-a)(b), a landlord may only deduct from a security deposit for actual and reasonable costs of damage beyond normal wear and tear, and for unpaid rent or other amounts due under the lease. Tenants in New York in similar circumstances typically note that normal wear and tear — including minor nail holes, worn carpet from ordinary use, and age-related deterioration — is not a permissible deduction.
{{/if}}

{{#if deposit_amount_exceeds_one_month}}
Additionally, I note that under N.Y. Gen. Oblig. Law §7-108(1-a)(a), security deposits in New York are limited to one month's rent. My monthly rent was ${{monthly_rent}}, and the deposit of ${{deposit_amount}} exceeds this limit by ${{excess_deposit}}. I am requesting the return of this excess amount as well.
{{/if}}

{{#if building_6_plus_units}}
I also note that for buildings with six or more residential units, N.Y. Gen. Oblig. Law §7-108(1-a)(d) requires the landlord to place security deposits in an interest-bearing account at a New York banking institution and to notify the tenant of the bank name and address. Please confirm whether this requirement was met.
{{/if}}

I am requesting the return of ${{demand_amount}} to my current address listed above within 14 days of your receipt of this letter.

Tenants in New York whose landlords do not return the deposit or respond to a demand letter commonly file a case in Small Claims Court, where claims up to $10,000 may be heard and filing fees are $15-$20.

I hope to resolve this matter without the need for further action.

Sincerely,

{{sender_name}}

---

## Template Notes

- **14-day deadline**: NY has the shortest deadline of the four launch states.
- **HSTPA 2019**: Major reform — always reference it for tenancies after June 2019.
- **One-month cap**: If deposit exceeded one month's rent, this is an additional violation.
- **Interest-bearing account**: Leverage point for 6+ unit buildings.
- **No explicit multiplier**: NY doesn't have a 2x or 3x penalty like CA/TX, but courts can award punitive damages.
- **NYC DCWP**: For NYC cases, mention DCWP as an additional enforcement venue.
