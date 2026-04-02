# DataM8
# Copyright (C) 2024-2025 ORAYLIS GmbH
#
# This file is part of DataM8.
#
# DataM8 is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# DataM8 is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

import os
import pathlib

import datamodel_code_generator as dcg
from hatchling.builders.hooks.plugin import interface


class GenerateDatamodelHook(interface.BuildHookInterface):
    PLUGIN_NAME = "generate_datamodel"
    CRLF = b"\r\n"
    LF = b"\n"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.__schema_dir = pathlib.Path.cwd() / "datam8-model" / "schema"
        self.__output_dir = pathlib.Path.cwd() / "src" / "datam8_model"
        self.__template_dir = pathlib.Path.cwd() / "template"

    def initialize(self, version, build_data):
        dcg.generate(
            input_=self.__schema_dir,
            input_file_type=dcg.InputFileType.JsonSchema,
            output=self.__output_dir,
            output_model_type=dcg.DataModelType.PydanticV2BaseModel,
            output_datetime_class=dcg.DatetimeClassType.Awaredatetime,
            target_python_version=dcg.PythonVersion.PY_312,
            custom_template_dir=self.__template_dir,
            formatters=[dcg.Formatter.RUFF_CHECK, dcg.Formatter.RUFF_FORMAT],
            additional_imports=["pathlib.Path", "typing.TypeAlias", "typing.Any"],
            disable_timestamp=True,
            set_default_enum_member=True,
            capitalise_enum_members=True,
            collapse_root_models=True,
            allow_extra_fields=False,
            use_annotated=True,
            field_constraints=True,
            use_generic_container_types=True,
            use_schema_description=True,
            use_field_description=True,
            use_double_quotes=True,
            use_title_as_name=True,
            use_union_operator=True,
            custom_file_header_path=pathlib.Path("./license_file_header.txt"),
        )

        # self.prepend_license_to_files()

        self.convert_crlf_to_lf()

    def clean(self, versions):
        for file in self.__output_dir.glob("*.py"):
            os.remove(file)

    def convert_crlf_to_lf(self):
        for file in self.__output_dir.glob("**/*.py"):
            with open(file, "rb") as f:
                content = f.read()

            content = content.replace(self.CRLF, self.LF)

            with open(file, "wb") as f:
                f.write(content)
