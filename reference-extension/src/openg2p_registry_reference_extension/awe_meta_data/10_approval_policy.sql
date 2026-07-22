-- Individual policies — unique to this reference registry, always seed.
INSERT INTO "public"."approval_policy" ("id","policy_key","version","name","description","status","artifact_type","created_by","forbid_self_approval","forbid_repeat_approvers","created_at","updated_at") VALUES
    ('a1000000-0000-4000-8000-000000000001', 'registry.change_request.individual', 1, 'Policy for Individual Change Request', NULL, 'active', 'registry.change_request', 'seed', 'FALSE', 'FALSE', NOW(), NOW()),
    ('a1000000-0000-4000-8000-000000000011', 'registry.intake_form.individual', 1, 'Policy for Individual Intake Form', NULL, 'active', 'registry.intake_form', 'seed', 'FALSE', 'FALSE', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Household policies — the AWE DB is shared, so policy_key 'registry.change_request.household'
-- may already be seeded by another registry release; skip on ANY unique conflict.
INSERT INTO "public"."approval_policy" ("id","policy_key","version","name","description","status","artifact_type","created_by","forbid_self_approval","forbid_repeat_approvers","created_at","updated_at") VALUES
    ('a1000000-0000-4000-8000-000000000002', 'registry.change_request.household', 1, 'Policy for Household Change Request', NULL, 'active', 'registry.change_request', 'seed', 'FALSE', 'FALSE', NOW(), NOW()),
    ('a1000000-0000-4000-8000-000000000012', 'registry.intake_form.household', 1, 'Policy for Household Intake Form', NULL, 'active', 'registry.intake_form', 'seed', 'FALSE', 'FALSE', NOW(), NOW())
ON CONFLICT DO NOTHING;
