"""Collaboration backbone (plan item 2.7).

Pure-relay WebSocket rooms keyed by ``document_id``. The server doesn't merge
state — it shuttles bytes between connected peers. Two message channels share
the socket:

- **Presence** (JSON text frames) — peer announces ``{"type": "presence",
  "user": ..., "cursor": ...}``. Used by the editor to render a live
  co-author indicator. New peers receive an immediate roster snapshot.
- **CRDT updates** (binary frames) — the wire format is opaque to the server.
  A Yjs client can use this endpoint as a ``y-websocket`` provider; production
  Yjs textarea/Monaco bindings drop in without backend changes.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from collections import defaultdict
from typing import Any, Optional

from fastapi import WebSocket


class Peer:
    def __init__(self, ws: WebSocket, user: dict[str, Any]):
        self.id = str(uuid.uuid4())
        self.ws = ws
        self.user = user

    def summary(self) -> dict[str, Any]:
        return {"peer_id": self.id, "user": self.user}


class Room:
    def __init__(self, document_id: str) -> None:
        self.document_id = document_id
        self._peers: dict[str, Peer] = {}
        self._lock = asyncio.Lock()

    async def add(self, ws: WebSocket, user: dict[str, Any]) -> Peer:
        peer = Peer(ws, user)
        async with self._lock:
            self._peers[peer.id] = peer
        return peer

    async def remove(self, peer: Peer) -> None:
        async with self._lock:
            self._peers.pop(peer.id, None)

    def roster(self, exclude: Optional[str] = None) -> list[dict[str, Any]]:
        return [
            p.summary() for pid, p in self._peers.items() if pid != exclude
        ]

    async def broadcast_text(self, sender: Peer, message: str) -> None:
        targets = [p for p in self._peers.values() if p.id != sender.id]
        for peer in targets:
            try:
                await peer.ws.send_text(message)
            except Exception:
                pass

    async def broadcast_bytes(self, sender: Peer, payload: bytes) -> None:
        targets = [p for p in self._peers.values() if p.id != sender.id]
        for peer in targets:
            try:
                await peer.ws.send_bytes(payload)
            except Exception:
                pass


class RoomRegistry:
    def __init__(self) -> None:
        self._rooms: dict[str, Room] = defaultdict(lambda: None)  # type: ignore[arg-type]

    def get(self, document_id: str) -> Room:
        room = self._rooms.get(document_id)
        if room is None:
            room = Room(document_id)
            self._rooms[document_id] = room
        return room

    def __len__(self) -> int:
        return len(self._rooms)


REGISTRY = RoomRegistry()


def envelope(kind: str, **fields: Any) -> str:
    return json.dumps({"type": kind, **fields})
