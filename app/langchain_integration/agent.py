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
)


# 1. Initialize the chat model
chat_model = GeminiChatModel()


# 2. Register available tools
tools = [
    add_numbers_tool,
    subtract_numbers_tool,
    multiply_numbers_tool,
    divide_numbers_tool,
    get_text_statistics_tool,
]


# 3. Bind tools to the model
model_with_tools = chat_model.bind_tools(tools)


# 4. Define the LLM node
def call_model(state: MessagesState):
    response = model_with_tools.invoke(state["messages"])

    return {
        "messages": [response]
    }


builder = StateGraph(MessagesState)

builder.add_node("llm", call_model)
builder.add_node("tools", ToolNode(tools))

builder.add_edge(START, "llm")

builder.add_conditional_edges("llm", tools_condition)
builder.add_edge("tools", "llm")

memory = InMemorySaver()
graph = builder.compile(checkpointer=memory)

message_config = {
    "configurable": {
        "thread_id": "calculator-session-1"
    }
}

# result = graph.invoke(
#     {
#         "messages": 
#                        [
#                            HumanMessage(content="Calculate 25 + 15, then divide the result by 2.")
#                        ]
#     },
#     config=message_config
# )

result = graph.invoke(
    {
        "messages": 
                       [
                           HumanMessage(content="My name is Minhaz. Can you tell me how many characters are in my name?")
                       ]
    },
    config=message_config
)
print(result["messages"][-1].text)
result = graph.invoke(
    {
        "messages": 
                       [
                           HumanMessage(content="Who am I?")
                       ]
    },
    config=message_config
)

# for message in result["messages"]:
#     print(type(message).__name__, message.content)

print(result["messages"][-1].text)

state = graph.get_state(message_config)

history = graph.get_state_history(message_config)

for checkpoint in history:
    print("Step:", checkpoint.metadata.get("step"))
    print("Next:", checkpoint.next)
    print("Messages:", len(checkpoint.values["messages"]))
    print("--------------------")