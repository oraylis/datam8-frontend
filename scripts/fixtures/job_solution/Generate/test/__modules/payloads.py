from __future__ import annotations

from pathlib import Path

from datam8.generate import BasePayload, register_payload


@register_payload("hello.jinja2", order=1)
def hello(_model, _cache):
    return [BasePayload(data={"message": "world"}, output_path=Path("hello.txt"))]

