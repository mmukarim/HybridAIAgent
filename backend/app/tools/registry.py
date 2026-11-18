class ToolRegistry:

    def __init__(self):
        self.tools = {}

    def register(self, name: str, function):
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Tool name must be a non-empty string.")
        
        if not callable(function):
            raise TypeError("Tool must be a callable function.")
        
        name = name.strip()
        if name in self.tools:
            raise ValueError(f"Tool '{name}' is already registered.")
        
        self.tools[name] = function

    def execute(self, name: str, arguments: dict):
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Tool name must be a non-empty string.")
        
        name = name.strip()
        if name not in self.tools:
            raise ValueError(f"Tool '{name}' is not registered.")
        
        if not isinstance(arguments, dict):
            raise TypeError("Tool arguments must be a dictionary.")
        
        return self.tools[name](**arguments)