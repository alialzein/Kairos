import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

PERSONA = Path(__file__).resolve().parents[3] / "persona"


def test_core_yaml_validates_against_schema() -> None:
    schema = json.loads((PERSONA / "schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    core = yaml.safe_load((PERSONA / "core.yaml").read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(core), key=lambda e: list(e.path))
    assert errors == [], "\n".join(f"{list(e.path)}: {e.message}" for e in errors)


def test_core_yaml_names_kairos() -> None:
    core = yaml.safe_load((PERSONA / "core.yaml").read_text(encoding="utf-8"))
    assert core["meta"]["twin_name"] == "Kairos"
    assert core["identity"]["name"] == "Ali Alzein"


def test_reasoner_prompt_has_identity_block() -> None:
    prompt = (PERSONA / "prompts" / "reasoner_system.md").read_text(encoding="utf-8")
    assert "You are Kairos, the digital self of Ali Alzein" in prompt
    for placeholder in ("{{PERSONA_CORE}}", "{{DIRECTIVES}}", "{{MEMORY}}", "{{EXEMPLARS}}"):
        assert placeholder in prompt
