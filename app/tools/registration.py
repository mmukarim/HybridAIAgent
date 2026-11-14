

from app.tools.registry import ToolRegistry
from app.tools.calculator import add_numbers, subtract_numbers, multiply_numbers, divide_numbers
from app.tools.text_analyzer import get_text_statistics


def build_tool_registry() -> ToolRegistry:
    """
    Build and return a ToolRegistry instance with registered tools.
    """
    tool_registry = ToolRegistry()

    tool_registry.register("add_numbers", add_numbers)
    tool_registry.register("subtract_numbers", subtract_numbers)
    tool_registry.register("multiply_numbers", multiply_numbers)
    tool_registry.register("divide_numbers", divide_numbers)

    tool_registry.register("get_text_statistics", get_text_statistics)

    return tool_registry