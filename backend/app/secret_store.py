"""Protection DPAPI liée au compte Windows courant ; aucun repli en clair."""
import base64
import ctypes
from ctypes import wintypes
import sys


def supported():
    return sys.platform == "win32"


def _transform(content: bytes, decrypt: bool):
    if not supported():
        raise ValueError("Le stockage de clé dans l’interface nécessite Windows. Configurez IMMO_OPENAI_API_KEY côté serveur.")
    class Blob(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_ubyte))]
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    method = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    method.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p if decrypt else wintypes.LPCWSTR,
                       ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    method.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    buffer = ctypes.create_string_buffer(content)
    source = Blob(len(content), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    if not method(ctypes.byref(source), None if decrypt else "IMMO PILOT AI - OpenAI", None, None, None, 1, ctypes.byref(target)):
        raise ValueError("La protection Windows de la clé est indisponible ou appartient à une autre session Windows.")
    try:
        return ctypes.string_at(target.pbData, target.cbData)
    finally:
        kernel.LocalFree(target.pbData)


def protect(secret: str):
    return base64.b64encode(_transform(secret.encode("utf-8"), False)).decode("ascii")


def unprotect(cipher: str):
    try:
        return _transform(base64.b64decode(cipher, validate=True), True).decode("utf-8")
    except (ValueError, UnicodeError) as error:
        raise ValueError("Clé locale illisible : enregistrez-la à nouveau depuis votre session Windows.") from error
