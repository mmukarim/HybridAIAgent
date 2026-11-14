def add_numbers(a: float, b: float) -> float:
    return a + b


def subtract_numbers(a: float, b: float) -> float:
    return a - b


def multiply_numbers(a: float, b: float) -> float:
    return a * b


def divide_numbers(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b