
class AgentExecutor:

    def __init__(
        self,
        gemini,
        tool_registry,
        tool_schemas,
        max_tool_rounds: int = 5,
    ):
        self.gemini = gemini
        self.tool_registry = tool_registry
        self.tool_schemas = tool_schemas
        self.max_tool_rounds = max_tool_rounds

    def run(self, user_input: str) -> str:
        # 1. Send initial request to Gemini

        # 2. Inspect interaction.steps

        # 3. Find function_call steps

        # 4. Execute requested tools through ToolRegistry

        # 5. Collect function_result objects

        # 6. Send results back to Gemini using
        #    previous_interaction_id

        # 7. Repeat until there are no more function calls
        #    or max_tool_rounds is reached

        # 8. Return Gemini's final output_text
        pass
