"""Tests for hermes_cli._subprocess_compat.install_console_hiding.

A console-less Windows backend (pythonw) flashes a console window on every
subprocess that spawns a console app (git, gh, cmd). install_console_hiding
patches subprocess.Popen to default CREATE_NO_WINDOW so those children stay
hidden — without touching callers that set their own creationflags.
"""

import subprocess

import pytest

import hermes_cli._subprocess_compat as sc


@pytest.fixture
def restore_popen():
    """Save/restore subprocess.Popen.__init__ and the install flag so the
    global monkeypatch never leaks into other tests."""
    orig_init = subprocess.Popen.__init__
    orig_installed = sc._console_hiding_installed
    sc._console_hiding_installed = False
    try:
        yield
    finally:
        subprocess.Popen.__init__ = orig_init
        sc._console_hiding_installed = orig_installed


def _capture_popen_init() -> dict:
    """Swap Popen.__init__ for a non-spawning capturer; install() then wraps it."""
    captured: dict = {}

    def _fake(self, *args, **kwargs):
        captured["args"] = args
        captured["kwargs"] = kwargs

    subprocess.Popen.__init__ = _fake
    return captured


@pytest.mark.skipif(not sc.IS_WINDOWS, reason="console-hiding patch is Windows-only")
class TestConsoleHidingWindows:
    def test_adds_no_window_when_unflagged(self, restore_popen):
        captured = _capture_popen_init()
        assert sc.install_console_hiding(force=True) is True
        subprocess.Popen.__init__(object(), ["git", "status"])
        assert captured["kwargs"].get("creationflags") == sc._CREATE_NO_WINDOW

    def test_respects_explicit_creationflags(self, restore_popen):
        captured = _capture_popen_init()
        assert sc.install_console_hiding(force=True) is True
        subprocess.Popen.__init__(object(), ["foo"], creationflags=sc.windows_detach_flags())
        # Explicit detach flags must survive untouched — not clobbered to NO_WINDOW.
        assert captured["kwargs"]["creationflags"] == sc.windows_detach_flags()

    def test_is_idempotent(self, restore_popen):
        _capture_popen_init()
        assert sc.install_console_hiding(force=True) is True
        assert sc.install_console_hiding(force=True) is False


def test_no_op_off_windows(restore_popen):
    if sc.IS_WINDOWS:
        pytest.skip("asserts the non-Windows no-op")
    assert sc.install_console_hiding(force=True) is False
    # Popen.__init__ must be unchanged off Windows.
    assert not hasattr(subprocess.Popen.__init__, "_hermes_console_hiding")
