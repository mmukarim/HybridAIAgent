
from pathlib import Path

import pandas as pd


SUPPORTED_EXTENSIONS = {".csv", ".xlsx"}


def load_dataset(file_path: str) -> tuple[pd.DataFrame, dict]:
    """Load a CSV or Excel dataset."""

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file format: {path.suffix}. "
            f"Supported formats: {sorted(SUPPORTED_EXTENSIONS)}"
        )

    try:
        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)

    except Exception as exc:
        raise ValueError(f"Failed to load dataset: {exc}") from exc

    if df.empty:
        raise ValueError("The uploaded dataset is empty.")

    metadata = {
        "file_name": path.name,
        "file_format": path.suffix.lower(),
        "row_count": int(df.shape[0]),
        "column_count": int(df.shape[1]),
        "columns": [str(column) for column in df.columns]
    }

    return df, metadata
