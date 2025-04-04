'''

Module needs to have method get_dict_modules.
The Key will hold the Class, Function or Object and makes it available in the Templates

'''


class HelloWorld:

    @property
    def hello_world():
        # TODO - put your stuff here
        return "Hello World!"

def get_dict_modules() -> dict:
    __dict = {
        'HelloWorld': HelloWorld
        }

    return __dict

