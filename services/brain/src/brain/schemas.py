"""Pydantic mirrors of packages/shared (docs/08 §6).

Keep field names identical to the zod schemas.
"""

import warnings
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

# `register` is the spec-mandated field name (docs/08 §6); pydantic warns because ABCMeta.register
# is reachable through BaseModel's metaclass. The name is safe — silence exactly this message.
warnings.filterwarnings(
    "ignore",
    message=r'Field name "register" in "TurnRequest" shadows an attribute in parent',
    category=UserWarning,
)


class AvatarState(StrEnum):
    DORMANT = "DORMANT"
    IDLE = "IDLE"
    WAKING = "WAKING"
    LISTENING = "LISTENING"
    THINKING = "THINKING"
    SPEAKING = "SPEAKING"
    OFFLINE = "OFFLINE"


Channel = Literal["web", "voice", "mobile", "guest"]
Register = Literal["casual", "professional"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TurnRequest(_Strict):
    text: str = Field(min_length=1, max_length=8000)
    channel: Channel
    register: Register | None = None
    session_id: UUID


class TurnStart(_Strict):
    type: Literal["turn.start"]
    turn_id: UUID
    session_id: UUID


class TurnDelta(_Strict):
    type: Literal["turn.delta"]
    turn_id: UUID
    text: str


class TurnEnd(_Strict):
    type: Literal["turn.end"]
    turn_id: UUID
    style_applied: bool
    latency_ms: dict[str, Annotated[float, Field(ge=0)]]


class AvatarStateEvent(_Strict):
    type: Literal["avatar.state"]
    state: AvatarState


class AvatarEnergy(_Strict):
    type: Literal["avatar.energy"]
    value: Annotated[float, Field(ge=0, le=1)]


class MemoryCandidateEvent(_Strict):
    type: Literal["memory.candidate"]
    candidate_id: UUID
    kind: str
    summary: str


class ErrorEvent(_Strict):
    type: Literal["error"]
    code: str
    message: str


TurnEvent = Annotated[
    TurnStart
    | TurnDelta
    | TurnEnd
    | AvatarStateEvent
    | AvatarEnergy
    | MemoryCandidateEvent
    | ErrorEvent,
    Field(discriminator="type"),
]
TURN_EVENT_ADAPTER: TypeAdapter[TurnEvent] = TypeAdapter(TurnEvent)
