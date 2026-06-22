"""Regression tests: ``_load_auth_store`` must not destroy valid credentials
when ``auth.json`` is transiently unreadable.

Background
==========
The desktop runs several Hermes backends (the primary plus one per named
profile) that all share a single ``HERMES_HOME`` and therefore a single
``auth.json``. On Windows, a read that races another process's write fails
with ``PermissionError`` (Errno 13, a sharing violation) — *not* because the
file is corrupt.

The old ``_load_auth_store`` caught every exception with a bare
``except Exception`` and treated it as corruption: it copied the (valid) file
to ``auth.json.corrupt`` and returned an empty store, which a later
``_save_auth_store`` then wrote back over the real credentials. The user was
silently logged out and saw "needs setup" / resume timeouts until re-login.

The fix splits the two failure modes:
  * ``json.JSONDecodeError`` / ``UnicodeDecodeError`` → genuine bad content →
    preserve to ``.corrupt`` and reset to an empty store (unchanged behavior).
  * ``OSError`` (incl. ``PermissionError``) → transient/locked → retried, then
    re-raised. Never clobbered, never downgraded to an empty store.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


def _seed_valid_store(auth_mod) -> Path:
    """Write a valid auth.json holding a Nous token; return its path."""
    auth_file = auth_mod._auth_file_path()
    auth_file.parent.mkdir(parents=True, exist_ok=True)
    auth_file.write_text(
        json.dumps(
            {
                "version": auth_mod.AUTH_STORE_VERSION,
                "providers": {"nous": {"tokens": {"access_token": "keep-me"}}},
                "active_provider": "nous",
            }
        )
    )
    return auth_file


def test_transient_permission_error_is_retried_then_succeeds(tmp_path, monkeypatch):
    """A read that fails with PermissionError a couple of times (another process
    mid-write) is retried; once the lock clears the real creds load — the store
    is never clobbered."""
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    from hermes_cli import auth as auth_mod

    monkeypatch.setattr(auth_mod, "_AUTH_READ_RETRY_DELAY", 0, raising=False)
    auth_file = _seed_valid_store(auth_mod)

    real_read_text = Path.read_text
    attempts = {"n": 0}

    def flaky_read_text(self, *args, **kwargs):
        if self == auth_file:
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise PermissionError(13, "Permission denied")
        return real_read_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", flaky_read_text)

    store = auth_mod._load_auth_store()

    assert store["providers"]["nous"]["tokens"]["access_token"] == "keep-me"
    assert attempts["n"] == 3, "expected two retries before the successful read"
    assert not auth_file.with_suffix(".json.corrupt").exists(), (
        "a transient lock must never produce an auth.json.corrupt"
    )


def test_persistent_permission_error_raises_and_preserves_store(tmp_path, monkeypatch):
    """A read that keeps failing with PermissionError must raise — never return
    an empty store (which would be saved back over the real creds) and never
    rename the valid file to .corrupt."""
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    from hermes_cli import auth as auth_mod

    monkeypatch.setattr(auth_mod, "_AUTH_READ_RETRY_DELAY", 0, raising=False)
    auth_file = _seed_valid_store(auth_mod)

    real_read_text = Path.read_text

    def always_locked(self, *args, **kwargs):
        if self == auth_file:
            raise PermissionError(13, "Permission denied")
        return real_read_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", always_locked)

    with pytest.raises(OSError):
        auth_mod._load_auth_store()

    assert not auth_file.with_suffix(".json.corrupt").exists(), (
        "a locked file is not corrupt — it must not be moved to .corrupt"
    )
    # The on-disk credentials must be untouched.
    surviving = json.loads(real_read_text(auth_file))
    assert surviving["providers"]["nous"]["tokens"]["access_token"] == "keep-me"


def test_genuinely_corrupt_json_is_preserved_and_reset(tmp_path, monkeypatch):
    """Malformed JSON content is real corruption: keep the unchanged behavior —
    copy it to .corrupt and return an empty store."""
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    from hermes_cli import auth as auth_mod

    auth_file = auth_mod._auth_file_path()
    auth_file.parent.mkdir(parents=True, exist_ok=True)
    auth_file.write_text("{ not valid json ::::")

    store = auth_mod._load_auth_store()

    assert store == {"version": auth_mod.AUTH_STORE_VERSION, "providers": {}}
    assert auth_file.with_suffix(".json.corrupt").exists(), (
        "genuinely corrupt content should still be preserved to .corrupt"
    )
