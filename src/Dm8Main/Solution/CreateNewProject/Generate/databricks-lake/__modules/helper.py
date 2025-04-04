'''

Module needs to have method get_dict_modules.
The Key will hold the Class, Function or Object and makes it available in the Templates

'''

import re

class Helper:

    @staticmethod
    def str(arg) :
        return str(arg)
    
    @staticmethod
    def cleanup_name(name: str):
        translated_name = Helper.translate_umlaute(name)
        r = re.sub("[^a-zA-Z0-9_]", "_", translated_name)
        return r

    @staticmethod
    def cleanup_path(name: str):
        r = re.sub("[^a-zA-Z0-9_/-]", "_", name)
        return r

    @staticmethod
    def translate_umlaute(characters: str):
        umlaute_translations = {
            ord("ä"): "ae",
            ord("Ä"): "Ae",
            ord("ü"): "ue",
            ord("Ü"): "Ue",
            ord("ö"): "oe",
            ord("Ö"): "Oe",
            ord("ß"): "ss",
        }
        return characters.translate(umlaute_translations)
    
    @staticmethod
    def build_name(*args: str) :
        n = '_'.join(args)
        return Helper.cleanup_name(n)

    @staticmethod
    def build_path(*args : str) :
        n = '/'.join(args)
        return Helper.cleanup_path(n)

    def test_cleanup_name() :
        data = [
            "Create_stage_EBMS_main_EV585_FUNC_TYPES$",
            "_ABCDEF_ghijkl_0123456789^°§$%&/()=?`*+#'-.:,;<|³@€>"
        ]
        [print(f"{d} -> {Helper.cleanup_name(d)}") for d in data]

    def test_build_name() :
        print(Helper.build_name("abc", "sf$", "eg9"))
        print(Helper.build_name())
        print(Helper.build_name("abc", "sf$", "888"))

    def test_cleanup_path() :
        data = [
            "stage/EBMS/main/EV585_FUNC_TYPES$",
            "_A/B/C/DEF_ghijkl_0123456789^°§$%&/()=?`*+#'-.:,;<|³@€>"
        ]
        [print(f"{d} -> {Helper.cleanup_path(d)}") for d in data]

    def test_build_path() :
        print(Helper.build_path("abc", "sf$", "eg9"))
        print(Helper.build_path())
        print(Helper.build_path("abc", "sf$", '888'))
        
    @staticmethod
    def attribute_mapping_to_dict(attribute_mapping: list[dict]) -> dict:
        return {
            item.target: item.source
            for item in attribute_mapping
        }

def get_dict_modules() -> dict:
    __dict = {'helper': Helper}

    return __dict

# Helper.test_cleanup_name()
# Helper.test_build_name()

# Helper.test_cleanup_path()
# Helper.test_build_path()

