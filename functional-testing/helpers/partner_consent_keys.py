"""TEST-ONLY Ed25519 key for functional-gate partner / consent signing.

Same pattern as registry-platform/test/sanity — never use for real partners.
"""

TEST_PRIVATE_KEY_PEM = """-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIEzzrTrPbzYjc2k3BCPMcK6vaULPtmvxVo2EdKjSTW3a
-----END PRIVATE KEY-----
"""

# sender_id "func_partner" → PARTNER_FUNC_PARTNER
DEFAULT_PARTNER_ID = "PARTNER_FUNC_PARTNER"
DEFAULT_KID = "func-partner-1"
DEFAULT_SENDER_ID = "func_partner"
DEFAULT_CM_AUDIENCE = "FUNC_GATE_PARTNER"
DEFAULT_CONTROLLER_ID = "func-gate-controller"
DEFAULT_PURPOSE = "share_individual_profile"

# Must be top-level keys of individual_to_dci.json.j2
DEFAULT_DATA_SCOPES = ["demographic_info", "registration_date"]
DEFAULT_DENIED_SCOPES = ["additional_attributes", "related_person", "disability_info"]
