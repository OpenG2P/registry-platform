INSERT INTO "public"."g2p_registry_awe_policy_configurations" (
    "awe_policy_config_id",
    "policy_scope",
    "register_id",
    "intake_form_id",
    "section_id",
    "policy_type",
    "policy_key",
    "context_field_names"
) VALUES
    ('a2000000-0000-4000-8000-000000000001', 'REGISTER', 'a0000000-0000-4000-8000-000000000001', '', '', 'registry.change_request', 'registry.change_request.individual', 'null'),
    ('a2000000-0000-4000-8000-000000000011', 'INTAKE_FORM', 'a0000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '', 'registry.intake_form', 'registry.intake_form.individual', 'null'),
    ('a2000000-0000-4000-8000-000000000002', 'REGISTER', 'a0000000-0000-4000-8000-000000000002', '', '', 'registry.change_request', 'registry.change_request.household', 'null'),
    ('a2000000-0000-4000-8000-000000000012', 'INTAKE_FORM', 'a0000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', '', 'registry.intake_form', 'registry.intake_form.household', 'null')
ON CONFLICT ("awe_policy_config_id") DO NOTHING;
