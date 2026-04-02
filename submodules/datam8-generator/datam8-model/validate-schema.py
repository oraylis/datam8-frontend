import json
import sys
from pathlib import Path

import jsonschema as jss

errors = []

for file in Path("./schema").glob("**/*.json"):
    with open(file) as schema_file:
        schema = json.load(schema_file)

    validator = jss.Draft7Validator(jss.Draft7Validator.META_SCHEMA)

    for err in validator.iter_errors(schema):
        print(err)
        errors.append(err)

if len(errors) > 0:
    sys.exit(1)
