"""Phase 0 stand-in for the LiveKit Agents worker: a heartbeat loop the compose
healthcheck can watch.
"""

import asyncio
import time


class Heartbeat:
    def __init__(self) -> None:
        self.ticks = 0
        self.last_tick_monotonic = 0.0

    async def run(self, stop: asyncio.Event, interval_s: float = 5.0) -> None:
        while not stop.is_set():
            self.ticks += 1
            self.last_tick_monotonic = time.monotonic()
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval_s)
            except TimeoutError:
                continue
