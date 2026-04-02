import logging

import pytest_cases
from deepdiff import DeepDiff
from test_040_migration_cases import (
    BaseEntityMapping,
    CaseBaseEntityMigration,
    CaseModelEntityMigration,
    ModelEntityMapping,
)

from datam8 import migration_v1

logger = logging.getLogger(__name__)


def print_diff(diff: DeepDiff, logger: logging.Logger = logger):
    logger.error(f"Number of Diffs: {len(diff.affected_paths)}")
    diff_dict = diff.to_dict()

    keys = [
        "type_changes",
        "values_changed",
        "iterable_item_added",
        "iterable_item_removed",
    ]

    for key in keys:
        if key not in diff_dict:
            continue

        logger.error(key)

        for skey in diff_dict[key]:
            logger.error("%s(%s) - %s", key, skey, diff_dict[key][skey])

    no_type_changes = len(diff_dict["type_changes"]) if "type_changes" in diff_dict else 0
    no_values_changed = len(diff_dict["values_changed"]) if "type_changes" in diff_dict else 0
    no_iterable_item_added = (
        len(diff_dict["iterable_item_added"]) if "iterable_item_added" in diff_dict else 0
    )
    no_iterable_item_removed = (
        len(diff_dict["iterable_item_removed"]) if "iterable_item_removed" in diff_dict else 0
    )

    logger.error(
        "DiffSummary - TypeChanges: %s, ValueChanges: %s, NewItems: %s, RemovedItems: %s",
        no_type_changes,
        no_values_changed,
        no_iterable_item_added,
        no_iterable_item_removed,
    )


@pytest_cases.parametrize_with_cases("case", cases=CaseBaseEntityMigration, glob="*_valid")
def test_migrate_model(case: BaseEntityMapping):
    old = case.legacy
    new = case.new
    migrated = migration_v1.base_entities(old)

    diff = DeepDiff(migrated, new)

    if diff:
        _logger = logger.getChild(new.type)
        _logger.error(diff)

    assert migrated == new, f"migrated model does not match expectation: {new.type}"


@pytest_cases.parametrize_with_cases("case", cases=CaseModelEntityMigration, glob="*_valid")
def test_migrated_model_entity(case: ModelEntityMapping, migration: migration_v1.MigrationV1):
    old = case.legacy
    new = case.new

    migrated = migration.model_entities(old)

    diff = DeepDiff(
        migrated,
        new,
        exclude_regex_paths=[
            r"root\.attributes\[\d+\].dateAdded",
        ],
    )

    if diff:
        _logger = logger.getChild(new.name)
        print_diff(diff, _logger)

    assert not diff, f"migrated model does not match expectation: {new.name}"
