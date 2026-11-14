from langchain_core.tools import StructuredTool

from app.tools.calculator import add_numbers, divide_numbers, subtract_numbers, multiply_numbers
from app.tools.text_analyzer import get_text_statistics

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
