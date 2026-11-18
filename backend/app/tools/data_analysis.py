from pathlib import Path
from uuid import uuid4

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import math
import pandas as pd
import numpy as np

from app.tools.dataset_registry import DatasetRegistry


def _to_native(value):
    """Convert Pandas/NumPy values into JSON-compatible Python values."""
    if pd.isna(value):
        return None

    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, float) and not math.isfinite(value):
        return None

    return value


def _clean_summary(summary: dict) -> dict:
    """Convert nested Pandas summary values into JSON-compatible values."""
    return {
        column: {
            str(stat): _to_native(value)
            for stat, value in statistics.items()
        }
        for column, statistics in summary.items()
    }


def profile_dataset(df: pd.DataFrame) -> dict:
    row_count, column_count = df.shape

    missing_counts = df.isnull().sum()

    missing_values = {
        column: {
            "count": int(count),
            "percentage": round(
                (int(count) / row_count) * 100, 2
            ) if row_count > 0 else 0.0
        }
        for column, count in missing_counts.items()
    }

    numeric_columns = df.select_dtypes(include="number").columns
    categorical_columns = df.select_dtypes(
        include=["object", "category", "string", "bool"]
    ).columns

    numeric_summary = (
        _clean_summary(df[numeric_columns].describe().to_dict())
        if len(numeric_columns) > 0
        else {}
    )

    categorical_summary = (
        _clean_summary(df[categorical_columns].describe().to_dict())
        if len(categorical_columns) > 0
        else {}
    )

    return {
        "row_count": int(row_count),
        "column_count": int(column_count),
        "columns": [str(column) for column in df.columns],
        "data_types": {
            str(column): str(dtype)
            for column, dtype in df.dtypes.items()
        },
        "missing_values": missing_values,
        "duplicate_rows": int(df.duplicated().sum()),
        "numeric_summary": numeric_summary,
        "categorical_summary": categorical_summary
    }



def analyze_column(df: pd.DataFrame, column_name: str) -> dict:
    """Analyze a single DataFrame column."""

    if column_name not in df.columns:
        return {
            "error": f"Column '{column_name}' does not exist.",
            "available_columns": [str(col) for col in df.columns]
        }

    series = df[column_name]

    total_count = len(series)
    missing_count = int(series.isnull().sum())
    non_missing_count = total_count - missing_count

    result = {
        "column": column_name,
        "data_type": str(series.dtype),
        "total_count": total_count,
        "non_missing_count": non_missing_count,
        "missing_count": missing_count,
        "missing_percentage": round(
            (missing_count / total_count) * 100, 2
        ) if total_count > 0 else 0.0,
        "unique_values": int(series.nunique())
    }

    if non_missing_count == 0:
        result["analysis_type"] = "empty"
        result["message"] = "Column contains no non-missing values."
        return result

    if pd.api.types.is_numeric_dtype(series):
        result["analysis_type"] = "numeric"

        result["statistics"] = {
            "mean": _to_native(series.mean()),
            "median": _to_native(series.median()),
            "std_deviation": _to_native(series.std()),
            "min": _to_native(series.min()),
            "max": _to_native(series.max()),
            "percentile_25": _to_native(series.quantile(0.25)),
            "percentile_50": _to_native(series.quantile(0.50)),
            "percentile_75": _to_native(series.quantile(0.75))
        }

    else:
        result["analysis_type"] = "categorical"

        value_counts = series.value_counts(dropna=True)

        result["statistics"] = {
            "most_frequent_value": _to_native(value_counts.index[0]),
            "most_frequent_count": int(value_counts.iloc[0]),
            "top_values": [
                {
                    "value": _to_native(value),
                    "count": int(count)
                }
                for value, count in value_counts.head(10).items()
            ]
        }

    return result



