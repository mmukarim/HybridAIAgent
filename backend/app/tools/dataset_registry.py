
from uuid import uuid4

import pandas as pd


class DatasetRegistry:
    def __init__(self):
        self.datasets = {}

    def register(
        self,
        df: pd.DataFrame,
        metadata: dict,
        dataset_id: str | None = None,
    ) -> str:
        """Register a DataFrame and return its unique dataset ID."""

        if not isinstance(df, pd.DataFrame):
            raise TypeError("Dataset must be a Pandas DataFrame.")

        if df.empty:
            raise ValueError("Cannot register an empty dataset.")

        if dataset_id is None:
            dataset_id = str(uuid4())
        elif dataset_id in self.datasets:
            raise ValueError(f"Dataset already registered: {dataset_id}")

        self.datasets[dataset_id] = {
            "dataframe": df,
            "metadata": metadata,
        }

        return dataset_id

    def get(self, dataset_id: str) -> pd.DataFrame:
        """Retrieve a DataFrame using its dataset ID."""

        if dataset_id not in self.datasets:
            raise ValueError(f"Dataset '{dataset_id}' not found.")

        return self.datasets[dataset_id]["dataframe"]

    def get_metadata(self, dataset_id: str) -> dict:
        """Retrieve dataset metadata."""

        if dataset_id not in self.datasets:
            raise ValueError(f"Dataset '{dataset_id}' not found.")

        return self.datasets[dataset_id]["metadata"]

    def list_datasets(self) -> list:
        """Return metadata for all registered datasets."""

        return [
            {
                "dataset_id": dataset_id,
                **entry["metadata"],
            }
            for dataset_id, entry in self.datasets.items()
        ]

    def remove(self, dataset_id: str) -> None:
        """Remove a registered dataset."""

        if dataset_id not in self.datasets:
            raise ValueError(f"Dataset '{dataset_id}' not found.")

        del self.datasets[dataset_id]
