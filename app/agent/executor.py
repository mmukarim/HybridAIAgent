import json


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
        # 1. Send the initial request to Gemini
        interaction = self.gemini.create_interaction(
            input_data=user_input,
            tools=self.tool_schemas,
        )

        tool_rounds = 0

        while True:
            # 2. Identify function calls in the response
            function_calls = [
                step
                for step in (interaction.steps or [])
                if step.type == "function_call"
            ]

            # 3. No function calls means Gemini has finished
            if not function_calls:
                return interaction.output_text

            # 4. Prevent unlimited tool execution
            if tool_rounds >= self.max_tool_rounds:
                raise RuntimeError(
                    "Maximum tool-calling rounds exceeded."
                )

            function_results = []

            # 5. Execute all requested tools
            for step in function_calls:
                # print(f"[TOOL CALL] {step.name}")
                # print(f"[TOOL ARGUMENTS] {step.arguments}")
                try:
                    result = self.tool_registry.execute(
                        step.name,
                        step.arguments,
                    )
                    # print(f"[TOOL RESULT] {result}")

                except Exception as exc:
                    # print(f"[TOOL ERROR] {exc}")
                    result = {
                        "error": str(exc)
                    }

                # 6. Prepare the result for Gemini
                function_results.append({
                    "type": "function_result",
                    "name": step.name,
                    "call_id": step.id,
                    "result": json.dumps(result),
                })

            # 7. Send results back to Gemini
            interaction = self.gemini.create_interaction(
                input_data=function_results,
                tools=self.tool_schemas,
                previous_interaction_id=interaction.id,
            )

            tool_rounds += 1
