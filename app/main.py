from app.llm.factory import LLMFactory
from app.agent.executor import AgentExecutor
from app.tools.registration import build_tool_registry
from app.tools.schemas import TOOL_SCHEMAS

def main():
    gemini = LLMFactory.create("gemini")
    registry = build_tool_registry()

    agent = AgentExecutor(
        gemini=gemini,
        tool_registry=registry,
        tool_schemas=TOOL_SCHEMAS,
    )

    user_input = input("User: ")
    response = agent.run(user_input)

    print("Agent:", response)


if __name__ == "__main__":
    main()