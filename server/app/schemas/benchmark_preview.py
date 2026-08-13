from pydantic import BaseModel, Field


class BenchmarkScenarioPreviewRow(BaseModel):
    index: int
    scenario_id: str
    short_title: str
    risk_category_id: str
    risk_id: str
    age_range: str
    motivation: str
    risk_signal_type: str
    child_age: int
    child_gender: str
    social_context: str
    first_user_message_preview: str


class BenchmarkScenariosPreviewOut(BaseModel):
    benchmark: str | None = None
    label: str | None = None
    description: str | None = None
    scenario_count: int
    test_count: int
    prompt_variants: list[str] = Field(default_factory=list)
    scenarios: list[BenchmarkScenarioPreviewRow] = Field(default_factory=list)
