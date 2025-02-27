'''

Module needs to have method get_dict_modules.
The Key will hold the Class, Function or Object and makes it available in the Templates

'''

import json
import os
import math

class CustomFunctions:

    @staticmethod
    def get_data_modules(entity_list: list, data_product: str) -> list[str]:
        return list(set([
            x.model_object.entity.dataModule
            for x in entity_list
            if x.model_object.entity.dataProduct == data_product
            ]))
    
    @staticmethod
    def get_data_products(entity_list: list) -> list[str]:
        return list(set([
            x.model_object.entity.dataProduct
            for x in entity_list
            ]))
    
    @staticmethod
    def get_entites_for_module(data_product: str, module: str, entity_list: list) -> list:
        return list(set([
            x.model_object.entity
            for x in entity_list
            if x.model_object.entity.dataModule == module
            and x.model_object.entity.dataProduct == data_product
            ]))
    
    @staticmethod
    def create_bucket_from_list(entity_list: list, bucket_size: int) -> list[list]:
        bucket_count = math.ceil(len(entity_list) / bucket_size)

        result = []
        
        for i in range(bucket_count):
            result.append((i, [
            x
            for x in entity_list[bucket_size*i:bucket_size*(i+1)]
            ]))

        return result
    
    @staticmethod
    def get_table_from_list(table: str, entity_list: list):
        return [
            x.model_object.entity
            for x in entity_list
            if x.model_object.entity.name == table.name
            and x.model_object.entity.dataProduct == table.dataProduct
            and x.model_object.entity.dataModule == table.dataModule
        ].pop()


def get_dict_modules() -> dict:
    __dict = {'custom_functions': CustomFunctions,
              'json': json,
              'os': os
              }

    return __dict
