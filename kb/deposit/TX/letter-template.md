# Texas Security Deposit Demand Letter Template

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

My tenancy ended and I vacated the property on {{move_out_date}}. {{#if forwarding_address_provided}}I provided my forwarding address in writing on {{forwarding_address_date}} via {{forwarding_address_method}}.{{else}}My current forwarding address is listed above. Please treat this letter as written notice of my forwarding address for purposes of Tex. Prop. Code §92.107.{{/if}}

Under Texas Property Code §92.103, a landlord is required to return the tenant's security deposit, less any lawful deductions, within 30 days after the tenant surrenders the premises and provides a written statement of the tenant's forwarding address.

{{#if itemization_status == "nothing"}}
As of the date of this letter — {{days_since_moveout}} days after my move-out and provision of a forwarding address — I have received neither my security deposit nor an itemized statement of deductions. Under Texas Property Code §92.104(b), if the landlord retains any portion of the deposit, they must provide a written description and itemized list of all deductions, along with the remaining balance.
{{/if}}

{{#if itemization_status == "partial_return_no_itemization"}}
I received a partial return of ${{amount_returned}} but no written itemized statement of deductions as required by Texas Property Code §92.104(b). The law requires a written description and itemized list of all deductions.
{{/if}}

{{#if itemization_status == "partial_return_with_itemization" || itemization_status == "letter_only"}}
I have reviewed the itemized deductions provided. I dispute the following deductions totaling ${{total_disputed}}:

{{> itemized_rebuttal_table}}

Under Texas Property Code §92.104(a), a landlord may not retain any portion of a security deposit to cover normal wear and tear. Tenants in Texas in similar circumstances typically note that items such as minor scuffs, worn carpet from regular use, faded paint, and nail holes from normal use constitute normal wear and tear and are not properly deductible.
{{/if}}

I am requesting the return of ${{demand_amount}} to my forwarding address within 15 days of your receipt of this letter.

Under Texas Property Code §92.109(a), a landlord who in bad faith retains a security deposit in violation of this subchapter is liable for a sum equal to $100, three times the portion of the deposit wrongfully withheld, and the tenant's reasonable attorney's fees in a suit to recover the deposit. Tenants in similar situations in Texas who do not receive a satisfactory response to a demand letter commonly file a claim in Justice Court, where claims up to $20,000 may be heard.

I hope to resolve this matter amicably without further action.

Sincerely,

{{sender_name}}

---

## Template Notes

- **Critical TX-specific**: The forwarding address provision is essential. If tenant didn't provide one, the letter should serve as the forwarding address notice AND explain the 30-day clock starts now.
- **Penalty**: Texas 3x penalty is stronger than CA 2x but requires bad faith.
- **No deposit cap**: Texas has no statutory limit on deposit amounts.
- **Justice Court**: $20,000 limit is generous for small claims.
