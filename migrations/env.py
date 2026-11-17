import asyncio
import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import pool
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.database import Base, Conversation


# Load environment variables.
load_dotenv()

# Alembic configuration.
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Load SQLAlchemy model metadata.
target_metadata = Base.metadata


def include_name(name, type_, parent_names):
    """Include only tables managed by SQLAlchemy models."""

    if type_ == "table":
        return name in target_metadata.tables

    return True


def get_database_url() -> str:
    """Return the PostgreSQL URL using the asyncpg driver."""

    database_url = os.environ["DATABASE_URL"]

    url = make_url(database_url)

    return url.set(
        drivername="postgresql+asyncpg"
    ).render_as_string(hide_password=False)


def run_migrations_offline() -> None:
    """Run migrations without creating a database connection."""

    database_url = get_database_url()

    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        include_name=include_name,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Execute migrations using an active database connection."""

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and execute migrations."""

    configuration = config.get_section(
        config.config_ini_section
    )

    configuration["sqlalchemy.url"] = get_database_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations using an asynchronous database connection."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
