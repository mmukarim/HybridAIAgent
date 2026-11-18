
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


class CheckpointerManager:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._context = None
        self.checkpointer = None

    async def open(self):
        if self.checkpointer is not None:
            return self.checkpointer

        self._context = AsyncPostgresSaver.from_conn_string(
            self.database_url
        )

        try:
            self.checkpointer = await self._context.__aenter__()
            await self.checkpointer.setup()
        except Exception:
            await self.close()
            raise

        return self.checkpointer

    async def close(self):
        if self._context is not None:
            await self._context.__aexit__(None, None, None)
            self._context = None
            self.checkpointer = None

    def get_checkpointer(self):
        if self.checkpointer is None:
            raise RuntimeError(
                "PostgreSQL checkpointer has not been initialized."
            )

        return self.checkpointer
