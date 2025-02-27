'''

Module needs to have method get_dict_modules.
The Key will hold the Class, Function or Object and makes it available in the Templates

'''


class SystemProperties:

    @property
    def datalake_name(self) -> str:
        # TODO - put your datalake (storage account) name her (only the name, without .dfs.core.windows.net)
        return 'aut0adl0dev'

    @property
    def datalake_container_name(self) -> str:
        # TODO - put your datalake container name here
        return 'data'

    @property
    def databricks_workspace_id(self) -> dict:
        # TODO: put your workspace id here for each environment
        return {
            "dev": "7622639135174415.15",
            "prod": "7622639135174415.15",
            # "staging": "xxxx.x",
            }

    @property
    def secret_scope_name(self) -> str:
        # TODO: put your secret scope name here
        return "akv_standard"

    @property
    def dbr_runtime_version(self) -> str:
        return "13.3.x-scala2.12"

    @property
    def etl_folder(self) -> str:
        # TODO - put your stage folder for notebooks here
        return '/etl'

    @property
    def core_folder(self) -> str:
        # TODO - put your stage folder for notebooks here
        return '030-core'

    @property
    def stage_folder(self) -> str:
        # TODO - put your stage folder for notebooks here
        return '020-stage'

    @property
    def raw_folder(self) -> str:
        # TODO - put your raw folder for notebooks here
        return '010-raw'

    @property
    def utils_folder(self) -> str:
        # TODO - put your raw folder for notebooks here
        return '000-utils'


def get_dict_modules() -> dict:
    __dict = {
        'SystemProperties': SystemProperties
        }

    return __dict
