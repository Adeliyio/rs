# Florida Security Deposit Demand Letter Template

## Template Variables

---

{{sender_name}}
{{sender_address}}
{{sender_city_state_zip}}
{{sender_email}}
{{sender_phone}}

{{current_date}}

**VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED**

{{landlord_name}}
{{landlord_address}}
{{landlord_city_state_zip}}

**RE: Demand for Return of Security Deposit**
**Property: {{property_address}}**
**Lease Period: {{lease_start_date}} through {{lease_end_date}}**
**Security Deposit Paid: ${{deposit_amount}}**

Dear {{landlord_name}},

I am writing regarding the security deposit of ${{deposit_amount}} paid in connection with my tenancy at the above-referenced property.

My tenancy ended and I vacated the property on {{move_out_date}}.

{{#if itemization_status == "nothing" && days_since_moveout > 30}}
Under Florida Statute §83.49(3)(a), if the landlord does not intend to impose a claim on the security deposit, the entire deposit must be returned within 15 days after the tenant vacates. Additionally, under §83.49(3)(b), if the landlord does intend to impose a claim, written notice must be sent by certified mail to the tenant's last known mailing address within 30 days after the tenant vacates.

As of the date of this letter — {{days_since_moveout}} days after my move-out — I have received neither my security deposit nor the required certified-mail notice of intent to claim. Under Florida Statute §83.49(3)(c), the landlord's failure to give the required notice within the 30-day period results in forfeiture of the right to impose any claim against the deposit.
{{/if}}

{{#if itemization_status == "nothing" && days_since_moveout <= 30 && days_since_moveout > 15}}
Under Florida Statute §83.49(3)(a), if the landlord does not intend to impose a claim on the security deposit, the entire deposit must be returned within 15 days after the tenant vacates. The 15-day period has passed. If you intend to impose a claim, Florida Statute §83.49(3)(b) requires written notice by certified mail within 30 days of my move-out.
{{/if}}

{{#if florida_specific.landlord_notice_received}}
I received your notice of intent to claim dated {{florida_specific.landlord_notice_date}}. I am writing within the 15-day objection period provided by Florida Statute §83.49(3)(b) to object to the deductions claimed.

I dispute the following deductions totaling ${{total_disputed}}:

{{> itemized_rebuttal_table}}

Florida law does not permit deductions for normal wear and tear. Tenants in Florida in similar circumstances typically note that items such as minor scuffs, worn carpet from regular use, and age-related deterioration are not permissible deductions.
{{/if}}

{{#if itemization_status == "partial_return_with_itemization" && !florida_specific.landlord_notice_received}}
I received a partial return of my deposit with a statement of deductions. However, Florida Statute §83.49(3)(b) requires that a landlord who intends to impose a claim on the deposit must provide written notice by certified mail. Tenants in similar situations in Florida typically note whether the proper certified-mail notice was provided.

Regardless, I dispute the following deductions totaling ${{total_disputed}}:

{{> itemized_rebuttal_table}}
{{/if}}

I am requesting the return of ${{demand_amount}} to my current address listed above within 15 days of your receipt of this letter.

Tenants in Florida whose landlords do not return the deposit or respond to a demand letter commonly file a case in County Court (Small Claims Division), where claims up to $8,000 may be heard. Florida courts may award the deposit amount, court costs, and attorney's fees.

I hope to resolve this matter without the need for further action.

Sincerely,

{{sender_name}}

---

## Template Notes

- **Certified mail**: Florida has a unique certified-mail requirement for the landlord's claim notice. Our letter should also recommend the tenant send via certified mail.
- **Two-tier timing**: 15 days (no claim) / 30 days (claim notice). If landlord missed the 30-day window, the forfeiture argument is the strongest point.
- **15-day objection**: If tenant received a valid landlord notice, the letter serves as the written objection within the 15-day window. This is time-sensitive.
- **Mediation**: Florida small claims typically requires pre-trial mediation — mention in escalation context.
- **No statutory multiplier**: Florida doesn't have CA's 2x or TX's 3x, but the forfeiture provision is powerful.
