
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
]
