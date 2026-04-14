import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.services.database import Base


class Assessment(Base):
    __tablename__ = "cse_assessments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','running','completed','failed')",
            name="ck_cse_assessments_status",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    evaluation_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_evaluation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assessment_model_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String, nullable=False, server_default="queued", index=True)
    age_range = Column(String, nullable=True, index=True)
    prompt_variant = Column(String, nullable=True, index=True)
    safety_grade = Column(String, nullable=True, index=True)
    assessment_reasons = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    evaluation_run = relationship("EvaluationRun", back_populates="assessments")
    conversation = relationship("Conversation", back_populates="assessments")
    assessment_model = relationship("ModelRegistryEntry", back_populates="assessments")
    scenarios = relationship("EvaluationScenario", back_populates="assessment")
