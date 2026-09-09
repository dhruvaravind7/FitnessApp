from fastapi import APIRouter, Depends, status

from deps import get_current_user
from models import ChatResponse, ConversationCreate, ConversationDetail, ConversationOut, MessageIn
from services import coach

router = APIRouter(prefix="/coach", tags=["coach"])


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(user: dict = Depends(get_current_user)):
    return coach.list_conversations(user["id"])


@router.post("/conversations", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED)
def create_conversation(body: ConversationCreate | None = None, user: dict = Depends(get_current_user)):
    return coach.create_conversation(user["id"], body.title if body else None)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    return coach.get_conversation(user["id"], conversation_id)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    coach.delete_conversation(user["id"], conversation_id)


@router.post("/conversations/{conversation_id}/messages", response_model=ChatResponse)
async def send_message(conversation_id: int, body: MessageIn, user: dict = Depends(get_current_user)):
    return await coach.send_message(user["id"], conversation_id, body.content.strip(), body.today)
