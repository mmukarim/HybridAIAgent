from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, MessagesState, START
from langgraph.prebuilt import ToolNode, tools_condition

from app.langchain_integration.gemini import GeminiChatModel
from app.langchain_integration.tools import (
    add_numbers_tool,
    subtract_numbers_tool,
    multiply_numbers_tool,
    divide_numbers_tool,
    get_text_statistics_tool,
    build_dataset_analysis_tools,
)
from app.tools.dataset_registry import DatasetRegistry


def build_agent(dataset_registry: DatasetRegistry):

    # 1. Initialize the chat model
    chat_model = GeminiChatModel()

    # 2. Register existing tools
    tools = [
        add_numbers_tool,
        subtract_numbers_tool,
        multiply_numbers_tool,
        divide_numbers_tool,
        get_text_statistics_tool,
    ]

    # 3. Add dataset analysis tools
    dataset_tools = build_dataset_analysis_tools(dataset_registry)
    tools.extend(dataset_tools)

    # 4. Bind all tools to the model
    model_with_tools = chat_model.bind_tools(tools)

    # 5. Define the LLM node
    def call_model(state: MessagesState):
        response = model_with_tools.invoke(state["messages"])
        return {"messages": [response]}

    # 6. Build the graph
    builder = StateGraph(MessagesState)

    builder.add_node("llm", call_model)
    builder.add_node("tools", ToolNode(tools))

    builder.add_edge(START, "llm")
    builder.add_conditional_edges("llm", tools_condition)
    builder.add_edge("tools", "llm")

    # 7. Compile with checkpointing
    memory = InMemorySaver()
    graph = builder.compile(checkpointer=memory)

    return graph
