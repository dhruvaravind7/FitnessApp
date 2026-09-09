from fastapi import APIRouter, Query

from services import exercisedb

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("/filters")
def filters():
    """Static vocab for the filter sidebar (target muscles are fetched live because the list is long)."""
    return {
        "bodyParts": exercisedb.BODY_PARTS,
        "equipments": exercisedb.EQUIPMENTS,
        "exerciseTypes": exercisedb.EXERCISE_TYPES,
    }


@router.get("/search")
def search(q: str = Query(min_length=1, max_length=100)):
    return exercisedb.search_by_name(q)


@router.get("")
def list_exercises(
    bodyParts: str = "",
    equipments: str = "",
    targetMuscles: str = "",
    exerciseType: str = "",
    limit: int = Query(default=exercisedb.MAX_PAGE, ge=1, le=exercisedb.MAX_PAGE),
    after: str | None = None,
):
    return exercisedb.list_exercises(body_part=bodyParts, equipment=equipments, target_muscle=targetMuscles,
                                     exercise_type=exerciseType, limit=limit, after=after)


@router.get("/{exercise_id}")
def get_exercise(exercise_id: str):
    return exercisedb.get_exercise(exercise_id)
