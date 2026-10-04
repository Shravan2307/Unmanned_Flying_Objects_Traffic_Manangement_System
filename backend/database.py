import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects import registry

# Ensure psycopg is registered as driver for postgresql dialect
registry.register("postgresql", "sqlalchemy.dialects.postgresql.psycopg", "PGDialect_psycopg")

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:25bce1332@localhost:5432/utm_drone_db")
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

try:
    connect_args = {}
    if "postgresql" in DATABASE_URL:
        connect_args = {"connect_timeout": 2}
    test_engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
    with test_engine.connect() as conn:
        pass
    engine = test_engine
except Exception as err:
    print(f"[Database] PostgreSQL unavailable. Using local SQLite database (utm_drone.db)")
    DATABASE_URL = "sqlite:///./utm_drone.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
