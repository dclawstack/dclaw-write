"""WebSocket collaboration endpoint (plan item 2.7)."""
from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.collab import REGISTRY, envelope

router = APIRouter()


@router.websocket("/{document_id}")
async def collab_socket(websocket: WebSocket, document_id: str) -> None:
    await websocket.accept()

    user = {
        "name": websocket.query_params.get("user") or "Anonymous",
        "color": websocket.query_params.get("color") or "#3B82F6",
    }
    room = REGISTRY.get(document_id)
    peer = await room.add(websocket, user)

    try:
        # Snapshot current roster to the newcomer + announce them to everyone else.
        await websocket.send_text(
            envelope("hello", peer_id=peer.id, roster=room.roster(exclude=peer.id))
        )
        await room.broadcast_text(peer, envelope("join", peer=peer.summary()))

        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            if "text" in message and message["text"] is not None:
                # JSON presence / cursor messages.
                payload = message["text"]
                # Validate JSON shape but keep relay opaque.
                try:
                    parsed = json.loads(payload)
                    if isinstance(parsed, dict):
                        parsed["peer_id"] = peer.id
                        await room.broadcast_text(peer, json.dumps(parsed))
                except json.JSONDecodeError:
                    pass
            elif "bytes" in message and message["bytes"] is not None:
                # Opaque CRDT (e.g. Yjs sync) frames.
                await room.broadcast_bytes(peer, message["bytes"])
    except WebSocketDisconnect:
        pass
    finally:
        await room.remove(peer)
        await room.broadcast_text(peer, envelope("leave", peer_id=peer.id))
