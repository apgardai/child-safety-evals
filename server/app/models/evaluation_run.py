import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.services.database import Base


class EvaluationRun(Base):
    """One persisted benchmark `results.json` payload (CLI output), scoped to an account."""

    __tablename__ = "cse_evaluation_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_model_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_models.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    target_model_name = Column(String, nullable=True, index=True)
    judge_model = Column(String, nullable=True)
    user_model = Column(String, nullable=True)
    prompts = Column(JSONB, nullable=True)

    status = Column(String, nullable=False, default="completed", index=True)
    celery_task_id = Column(String, nullable=True, index=True)
    error_message = Column(String, nullable=True)
    progress_log = Column(Text, nullable=True)
    scenarios_completed = Column(Integer, nullable=True)
    scenarios_total = Column(Integer, nullable=True)

    results_json = Column(JSONB, nullable=True)

    account = relationship("Account", back_populates="evaluation_runs")
    created_by_user = relationship("User", back_populates="evaluation_runs")
    target_model = relationship("ModelRegistryEntry", back_populates="evaluation_runs_as_target")
    conversations = relationship(
        "Conversation",
        back_populates="evaluation_run",
        cascade="all, delete-orphan",
    )
    assessments = relationship(
        "Assessment",
        back_populates="evaluation_run",
        cascade="all, delete-orphan",
    )
    scenarios = relationship(
        "EvaluationScenario",
        back_populates="evaluation_run",
        cascade="all, delete-orphan",
    )
