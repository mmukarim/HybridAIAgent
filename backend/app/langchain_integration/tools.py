from typing import Annotated

from langchain.tools import InjectedState
from langchain_core.tools import StructuredTool

from app.agent.reporting import generate_business_report
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
    generate_registered_chart,
    generate_registered_business_insights
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

    def require_dataset_id(dataset_id: str | None) -> str:
        if not dataset_id:
            raise ValueError(
                "No dataset is associated with this conversation. "
                "Please upload and associate a dataset first."
            )
        return dataset_id

    def profile_dataset(dataset_id: Annotated[str | None, InjectedState("dataset_id")]) -> dict:
        dataset_id = require_dataset_id(dataset_id)
        return profile_registered_dataset(
            dataset_registry, dataset_id
        )

    def analyze_column(dataset_id: Annotated[str | None, InjectedState("dataset_id")], column_name: str) -> dict:
        dataset_id = require_dataset_id(dataset_id)
        return analyze_registered_column(
            dataset_registry, dataset_id, column_name
        )

    def analyze_correlations(
        dataset_id: Annotated[str | None, InjectedState("dataset_id")],
        method: str = "pearson"
    ) -> dict:
        dataset_id = require_dataset_id(dataset_id)
        return analyze_registered_correlations(
            dataset_registry, dataset_id, method
        )

    def aggregate_data(
        dataset_id: Annotated[str | None, InjectedState("dataset_id")],
        group_by: str,
        value_column: str,
        operation: str = "sum"
    ) -> dict:
        dataset_id = require_dataset_id(dataset_id)
        return aggregate_registered_data(
            dataset_registry,
            dataset_id,
            group_by,
            value_column,
            operation
        )

    def generate_chart(
        dataset_id: Annotated[str | None, InjectedState("dataset_id")],
        chart_type: str,
        x_column: str,
        y_column: str = None,
        title: str = None
    ) -> dict:
        dataset_id = require_dataset_id(dataset_id)
        return generate_registered_chart(
            registry=dataset_registry,
            dataset_id=dataset_id,
            chart_type=chart_type,
            x_column=x_column,
            y_column=y_column,
            title=title
        )

    def generate_business_insights(
        dataset_id: Annotated[str | None, InjectedState("dataset_id")],
        group_by: str,
        value_column: str,
        operation: str = "sum"
    ) -> dict:
        dataset_id = require_dataset_id(dataset_id)
        return generate_registered_business_insights(
            registry=dataset_registry,
            dataset_id=dataset_id,
            group_by=group_by,
            value_column=value_column,
            operation=operation
        )

    def create_business_report(
    dataset_id: Annotated[str | None, InjectedState("dataset_id")],
    group_by: str,
    value_column: str,
    operation: str = "sum",
    ) -> str:
        dataset_id = require_dataset_id(dataset_id)
        return generate_business_report(
            registry=dataset_registry,
            dataset_id=dataset_id,
            group_by=group_by,
            value_column=value_column,
            operation=operation
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
        StructuredTool.from_function(
            func=generate_chart,
            name="generate_chart",
            description=(
                "Generates a bar chart, line chart, scatter plot, or histogram "
                "from a registered dataset. Returns the saved chart image path."   
            )
        ),
        StructuredTool.from_function(
            func=generate_business_insights,
            name="generate_business_insights",
            description=(
                "Generates deterministic business insights from a registered "
                "dataset, identifying highest and lowest performing groups "
                "and contribution percentages."
            )
        ),
        StructuredTool.from_function(
            func=create_business_report,
            name="generate_business_report",
            description=(
                "Generates a complete business report using Python analysis "
                "and Gemini interpretation."
            ),
        ),
    ]
