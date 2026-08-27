"""Synchronous COM1 gateway for the QEMU-hosted AAOS kernel."""

from __future__ import annotations

import socket
import threading
import time


class KernelLinkError(RuntimeError):
    """Raised when the kernel cannot complete its serial protocol."""


def sanitize_for_kernel(text: str, limit: int = 1000) -> str:
    """Collapse text to one ASCII line that fits the kernel's input buffer."""
    text = text.replace("\r", " ").replace("\n", " ")
    text = "".join(char if 32 <= ord(char) < 127 else "?" for char in text)
    return " ".join(text.split())[:limit]


class KernelLink:
    """Own one QEMU TCP-serial connection and enforce the AAOS turn protocol."""

    def __init__(self, host: str = "127.0.0.1", port: int = 4555) -> None:
        self.host = host
        self.port = port
        self._socket: socket.socket | None = None
        self._buffer = b""
        self._ready = False
        self._awaiting_answer = False
        self._state_lock = threading.Lock()

    @property
    def connected(self) -> bool:
        return self._socket is not None and self._ready

    def _close(self) -> None:
        if self._socket is not None:
            try:
                self._socket.close()
            except OSError:
                pass
        self._socket = None
        self._buffer = b""
        self._ready = False
        self._awaiting_answer = False

    def _readline(self, deadline: float) -> str:
        if self._socket is None:
            raise KernelLinkError("kernel serial socket is not connected")
        while b"\n" not in self._buffer:
            remaining = deadline - time.time()
            if remaining <= 0:
                raise KernelLinkError("timed out waiting for the kernel")
            self._socket.settimeout(min(remaining, 2.0))
            try:
                chunk = self._socket.recv(4096)
            except socket.timeout:
                continue
            except OSError as exc:
                self._close()
                raise KernelLinkError(f"kernel serial read failed: {exc}") from exc
            if not chunk:
                self._close()
                raise KernelLinkError("kernel serial connection closed")
            self._buffer += chunk
        line, self._buffer = self._buffer.split(b"\n", 1)
        return line.rstrip(b"\r").decode("utf-8", "replace")

    def _send(self, line: str) -> None:
        if self._socket is None:
            raise KernelLinkError("kernel serial socket is not connected")
        try:
            self._socket.sendall(line.encode("utf-8"))
        except OSError as exc:
            self._close()
            raise KernelLinkError(f"kernel serial write failed: {exc}") from exc

    def _connect(self, timeout: float = 20.0) -> None:
        self._close()
        try:
            self._socket = socket.create_connection((self.host, self.port), timeout=timeout)
        except OSError as exc:
            raise KernelLinkError(
                f"cannot reach QEMU COM1 at {self.host}:{self.port}; run ./run.ps1 -Chat first"
            ) from exc

        deadline = time.time() + timeout
        while time.time() < deadline:
            if self._readline(deadline).strip() == "READY":
                self._ready = True
                return
        self._close()
        raise KernelLinkError("kernel did not send its READY handshake")

    def begin_turn(self, question: str) -> str:
        """Send a question through the kernel and return its verified echo."""
        with self._state_lock:
            if self._awaiting_answer:
                raise KernelLinkError("kernel is still waiting for the previous answer")
            if not self.connected:
                self._connect()

            wire_question = sanitize_for_kernel(question)
            if not wire_question:
                raise KernelLinkError("question is empty after kernel sanitization")

            self._send(f">{wire_question}\n")
            deadline = time.time() + 20.0
            while time.time() < deadline:
                line = self._readline(deadline)
                if line.startswith("?"):
                    echoed = line[1:]
                    if echoed != wire_question:
                        raise KernelLinkError("kernel echo did not match the submitted question")
                    self._awaiting_answer = True
                    return echoed
            raise KernelLinkError("kernel did not echo the question")

    def finish_turn(self, answer: str) -> str:
        """Return the provider answer to the kernel for VGA display."""
        with self._state_lock:
            if not self._awaiting_answer:
                raise KernelLinkError("kernel has no active question")
            wire_answer = sanitize_for_kernel(answer or "[no answer]")
            self._send(f"<{wire_answer}\n")
            self._awaiting_answer = False
            return wire_answer

    def abort_turn(self, reason: str) -> None:
        """Close an unfinished turn so the next request can reconnect cleanly."""
        with self._state_lock:
            if self._awaiting_answer and self._socket is not None:
                try:
                    self._send(f"<[gateway error: {sanitize_for_kernel(reason, 200)}]\n")
                except KernelLinkError:
                    pass
            self._close()
