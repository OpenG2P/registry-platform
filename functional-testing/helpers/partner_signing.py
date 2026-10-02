"""Partner-side JWS signing for DCI envelope + consent (functional gate)."""

from __future__ import annotations

import orjson
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa
from jwt.api_jws import PyJWS


def load_private_key_pem(pem: str):
    return serialization.load_pem_private_key(pem.encode("utf-8"), password=None)


def alg_for_key(priv) -> str:
    if isinstance(priv, ed25519.Ed25519PrivateKey):
        return "EdDSA"
    if isinstance(priv, ec.EllipticCurvePrivateKey):
        return "ES256"
    if isinstance(priv, rsa.RSAPrivateKey):
        return "RS256"
    raise ValueError("unsupported private key type")


def _canonical(payload: dict) -> bytes:
    return orjson.dumps(payload, option=orjson.OPT_SORT_KEYS)


def sign_consent_jws(claims: dict, priv, kid: str, alg: str = "EdDSA") -> str:
    return PyJWS().encode(_canonical(claims), priv, algorithm=alg, headers={"kid": kid})


def sign_dci_envelope(header: dict, message: dict, priv, kid: str, alg: str = "EdDSA") -> str:
    full = PyJWS().encode(
        _canonical({"header": header, "message": message}),
        priv,
        algorithm=alg,
        headers={"kid": kid},
    )
    part1, _payload, part3 = full.split(".")
    return f"{part1}..{part3}"


def public_pem_and_alg(private_pem: str) -> tuple[str, str]:
    priv = load_private_key_pem(private_pem)
    pub_pem = priv.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    return pub_pem, alg_for_key(priv)
