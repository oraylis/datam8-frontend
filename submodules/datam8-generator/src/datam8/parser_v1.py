import dataclasses
import json
import pathlib

from datam8_model.v1 import (
    CoreModelEntry,
    CuratedModelEntry,
    Index,
    RawModelEntry,
    Solution,
    StageModelEntry,
)
from datam8_model.v1.Index import IndexEntry

type ModelEntitiesType = (
    RawModelEntry.Model | StageModelEntry.Model | CoreModelEntry.Model | CuratedModelEntry.Model
)


def parse_solution_file(
    solution_file_path: pathlib.Path,
) -> tuple[Solution.Model, dict[str, "ModelFileReference"]]:
    solution = Solution.Model.from_json_file(solution_file_path)
    index = Index.Model.from_json_file(solution_file_path.parent / "index.json")
    indeces: list[IndexEntry] = []
    mapping_file_id: dict[str, ModelFileReference] = {}
    next_id = 1

    if index.rawIndex is not None and index.rawIndex.entry is not None:
        indeces.extend(index.rawIndex.entry)

    if index.stageIndex is not None and index.stageIndex.entry is not None:
        indeces.extend(index.stageIndex.entry)

    if index.coreIndex is not None and index.coreIndex.entry is not None:
        indeces.extend(index.coreIndex.entry)

    if index.curatedIndex is not None and index.curatedIndex.entry is not None:
        indeces.extend(index.curatedIndex.entry)

    for idx in indeces:
        mapping_file_id[idx.locator.lower()] = ModelFileReference(
            id=next_id, path=pathlib.Path(idx.absPath)
        )
        next_id += 1

    return solution, mapping_file_id


def read_type(file_path: pathlib.Path) -> type[ModelEntitiesType]:
    _type: str = json.loads(file_path.read_bytes())["type"].upper()

    match _type:
        case _ if _type in RawModelEntry.Type._member_names_:
            return RawModelEntry.Model
        case _ if _type in StageModelEntry.Type._member_names_:
            return StageModelEntry.Model
        case _ if _type in CoreModelEntry.Type._member_names_:
            return CoreModelEntry.Model
        case _ if _type in CuratedModelEntry.Type._member_names_:
            return CuratedModelEntry.Model

    raise Exception("Unknown type: %s", _type)


def parse_model_file(model_file_path: pathlib.Path) -> ModelEntitiesType:
    _type = read_type(model_file_path)

    match _type:
        case RawModelEntry.Model:
            return RawModelEntry.Model.from_json_file(model_file_path)
        case StageModelEntry.Model:
            return StageModelEntry.Model.from_json_file(model_file_path)
        case CoreModelEntry.Model:
            return CoreModelEntry.Model.from_json_file(model_file_path)
        case CuratedModelEntry.Model:
            return CuratedModelEntry.Model.from_json_file(model_file_path)

    raise ValueError(f"Unkown type: {_type}")


@dataclasses.dataclass
class ModelFileReference:
    id: int
    path: pathlib.Path
