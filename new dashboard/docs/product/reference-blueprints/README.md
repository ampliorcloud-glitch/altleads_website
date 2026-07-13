# Reference Blueprints — open-source CRM teardown (for "are we on the right track?")

Structured teardowns of the 5 open-source CRMs we cloned to `E:\reference code for crm\`, produced by read-only subagents. Goal: understand each one's **architecture, data model, access/multi-tenancy, activity model, automation, customization, full feature inventory, and UI/UX** — then diff against AltLeads to find what we're missing and confirm our direction.

All five follow the **same section template** (so they're comparable):
1. Stack & code organization (where the model/metadata lives)
2. Core CRM data model (entities, key fields, relationships)
3. Multi-tenancy / access-control model
4. Activity / communication model (followers, chatter, activities)
5. Automation / workflow engine
6. Customization (custom fields / metadata / layouts)
7. Full feature inventory (the comparison backlog source)
8. UI/UX patterns
9. What AltLeads appears to be MISSING (candid gaps)
10. Reverse-engineering feasibility (portable patterns vs stack-specific)

## Files
- `ODOO-BLUEPRINT.md` — Odoo (Python; the deepest reference)
- `SUITECRM-BLUEPRINT.md` — SuiteCRM (PHP / SugarCRM lineage)
- `ERPNEXT-BLUEPRINT.md` — ERPNext / Frappe (Python; metadata-driven DocType)
- `ESPOCRM-BLUEPRINT.md` — EspoCRM (PHP; metadata-driven, strong UI/UX)
- `VTIGER-BLUEPRINT.md` — Vtiger (PHP)
- `_SYNTHESIS-GAPS.md` — (final) cross-CRM comparison vs our backlog + reverse-engineering verdict

> Rule: these are STUDY references. We translate *patterns* into our TS/React/Supabase stack — never copy code (different stacks; AGPL/GPL/LGPL/VPL).
</content>
