import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.services.database import Base


class EvaluationScenario(Base):
    __tablename__ = "cse_evaluation_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    evaluation_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_evaluation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assessment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_assessments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_persona_model_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    scenario_external_id = Column(String, nullable=True, index=True)
    scenario_title = Column(String, nullable=True)
    prompt_variant = Column(String, nullable=True, index=True)
    age_range = Column(String, nullable=True, index=True)
    safety_grade = Column(String, nullable=True, index=True)
    assessment_reasons = Column(Text, nullable=True)
    narrative = Column(Text, nullable=True)
    sub_risk = Column(String, nullable=True, index=True)
    risk_category = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    evaluation_run = relationship("EvaluationRun", back_populates="scenarios")
    assessment = relationship("Assessment", back_populates="scenarios")
    conversation = relationship("Conversation")
    user_persona_model = relationship("ModelRegistryEntry")