def analyze_correlations(
    df: pd.DataFrame,
    method: str = "pearson"
) -> dict:
    """Analyze correlations between numerical columns."""

    supported_methods = {"pearson", "spearman", "kendall"}

    if method not in supported_methods:
        return {
            "error": f"Unsupported correlation method: {method}",
            "supported_methods": sorted(supported_methods)
        }

    numeric_df = df.select_dtypes(include="number")

    if numeric_df.shape[1] < 2:
        return {
            "error": "At least two numerical columns are required.",
            "numeric_columns": numeric_df.columns.tolist()
        }

    # Remove columns with no variation.
    variable_columns = [
        column
        for column in numeric_df.columns
        if numeric_df[column].nunique(dropna=True) > 1
    ]

    if len(variable_columns) < 2:
        return {
            "error": "At least two numerical columns with variation are required.",
            "numeric_columns": [str(col) for col in numeric_df.columns]
        }

    correlation_matrix = numeric_df[variable_columns].corr(method=method)

    correlations = {}

    for column in correlation_matrix.columns:
        correlations[str(column)] = {
            str(other_column): _to_native(value)
            for other_column, value in correlation_matrix[column].items()
        }

    # Extract unique pairs, excluding self-correlations.
    correlation_pairs = []

    for i, column in enumerate(correlation_matrix.columns):
        for other_column in correlation_matrix.columns[i + 1:]:
            value = correlation_matrix.loc[column, other_column]

            if pd.notna(value):
                correlation_pairs.append({
                    "column_1": str(column),
                    "column_2": str(other_column),
                    "correlation": _to_native(value),
                    "strength": (
                        "strong" if abs(value) >= 0.7
                        else "moderate" if abs(value) >= 0.4
                        else "weak"
                    ),
                    "direction": (
                        "positive" if value > 0
                        else "negative" if value < 0
                        else "none"
                    )
                })

    correlation_pairs.sort(
        key=lambda item: abs(item["correlation"]),
        reverse=True
    )

    return {
        "method": method,
        "numeric_columns": [str(col) for col in variable_columns],
        "correlation_matrix": correlations,
        "correlation_pairs": correlation_pairs
    }



def aggregate_data(
    df: pd.DataFrame,
    group_by: str,
    value_column: str,
    operation: str = "sum"
) -> dict:
    """Aggregate a numerical column grouped by another column."""

    supported_operations = {
        "sum", "mean", "median", "min", "max", "count"
    }

    # Validate operation
    if operation not in supported_operations:
        return {
            "error": f"Unsupported operation: {operation}",
            "supported_operations": sorted(supported_operations)
        }

    # Validate columns
    missing_columns = [
        column
        for column in [group_by, value_column]
        if column not in df.columns
    ]

    if missing_columns:
        return {
            "error": "One or more requested columns do not exist.",
            "missing_columns": missing_columns,
            "available_columns": [str(col) for col in df.columns]
        }

    if group_by == value_column:
        return {
            "error": "Grouping and value columns must be different."
        }

    # Validate numeric value column (count is also supported for numeric data)
    if not pd.api.types.is_numeric_dtype(df[value_column]):
        return {
            "error": f"Column '{value_column}' must be numerical.",
            "actual_data_type": str(df[value_column].dtype)
        }

    if df.empty:
        return {
            "error": "Cannot aggregate an empty dataset."
        }

    # Perform aggregation
    grouped = (
        df.groupby(group_by, dropna=False)[value_column]
        .agg(operation)
        .reset_index()
    )

    results = [
        {
            "group": _to_native(row[group_by]),
            "value": _to_native(row[value_column])
        }
        for _, row in grouped.iterrows()
    ]

    # Sort numeric aggregation results descending, except min/max
    if operation in {"sum", "mean", "median", "count"}:
        results.sort(
            key=lambda item: (
                item["value"] is not None,
                item["value"] if item["value"] is not None else 0
            ),
            reverse=True
        )

    return {
        "group_by": group_by,
        "value_column": value_column,
        "operation": operation,
        "group_count": len(results),
        "results": results
    }


def profile_registered_dataset(
    registry: DatasetRegistry,
    dataset_id: str
) -> dict:
    df = registry.get(dataset_id)
    return profile_dataset(df)


def analyze_registered_column(
    registry: DatasetRegistry,
    dataset_id: str,
    column_name: str
) -> dict:
    df = registry.get(dataset_id)
    return analyze_column(df, column_name)


def analyze_registered_correlations(
    registry: DatasetRegistry,
    dataset_id: str,
    method: str = "pearson"
) -> dict:
    df = registry.get(dataset_id)
    return analyze_correlations(df, method)


def aggregate_registered_data(
    registry: DatasetRegistry,
    dataset_id: str,
    group_by: str,
    value_column: str,
    operation: str = "sum"
) -> dict:
    df = registry.get(dataset_id)
    return aggregate_data(df, group_by, value_column, operation)


