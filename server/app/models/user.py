import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.services.database import Base


class User(Base):
    __tablename__ = "cse_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    firebase_id = Column(String, nullable=True, unique=True, index=True)
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cse_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    account = relationship("Account", back_populates="users")
    evaluation_runs = relationship("EvaluationRun", back_populates="created_by_user")
    model_registry_entries = relationship(
        "ModelRegistryEntry",
        back_populates="created_by_user",
    )
