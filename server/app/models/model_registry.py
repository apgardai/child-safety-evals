import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.services.database import Base


class ModelRegistryEntry(Base):
    """Model configuration row for both built-in and custom models."""

    __tablename__ = "cse_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    alias = Column(String, nullable=False, unique=True, index=True)
    model_id = Column(String, nullable=False, index=True)
    optional_parameters = Column(JSONB, nullable=True)

    is_custom = Column(Boolean, nullable=False, server_default="false", index=True)
    custom_url = Column(String, nullable=True)
    custom_api_key = Column(String, nullable=True)
    parsing_key = Column(String, nullable=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_accounts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    created_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    created_by_user = relationship("User", back_populates="model_registry_entries")
    account = relationship("Account")
    evaluation_runs_as_target = relationship("EvaluationRun", back_populates="target_model")
    assessments = relationship("Assessment", back_populates="assessment_model")
    scenarios_as_user_persona = relationship("EvaluationScenario", back_populates="user_persona_model")
