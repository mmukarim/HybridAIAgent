
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


class DatabaseManager:
    """Manages the SQLAlchemy asynchronous database engine and sessions."""

    def __init__(
        self,
        database_url: str,
        min_size: int = 2,
        max_size: int = 10,
        echo: bool = False,
    ):
        self.database_url = database_url
        self.min_size = min_size
        self.max_size = max_size
        self.echo = echo

        self.engine: AsyncEngine | None = None
        self.session_factory: async_sessionmaker[AsyncSession] | None = None

    def _get_async_database_url(self) -> str:
        """Convert the PostgreSQL URL to use the asyncpg driver."""

        url = make_url(self.database_url)

        return url.set(drivername="postgresql+asyncpg").render_as_string(
            hide_password=False
        )

    async def open(self) -> None:
        """Initialize the SQLAlchemy engine and session factory."""

        if self.engine is not None:
            return

        async_database_url = self._get_async_database_url()

        self.engine = create_async_engine(
            async_database_url,
            echo=self.echo,
            pool_size=self.min_size,
            max_overflow=self.max_size - self.min_size,
            pool_pre_ping=True,
        )

        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        # Verify that the database is reachable.
        async with self.engine.connect():
            pass

    async def close(self) -> None:
        """Dispose of the SQLAlchemy engine and connection pool."""

        if self.engine is not None:
            await self.engine.dispose()

        self.engine = None
        self.session_factory = None

    def get_session_factory(self) -> async_sessionmaker[AsyncSession]:
        """Return the configured session factory."""

        if self.session_factory is None:
            raise RuntimeError(
                "Database session factory has not been initialized."
            )

        return self.session_factory

    async def get_session(self):
        """Provide a database session as an async context manager."""

        session_factory = self.get_session_factory()

        async with session_factory() as session:
            yield session
