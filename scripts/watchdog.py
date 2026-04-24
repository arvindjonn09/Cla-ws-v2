#!/usr/bin/env python3
"""
Systemd watchdog script — polls /api/health every 30 seconds.
On failure, notifies systemd watchdog so it can restart the service.
Run as: python3 scripts/watchdog.py
"""

import os
import sys
import time
import socket
import urllib.request
import urllib.error

HEALTH_URL = os.getenv("HEALTH_URL", "http://localhost:8100/api/health")
INTERVAL = int(os.getenv("WATCHDOG_INTERVAL", "30"))
WATCHDOG_USEC = os.getenv("WATCHDOG_USEC")  # Set by systemd


def notify_systemd(state: str) -> None:
    notify_socket = os.getenv("NOTIFY_SOCKET")
    if not notify_socket:
        return
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        sock.sendto(state.encode(), notify_socket)
    finally:
        sock.close()


def check_health() -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=10) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError):
        return False


def main() -> None:
    notify_systemd("READY=1")
    consecutive_failures = 0

    while True:
        if check_health():
            notify_systemd("WATCHDOG=1")
            consecutive_failures = 0
        else:
            consecutive_failures += 1
            print(f"Health check failed ({consecutive_failures} consecutive)", flush=True)
            if consecutive_failures >= 3:
                notify_systemd("WATCHDOG=trigger")
                sys.exit(1)

        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
