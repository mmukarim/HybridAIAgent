from uuid import uuid4

from langchain_core.messages import HumanMessage

from app.llm.factory import LLMFactory
from app.agent.executor import AgentExecutor

from app.tools.registration import build_tool_registry
from app.tools.schemas import TOOL_SCHEMAS
from app.tools.dataset_registry import DatasetRegistry
from app.tools.data_loader import load_dataset

from app.langchain_integration.agent import build_agent


def select_agent() -> str:
    """Ask the user to select an agent."""

    print("\nSelect an agent:")
    print("1. Custom Agent")
    print("2. LangGraph Agent")

    while True:
        choice = input("\nEnter your choice (1/2): ").strip()

        if choice == "1":
            return "custom"

        if choice == "2":
            return "langgraph"

        print("Invalid choice. Please enter 1 or 2.")


def initialize_dataset(dataset_registry: DatasetRegistry):
    """Optionally load and register a dataset."""

    file_path = input(
        "\nEnter dataset file path (press Enter to skip): "
    ).strip()

    if not file_path:
        print("No dataset loaded.")
        return

    try:
        df, metadata = load_dataset(file_path)

        dataset_id = dataset_registry.register(df, metadata)

        print("\nDataset loaded successfully.")
        print(f"Dataset ID: {dataset_id}")
        print(f"File: {metadata['file_name']}")
        print(f"Rows: {metadata['row_count']}")
        print(f"Columns: {metadata['column_count']}")

    except Exception as exc:
        print(f"\nDataset loading failed: {exc}")


def initialize_custom_agent(dataset_registry: DatasetRegistry):
    """Initialize the custom Gemini agent."""

    gemini = LLMFactory.create("gemini")

    tool_registry = build_tool_registry(dataset_registry)

    return AgentExecutor(
        gemini=gemini,
        tool_registry=tool_registry,
        tool_schemas=TOOL_SCHEMAS,
    )


def initialize_langgraph_agent(dataset_registry: DatasetRegistry):
    """Initialize the LangGraph agent."""

    return build_agent(dataset_registry)


def run_custom_agent(agent):
    """Run an interactive custom-agent session."""

    print("\nCustom Agent is ready.")
    print("Type 'exit' or 'quit' to end the session.")

    while True:
        user_input = input("\nUser: ").strip()

        if user_input.lower() in ("exit", "quit"):
            break

        if not user_input:
            continue

        try:
            response = agent.run(user_input)
            print("\nAgent:", response)

        except Exception as exc:
            print(f"\nAgent error: {exc}")


def run_langgraph_agent(graph):
    """Run an interactive LangGraph session."""

    print("\nLangGraph Agent is ready.")
    print("Type 'exit' or 'quit' to end the session.")

    # A unique thread ID maintains conversation state
    # for this session through InMemorySaver.
    config = {
        "configurable": {
            "thread_id": str(uuid4())
        }
    }

    while True:
        user_input = input("\nUser: ").strip()

        if user_input.lower() in ("exit", "quit"):
            break

        if not user_input:
            continue

        try:
            result = graph.invoke(
                {
                    "messages": [
                        HumanMessage(content=user_input)
                    ]
                },
                config=config,
            )

            response = result["messages"][-1]

            if isinstance(response.content, str):
                response_text = response.content
            else:
                response_text = "\n".join(
                    block["text"]
                    for block in response.content
                    if isinstance(block, dict) and block.get("type") == "text"
                )

            print("\nAgent:", response_text)

        except Exception as exc:
            print(f"\nAgent error: {exc}")


def main():

    print("=" * 50)
    print("       HYBRID AI AGENT")
    print("=" * 50)

    # 1. Select the agent
    agent_type = select_agent()

    # 2. Create one shared dataset registry
    dataset_registry = DatasetRegistry()

    # 3. Optionally load a dataset
    initialize_dataset(dataset_registry)

    # 4. Initialize the selected agent
    if agent_type == "custom":
        agent = initialize_custom_agent(dataset_registry)
        run_custom_agent(agent)

    else:
        graph = initialize_langgraph_agent(dataset_registry)
        run_langgraph_agent(graph)

    print("\nAgent session ended.")


if __name__ == "__main__":
    main()
