from langchain_core.tools import StructuredTool

from app.tools.calculator import (
    add_numbers, 
    divide_numbers, 
    subtract_numbers, 
    multiply_numbers
)
from app.tools.text_analyzer import get_text_statistics
from app.tools.data_analysis import (
    profile_registered_dataset,
    analyze_registered_column,
    analyze_registered_correlations,
    aggregate_registered_data,
)
from app.tools.dataset_registry import DatasetRegistry

add_numbers_tool = StructuredTool.from_function(
    func=add_numbers,
    description="Adds two numbers together"
)

subtract_numbers_tool = StructuredTool.from_function(
    func=subtract_numbers,
    description="Subtracts one number from another"
)

multiply_numbers_tool = StructuredTool.from_function(
    func=multiply_numbers,
    description="Multiplies two numbers together"
)

divide_numbers_tool = StructuredTool.from_function(
    func=divide_numbers,
    description="Divides one number by another"
)

get_text_statistics_tool = StructuredTool.from_function(
    func=get_text_statistics,
    description="Analyzes text and provides statistics such as word count and character count"
)


def build_dataset_analysis_tools(
    dataset_registry: DatasetRegistry,
) -> list[StructuredTool]:

    def profile_dataset(dataset_id: str) -> dict:
        return profile_registered_dataset(
            dataset_registry, dataset_id
        )

    def analyze_column(dataset_id: str, column_name: str) -> dict:
        return analyze_registered_column(
            dataset_registry, dataset_id, column_name
        )

    def analyze_correlations(
        dataset_id: str,
        method: str = "pearson"
    ) -> dict:
        return analyze_registered_correlations(
            dataset_registry, dataset_id, method
        )

    def aggregate_data(
        dataset_id: str,
        group_by: str,
        value_column: str,
        operation: str = "sum"
    ) -> dict:
        return aggregate_registered_data(
            dataset_registry,
            dataset_id,
            group_by,
            value_column,
            operation
        )

    return [
        StructuredTool.from_function(
            func=profile_dataset,
            name="profile_dataset",
            description="Generate a comprehensive profile of a registered dataset."
        ),
        StructuredTool.from_function(
            func=analyze_column,
            name="analyze_column",
            description="Analyze a specific column in a registered dataset."
        ),
        StructuredTool.from_function(
            func=analyze_correlations,
            name="analyze_correlations",
            description="Calculate correlations between numeric columns in a registered dataset."
        ),
        StructuredTool.from_function(
            func=aggregate_data,
            name="aggregate_data",
            description="Group and aggregate data in a registered dataset."
        ),
    ]
