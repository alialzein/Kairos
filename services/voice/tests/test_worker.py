import asyncio

from voice.worker import Heartbeat


async def test_heartbeat_ticks_until_stopped() -> None:
    hb = Heartbeat()
    stop = asyncio.Event()
    task = asyncio.create_task(hb.run(stop, interval_s=0.01))
    await asyncio.sleep(0.05)
    stop.set()
    await task
    assert hb.ticks >= 3
    assert hb.last_tick_monotonic > 0
