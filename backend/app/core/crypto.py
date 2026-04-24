import base64
import hashlib
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _key() -> bytes:
    configured = settings.INVESTMENT_SECURE_DETAILS_KEY
    if configured:
        try:
            decoded = base64.b64decode(configured)
            if len(decoded) == 32:
                return decoded
        except Exception:
            pass
        return hashlib.sha256(configured.encode("utf-8")).digest()
    return hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()


def encrypt_json(payload: dict[str, Any]) -> tuple[bytes, bytes]:
    nonce = os.urandom(12)
    plaintext = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ciphertext = AESGCM(_key()).encrypt(nonce, plaintext, None)
    return nonce, ciphertext


def decrypt_json(nonce: bytes, ciphertext: bytes) -> dict[str, Any]:
    plaintext = AESGCM(_key()).decrypt(nonce, ciphertext, None)
    data = json.loads(plaintext.decode("utf-8"))
    return data if isinstance(data, dict) else {}
