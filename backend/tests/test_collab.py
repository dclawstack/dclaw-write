"""Smoke tests for the collab room manager.

End-to-end WebSocket integration is exercised by the frontend client; here
we cover the in-process state machine that the relay endpoint depends on.
"""
import json

import pytest

from app.services.collab import REGISTRY, Room, envelope


def test_envelope_serializes_kind_and_fields():
    payload = envelope("presence", peer_id="abc", cursor=12)
    parsed = json.loads(payload)
    assert parsed == {"type": "presence", "peer_id": "abc", "cursor": 12}


def test_registry_reuses_room_per_document():
    a = REGISTRY.get("doc-1")
    b = REGISTRY.get("doc-1")
    assert a is b
    assert isinstance(a, Room)


@pytest.mark.asyncio
async def test_room_add_remove_roster():
    class _Stub:
        async def send_text(self, message: str) -> None:
            self.sent_text = message

        async def send_bytes(self, payload: bytes) -> None:
            self.sent_bytes = payload

    room = Room("doc-test")
    ws_a, ws_b = _Stub(), _Stub()
    peer_a = await room.add(ws_a, {"name": "A"})
    peer_b = await room.add(ws_b, {"name": "B"})

    assert len(room.roster()) == 2
    assert {p["user"]["name"] for p in room.roster()} == {"A", "B"}

    # Broadcast from A reaches B, not A.
    await room.broadcast_text(peer_a, '{"hi":1}')
    assert getattr(ws_b, "sent_text", None) == '{"hi":1}'
    assert getattr(ws_a, "sent_text", None) is None

    await room.remove(peer_b)
    assert len(room.roster()) == 1
