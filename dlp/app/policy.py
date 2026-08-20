"""
Central severity policy for internal DLP types.

IP regex detections receive context-aware severity at detection time. The static
entry below remains a safe fallback for detectors that cannot classify the IP;
the central decision policy still determines MASK versus BLOCK.
"""

TYPE_SEVERITY = {
    "credit_card": "high",
    "iban": "high",
    "moroccan_cin": "high",
    "api_key": "high",
    "openai_api_key": "high",
    "github_token": "high",
    "jwt_token": "high",
    "bearer_token": "high",
    "private_key": "high",
    "hardcoded_secret": "high",
    "hardcoded_password": "high",
    "connection_string": "high",
    "bank_account": "high",
    "bic_swift": "high",
    "crypto_wallet": "high",
    "cvv": "high",
    "civil_registry_number": "high",
    "passport_number": "high",
    "imei": "high",
    "ip_address": "high",
    "alphanumeric_identifier": "medium",
    "email": "medium",
    "phone_number": "medium",
    "person_name": "medium",
    "date_of_birth": "low",
    "location": "low",
    "url": "low",
    "organization": "low",
}


def severity_for(pii_type: str, fallback: str = "medium") -> str:
    return TYPE_SEVERITY.get(pii_type, fallback)
