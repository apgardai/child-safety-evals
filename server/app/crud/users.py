import re
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email.lower().strip()).first()


def sync_user_from_firebase(
    db: Session,
    *,
    email: str,
    firebase_uid: str,
    display_name: str,
) -> User:
    """Create or update a user linked to Firebase; create an account on first sign-in."""
    normalized = email.lower().strip()
    user = get_user_by_email(db, normalized)
    if user:
        user.firebase_id = firebase_uid
        if display_name:
            user.name = display_name
        db.commit()
        db.refresh(user)
        return user

    domain_match = re.search(r"@(.+)", normalized)
    domain = domain_match.group(1).lower() if domain_match else None
    local = normalized.split("@")[0] if "@" in normalized else normalized
    account_name = display_name.strip() if display_name else local

    account = Account(name=account_name, domain=domain)
    db.add(account)
    db.flush()

    user = User(
        email=normalized,
        name=display_name.strip() if display_name else local,
        firebase_id=firebase_uid,
        account_id=account.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.query(User).filter(User.id == user_id).first()
