from functools import partial

from app.agent.reporting import generate_business_report
from app.tools.registry import ToolRegistry
from app.tools.calculator import (
    add_numbers,
    subtract_numbers,
    multiply_numbers,
    divide_numbers
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


def build_tool_registry(dataset_registry=None) -> ToolRegistry:
    """
    Build and return a ToolRegistry instance with registered tools.
    """

    tool_registry = ToolRegistry()

    # Calculator tools
    tool_registry.register("add_numbers", add_numbers)
    tool_registry.register("subtract_numbers", subtract_numbers)
    tool_registry.register("multiply_numbers", multiply_numbers)
    tool_registry.register("divide_numbers", divide_numbers)

    # Text analysis tool
    tool_registry.register("get_text_statistics", get_text_statistics)

    # Dataset analysis tools
    if dataset_registry is not None:

        tool_registry.register(
            "profile_dataset",
            partial(
                profile_registered_dataset,
                registry=dataset_registry
            )
        )

        tool_registry.register(
            "analyze_column",
            partial(
                analyze_registered_column,
                registry=dataset_registry
            )
        )

        tool_registry.register(
            "analyze_correlations",
            partial(
                analyze_registered_correlations,
                registry=dataset_registry
            )
        )

        tool_registry.register(
            "aggregate_data",
            partial(
                aggregate_registered_data,
                registry=dataset_registry
            )
        )

        tool_registry.register(
            "generate_chart",
            partial(
                generate_registered_chart,
                registry=dataset_registry
            )
        )
        
        tool_registry.register(
            "generate_business_insights",
            partial(
                generate_registered_business_insights,
                registry=dataset_registry
            )
        )

        tool_registry.register(
            "generate_business_report",
            partial(
                generate_business_report,
                registry=dataset_registry,
            )
        )

    return tool_registry
