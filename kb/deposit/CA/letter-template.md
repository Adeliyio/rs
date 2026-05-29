# California Security Deposit Demand Letter Template

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

My tenancy ended on {{move_out_date}}. {{#if forwarding_address_provided}}I provided my forwarding address in writing on {{forwarding_address_date}}.{{/if}} Under California Civil Code §1950.5(e), landlords in California are required to return a tenant's security deposit, along with an itemized statement of any deductions, within 21 calendar days after the tenant vacates the unit.

{{#if itemization_status == "nothing"}}
As of the date of this letter — {{days_since_moveout}} days after my move-out — I have not received my security deposit or any itemized statement of deductions. Under California law, the 21-day period for returning the deposit or providing an itemized accounting has expired.
{{/if}}

{{#if itemization_status == "partial_return_no_itemization"}}
I received a partial return of ${{amount_returned}} but no itemized statement explaining the deductions totaling ${{amount_withheld}}. California Civil Code §1950.5(g) requires landlords to provide an itemized statement with copies of receipts for any amounts deducted.
{{/if}}

{{#if itemization_status == "partial_return_with_itemization" || itemization_status == "letter_only"}}
I have received {{#if itemization_status == "partial_return_with_itemization"}}a partial return of ${{amount_returned}} along with{{else}}only{{/if}} an itemized statement of deductions. After careful review, I dispute the following deductions totaling ${{total_disputed}}:

{{> itemized_rebuttal_table}}

Under California Civil Code §1950.5(b), a landlord may only deduct from a security deposit for: (1) unpaid rent; (2) cleaning necessary to return the unit to the condition at the inception of the tenancy; (3) repair of damage beyond normal wear and tear; and (4) if permitted by the lease, restoration of personal property beyond ordinary wear and tear. Tenants in California in similar circumstances typically note that normal wear and tear — including minor nail holes, faded paint after a reasonable tenancy, and carpet wear from ordinary use — is not a permissible deduction.

{{#if walkthrough_completed == false}}
I also note that under California Civil Code §1950.5(f), landlords are required to offer tenants an initial inspection before move-out to identify potential deductions the tenant could address. I was not offered this inspection.
{{/if}}
{{/if}}

{{#if has_deduction_with_basis == "excessive"}}
Additionally, where deductions are claimed, California law requires that charges reflect actual costs incurred, supported by receipts or invoices. Tenants in similar situations typically note that inflated charges without supporting documentation are not permissible deductions under §1950.5(g).
{{/if}}

I am requesting the return of ${{demand_amount}} to my current address listed above within 15 days of your receipt of this letter.

California Civil Code §1950.5(l) provides that the bad faith claim or retention of any portion of a security deposit may subject a landlord to statutory damages of up to twice the amount of the security deposit, in addition to actual damages. Tenants in California whose landlords do not return the deposit or respond to a demand letter commonly file a case in Small Claims Court, where filing fees range from $30 to $75 and claims up to $12,500 may be heard.

I hope to resolve this matter without the need for further action.

Sincerely,

{{sender_name}}

---

## Template Notes

- **Framing**: Third-person collective ("Tenants in California in similar circumstances typically..."). Never "you should" or "you are entitled to."
- **Citation**: Only Cal. Civ. Code §1950.5 and its specific subsections. All citations grounded in KB entry.
- **Tone**: Firm, factual, professional. Not threatening or emotional.
- **Conditional sections**: Template engine renders only applicable sections based on diagnostic answers.
- **Rebuttal table**: Rendered inline from the itemized_rebuttal_table artifact.
- **Move-out inspection**: Only referenced if the tenant was NOT offered one (additional leverage point).
- **AB 12 reference**: Not included in letter by default (deposit cap is about what was collected, not about what's returned). May be relevant if deposit exceeded the cap at the time it was collected.