def generate_chart(
    df: pd.DataFrame,
    chart_type: str,
    x_column: str,
    y_column: str = None,
    title: str = None,
) -> dict:
    """
    Generate a chart from a Pandas DataFrame and save it as a PNG file.

    Supported chart types:
        - bar
        - line
        - scatter
        - histogram
    """

    supported_types = {"bar", "line", "scatter", "histogram"}

    # 1. Validate the dataset
    if not isinstance(df, pd.DataFrame):
        raise TypeError("Input must be a Pandas DataFrame.")

    if df.empty:
        raise ValueError("Cannot generate a chart from an empty dataset.")

    # 2. Validate chart type
    if chart_type not in supported_types:
        raise ValueError(
            f"Unsupported chart type '{chart_type}'. "
            f"Supported types: {sorted(supported_types)}"
        )

    # 3. Validate x-axis column
    if x_column not in df.columns:
        raise ValueError(f"Column '{x_column}' not found in dataset.")

    # 4. Validate data required for the selected chart
    if chart_type == "histogram":
        if not pd.api.types.is_numeric_dtype(df[x_column]):
            raise ValueError(
                "Histogram requires a numeric column."
            )

        plot_df = df[x_column].dropna()

        if plot_df.empty:
            raise ValueError("No valid data available for the histogram.")

    else:
        if not y_column:
            raise ValueError(
                f"Chart type '{chart_type}' requires a y_column."
            )

        if y_column not in df.columns:
            raise ValueError(f"Column '{y_column}' not found in dataset.")

        if not pd.api.types.is_numeric_dtype(df[y_column]):
            raise ValueError(
                "The y-axis column must contain numeric values."
            )

        if chart_type == "scatter" and not pd.api.types.is_numeric_dtype(
            df[x_column]
        ):
            raise ValueError(
                "Scatter plots require a numeric x-axis column."
            )

        plot_df = df[[x_column, y_column]].dropna()

        if plot_df.empty:
            raise ValueError("No valid data available for the chart.")

    # 5. Create the chart
    fig, ax = plt.subplots(figsize=(10, 6))

    try:
        if chart_type == "histogram":
            plot_df.plot(
                kind="hist",
                bins=20,
                ax=ax,
                edgecolor="black",
            )
            ax.set_xlabel(x_column)
            ax.set_ylabel("Frequency")

        else:
            plot_df.plot(
                kind=chart_type,
                x=x_column,
                y=y_column,
                ax=ax,
            )

            ax.set_xlabel(x_column)
            ax.set_ylabel(y_column)

        chart_title = title or f"{chart_type.title()} Chart"

        ax.set_title(chart_title)
        fig.tight_layout()

        # 6. Save the chart in the project root
        output_path = (
            Path(__file__).resolve().parents[2]
            / f"chart_{uuid4().hex[:10]}.png"
        )

        fig.savefig(output_path, dpi=150, bbox_inches="tight")

        return {
            "status": "success",
            "chart_type": chart_type,
            "title": chart_title,
            "chart_path": str(output_path),
        }

    finally:
        plt.close(fig)


def generate_registered_chart(
    registry: DatasetRegistry,
    dataset_id: str,
    chart_type: str,
    x_column: str,
    y_column: str = None,
    title: str = None,
) -> dict:
    """
    Generate a chart from a registered dataset.
    """

    df = registry.get(dataset_id)

    return generate_chart(
        df=df,
        chart_type=chart_type,
        x_column=x_column,
        y_column=y_column,
        title=title,
    )



def generate_business_insights(
    df: pd.DataFrame,
    group_by: str,
    value_column: str,
    operation: str = "sum",
) -> dict:
    """
    Generate deterministic business insights from grouped data.
    """

    if not isinstance(df, pd.DataFrame):
        raise TypeError("Input must be a Pandas DataFrame.")

    if df.empty:
        raise ValueError("Cannot generate insights from an empty dataset.")

    if operation not in {"sum", "mean", "median", "min", "max"}:
        raise ValueError(
            "Operation must be sum, mean, median, min, or max."
        )

    aggregation = aggregate_data(
        df=df,
        group_by=group_by,
        value_column=value_column,
        operation=operation,
    )

    group_insights = aggregation["results"]

    if not group_insights:
        raise ValueError("No valid groups found for analysis.")

    values = [item["value"] for item in group_insights]

    if operation == "sum":
        total = sum(values)

        if total == 0:
            raise ValueError(
                "Cannot calculate contribution percentages "
                "when the total is zero."
            )

        for item in group_insights:
            item["contribution_percentage"] = round(
                (item["value"] / total) * 100, 2
            )
    else:
        total = None

    highest_group = max(group_insights, key=lambda item: item["value"])
    lowest_group = min(group_insights, key=lambda item: item["value"])

    return {
        "group_by": group_by,
        "value_column": value_column,
        "operation": operation,
        "total": _to_native(total),
        "group_count": len(group_insights),
        "highest_performing_group": highest_group,
        "lowest_performing_group": lowest_group,
        "group_insights": group_insights,
    }


def generate_registered_business_insights(
    registry: DatasetRegistry,
    dataset_id: str,
    group_by: str,
    value_column: str,
    operation: str = "sum",
) -> dict:
    df = registry.get(dataset_id)

    return generate_business_insights(
        df=df,
        group_by=group_by,
        value_column=value_column,
        operation=operation,
    )
