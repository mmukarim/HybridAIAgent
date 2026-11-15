
"""Tool schemas for calculator and text analyzer tools."""

_TWO_NUMBERS = {
    "type": "object",
    "properties": {
        "a": {
            "type": "number",
            "description": "The first number."
        },
        "b": {
            "type": "number",
            "description": "The second number."
        },
    },
    "required": ["a", "b"],
    "additionalProperties": False,
}

_TEXT_INPUT = {
    "type": "object",
    "properties": {
        "text": {
            "type": "string",
            "description": "The text to analyze."
        },
    },
    "required": ["text"],
    "additionalProperties": False,
}

_DATASET_ID = {
    "type": "string",
    "description": "The ID of the registered dataset to analyze."
}

_PROFILE_DATASET = {
    "type": "object",
    "properties": {
        "dataset_id": _DATASET_ID
    },
    "required": ["dataset_id"],
    "additionalProperties": False
}

_ANALYZE_COLUMN = {
    "type": "object",
    "properties": {
        "dataset_id": _DATASET_ID,
        "column_name": {
            "type": "string",
            "description": "The name of the column to analyze."
        }
    },
    "required": ["dataset_id", "column_name"],
    "additionalProperties": False
}

_ANALYZE_CORRELATIONS = {
    "type": "object",
    "properties": {
        "dataset_id": _DATASET_ID,
        "method": {
            "type": "string",
            "enum": ["pearson", "spearman", "kendall"],
            "description": "Correlation method. Defaults to pearson."
        }
    },
    "required": ["dataset_id"],
    "additionalProperties": False
}

_AGGREGATE_DATA = {
    "type": "object",
    "properties": {
        "dataset_id": _DATASET_ID,
        "group_by": {
            "type": "string",
            "description": "Column used to group the dataset."
        },
        "value_column": {
            "type": "string",
            "description": "Numeric column on which to perform aggregation."
        },
        "operation": {
            "type": "string",
            "enum": ["sum", "mean", "median", "min", "max", "count"],
            "description": "Aggregation operation. Defaults to sum."
        }
    },
    "required": ["dataset_id", "group_by", "value_column"],
    "additionalProperties": False
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "name": "add_numbers",
        "description": "Add two numbers.",
        "parameters": _TWO_NUMBERS,
    },
    {
        "type": "function",
        "name": "subtract_numbers",
        "description": "Subtract the second number from the first.",
        "parameters": _TWO_NUMBERS,
    },
    {
        "type": "function",
        "name": "multiply_numbers",
        "description": "Multiply two numbers.",
        "parameters": _TWO_NUMBERS,
    },
    {
        "type": "function",
        "name": "divide_numbers",
        "description": "Divide the first number by the second.",
        "parameters": _TWO_NUMBERS,
    },
    {
        "type": "function",
        "name": "get_text_statistics",
        "description": (
            "Analyze text and return its character count, "
            "word count, and sentence count."
        ),
        "parameters": _TEXT_INPUT,
    },
    {
        "type": "function",
        "name": "profile_dataset",
        "description": "Generate a comprehensive profile of a registered dataset, including its columns, data types, missing values, duplicates, and statistical summaries.",
        "parameters": _PROFILE_DATASET
    },
    {
        "type": "function",
        "name": "analyze_column",
        "description": "Analyze a specific column in a registered dataset. Provides descriptive statistics for numeric columns and frequency information for categorical columns.",
        "parameters": _ANALYZE_COLUMN
    },
    {
        "type": "function",
        "name": "analyze_correlations",
        "description": "Calculate correlations between numeric columns in a registered dataset using Pearson, Spearman, or Kendall methods.",
        "parameters": _ANALYZE_CORRELATIONS
    },
    {
        "type": "function",
        "name": "aggregate_data",
        "description": "Group a registered dataset by a column and aggregate another column using sum, mean, median, min, max, or count.",
        "parameters": _AGGREGATE_DATA
    }
]
