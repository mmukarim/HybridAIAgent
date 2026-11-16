# Hybrid AI Agent

A Python-based Hybrid AI Agent that integrates multiple LLM providers, executes tools, orchestrates agent workflows, and performs intelligent business data analysis.

The project combines custom agent orchestration with LangChain and LangGraph, allowing experimentation with different approaches to tool calling, conversation memory, and data-driven reasoning.

It currently supports:

- **Google Gemini** as the primary cloud LLM.
- **Ollama** as a local LLM provider.
- **Hybrid model routing** based on task complexity.
- **Custom tool-calling agent** with iterative execution.
- **LangChain and LangGraph** for graph-based agent orchestration.
- **Conversation checkpointing** using LangGraph.
- **CSV and Excel data ingestion** using Pandas.
- **Statistical analysis and business insights** using Python.
- **Chart generation** using Matplotlib.
- **Business report generation** using Gemini.

---

## Project Overview

The application supports two agent implementations:

1. **Custom Agent:** A direct implementation of the LLM tool-calling loop using Google's GenAI SDK and a custom tool registry.
2. **LangGraph Agent:** A graph-based implementation using LangChain tools, LangGraph state management, conditional routing, and checkpointing.

Both implementations support the data analysis workflow through a shared dataset registry and reusable Python analysis functions.

The application can analyze datasets, generate statistical summaries, identify business insights, create charts, and produce natural-language business reports.

## Architecture

### High-level workflow

```text
                       User Input
                            |
                            v
                    Agent Selection
                            |
                 +----------+----------+
                 |                     |
                 v                     v
            Custom Agent          LangGraph Agent
                 |                     |
                 v                     v
          Agent Executor           StateGraph
                 |                     |
                 +----------+----------+
                            |
                            v
                     LLM Integration
                            |
                    +-------+-------+
                    |               |
                    v               v
                  Gemini          Ollama
                    |
                    v
                Tool Selection
                    |
                    v
                Tool Registry
                    |
          +---------+----------+
          |                    |
          v                    v
     Basic Tools         Data Analysis Tools
                               |
                        +------+------+
                        |             |
                        v             v
                   Pandas Analysis  Matplotlib
                        |
                        v
                  Business Insights
                        |
                        v
                  Gemini Reporting
                        |
                        v
                  Final Response
```

## Repository Structure

```text
hybrid-ai-agent/
├── .env
├── .env.example
├── .gitignore
├── requirements.txt
└── app/
    ├── __init__.py
    ├── config.py
    ├── main.py
    ├── test.py
    │
    ├── agent/
    │   ├── __init__.py
    │   ├── executor.py
    │   └── reporting.py
    │
    ├── llm/
    │   ├── __init__.py
    │   ├── base.py
    │   ├── factory.py
    │   ├── gemini.py
    │   ├── ollama.py
    │   └── router.py
    │
    ├── langchain_integration/
    │   ├── __init__.py
    │   ├── agent.py
    │   ├── gemini.py
    │   └── tools.py
    │
    └── tools/
        ├── __init__.py
        ├── calculator.py
        ├── data_analysis.py
        ├── data_loader.py
        ├── dataset_registry.py
        ├── registration.py
        ├── registry.py
        ├── schemas.py
        └── text_analyzer.py
```

## Key Components

### 1. LLM Provider Integration

The `app/llm` package provides a common abstraction for interacting with different LLM providers.

| Component | Responsibility |
|---|---|
| `base.py` | Defines the abstract LLM provider interface |
| `gemini.py` | Integrates Google Gemini using the GenAI SDK |
| `ollama.py` | Integrates locally hosted Ollama models |
| `factory.py` | Creates provider instances |
| `router.py` | Routes tasks to appropriate LLM providers |

The provider abstraction allows the application to switch between models without coupling the agent executor to a specific LLM implementation.

### 2. Hybrid Model Routing

`app/llm/router.py` implements `HybridModelRouter`.

The current routing policy is:

| Task Type | Provider |
|---|---|
| Simple | Ollama |
| Classification | Ollama |
| Local-only | Ollama |
| Complex | Gemini |
| Analysis | Gemini |

This provides a foundation for balancing local inference, cloud model capabilities, and execution costs.

### 3. Tool System

The `app/tools` package contains framework-independent Python functions used by both agent implementations.

#### Basic tools

- `add_numbers(a, b)`
- `subtract_numbers(a, b)`
- `multiply_numbers(a, b)`
- `divide_numbers(a, b)`
- `get_text_statistics(text)`

#### Data analysis tools

- `profile_dataset(dataset_id)`
- `analyze_column(dataset_id, column_name)`
- `analyze_correlations(dataset_id, method)`
- `aggregate_data(dataset_id, group_by, value_column, operation)`
- `generate_chart(dataset_id, chart_type, x_column, y_column, title)`
- `generate_business_insights(dataset_id, group_by, value_column, operation)`
- `generate_business_report(dataset_id, group_by, value_column, operation)`

The exact callable signatures include dataset registry dependencies where appropriate.

#### Tool registry

`app/tools/registry.py` provides a generic `ToolRegistry` that:

- Registers callable Python functions.
- Validates tool names and arguments.
- Executes functions dynamically.
- Handles unknown tools and invalid arguments.

`app/tools/registration.py` centralizes tool registration and supports dataset-aware tool dependencies.

`app/tools/schemas.py` defines the JSON schemas used by the custom Gemini function-calling implementation.

### 4. Custom Agent Executor

`app/agent/executor.py` implements the custom agent execution loop.

Its responsibilities include:

1. Sending user input and available tool schemas to Gemini.
2. Detecting function calls in model responses.
3. Executing requested functions through the tool registry.
4. Returning tool results to the LLM.
5. Continuing execution until the model produces a final response.
6. Handling execution errors and limiting the number of tool-call rounds.

The implementation supports sequential and dependent tool calls, where the output of one tool can be used as the input to another.

### 5. LangChain and LangGraph Integration

The `app/langchain_integration` package provides an alternative implementation using LangChain and LangGraph.

#### Gemini wrapper

`gemini.py` wraps `ChatGoogleGenerativeAI` and provides methods for:

- Invoking the model with text prompts.
- Invoking the model with message histories.
- Binding tools to the model.

#### StructuredTool adapters

`tools.py` converts framework-independent Python functions into LangChain `StructuredTool` instances.

It provides adapters for basic tools and dataset analysis tools, including chart generation and business reporting.

Dataset registry dependencies are injected into the adapters rather than embedded in the underlying business logic.

#### LangGraph agent

`agent.py` builds the agent workflow using:

- `StateGraph`
- `MessagesState`
- `ToolNode`
- `tools_condition`
- `START`
- `InMemorySaver`

The graph follows this execution pattern:

```text
START
  |
  v
LLM Node
  |
  v
Conditional Routing
  |
  +---- Tool Calls ----> Tool Node
  |                         |
  |                         v
  |                       LLM Node
  |
  +---- Final Response --> END
```

The LLM node decides whether to respond directly or invoke tools. The ToolNode executes requested functions and returns their results to the LLM.

### 6. Conversation Memory and Checkpointing

The LangGraph implementation uses `InMemorySaver` for conversation checkpointing.

Key capabilities include:

- Maintaining conversation state across multiple interactions.
- Using thread IDs to identify separate conversations.
- Isolating conversations using different thread IDs.
- Inspecting graph state and execution history.

The current implementation provides in-memory, thread-scoped checkpointing. Conversation state is not persisted across application restarts.

### 7. Dataset Ingestion and Management

The application uses Pandas to load and manage business datasets.

`app/tools/data_loader.py` supports:

- CSV files.
- Excel XLSX files.
- File existence and extension validation.
- Dataset metadata extraction.

Dataset metadata includes:

- File name.
- File format.
- Row count.
- Column count.
- Column names.

`app/tools/dataset_registry.py` implements an in-memory `DatasetRegistry`.

Each registered dataset receives a unique UUID that can be referenced by the agent's data analysis tools.

The registry supports:

- Dataset registration.
- Dataset retrieval.
- Metadata retrieval.
- Dataset listing.
- Dataset removal.

The registry is shared between agent components so that both Custom Agent and LangGraph Agent can access the same registered datasets.

### 8. Data Analysis Engine

`app/tools/data_analysis.py` implements the core analytical functionality using Pandas and Python.

#### Dataset profiling

`profile_dataset()` provides:

- Dataset dimensions.
- Column names and data types.
- Missing-value counts and percentages.
- Duplicate row counts.
- Numeric descriptive statistics.
- Categorical summaries.

#### Column analysis

`analyze_column()` supports numeric and categorical analysis.

For numeric columns, it calculates:

- Mean.
- Median.
- Standard deviation.
- Minimum and maximum.
- Percentiles and quartiles.

For categorical columns, it provides:

- Unique value counts.
- Most frequent values.
- Frequency distributions.

#### Correlation analysis

`analyze_correlations()` supports:

- Pearson correlation.
- Spearman correlation.
- Kendall correlation.

It generates correlation matrices and summarizes relationships between numeric variables.

Correlation results describe statistical relationships and do not establish causation.

#### Data aggregation

`aggregate_data()` supports group-based aggregation operations such as:

- Sum.
- Mean.
- Median.
- Minimum.
- Maximum.

The results can be used by other analytical functions to generate business insights.

#### Business insights

`generate_business_insights()` derives structured insights from aggregated results, including:

- Total aggregated value for sum operations.
- Number of groups.
- Highest-performing group.
- Lowest-performing group.
- Group-level values.
- Contribution percentages for sum operations.

### 9. Chart Generation

The project uses Matplotlib for chart generation.

`generate_chart()` currently supports:

| Chart Type | Purpose |
|---|---|
| Bar | Compare values across categories |
| Line | Visualize trends across ordered data |
| Scatter | Explore relationships between two numeric variables |
| Histogram | Examine the distribution of numeric data |

Generated charts are saved as PNG files, and the tool returns their file paths and relevant metadata.

### 10. Business Report Generation

`app/agent/reporting.py` combines deterministic Python analysis with Gemini-based natural-language interpretation.

The workflow is:

1. Retrieve the registered dataset.
2. Execute Python-based business analysis.
3. Generate structured analytical results.
4. Pass those results to Gemini.
5. Generate a structured business report.

The reporting implementation uses deterministic analytical results as its source of truth.

The reporting prompt enforces important constraints:

- Do not recalculate or modify numerical results.
- Do not invent missing metrics or business context.
- Do not assume currency, units, or reporting periods.
- Distinguish observed facts from interpretations.
- Label possible explanations as hypotheses.
- Do not infer causation from statistical relationships.
- Identify assumptions behind recommendations.
- Explicitly mention data limitations.

The generated report includes:

- Executive Summary.
- Key Findings.
- Business Implications.
- Recommendations.
- Limitations.

## Configuration

Create a `.env` file in the project root based on `.env.example`.

Example:

```env
GEMINI_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_HOST=http://localhost:11434
```

Configuration is managed through `app/config.py` and environment variables.

**Important:** Keep API keys and other secrets in `.env`. Do not commit this file to version control.

## Installation

### Prerequisites

- Python 3.13 or compatible Python version.
- Google Gemini API key.
- Ollama installed locally if local model inference is required.
- Git.

### 1. Clone the repository

```bash
git clone <repository-url>
cd hybrid-ai-agent
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
```

### 3. Activate the virtual environment

macOS/Linux:

```bash
source .venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure environment variables

Create `.env` using `.env.example` and provide the required Gemini API key and model configuration.

### 6. Start Ollama (if using local inference)

Ensure the Ollama service is running and the configured model is available.

For example:

```bash
ollama pull qwen3:1.7b
```

## Running the Application

Activate the virtual environment and run:

```bash
python -m app.main
```

The application provides an interactive CLI where you can select the agent implementation and interact with the selected agent.

The application supports:

- Custom Agent.
- LangGraph Agent.

You can also provide a local dataset path during initialization to make the dataset available to the analysis tools.

## Example Use Cases

### 1. Basic tool calling

```text
Add 25 and 17, then multiply the result by 2.
```

The agent can execute sequential arithmetic operations through its calculator tools.

### 2. Text analysis

```text
Tell me how many words are in this sentence:
"The future of AI is collaborative and practical."
```

The agent can invoke the text statistics tool.

### 3. Dataset profiling

```text
Profile the loaded dataset and summarize its columns,
data types, missing values, and duplicate rows.
```

### 4. Statistical analysis

```text
Analyze the revenue column and calculate its mean,
median, standard deviation, minimum, and maximum.
```

### 5. Correlation analysis

```text
Analyze the correlations between the numeric columns
using Pearson correlation.
```

### 6. Business aggregation

```text
Calculate total revenue grouped by product.
```

### 7. Chart generation

```text
Generate a bar chart showing revenue by product.
```

### 8. Business report generation

```text
Generate a business report for total revenue grouped by product.
Identify the highest and lowest performing products and
their contribution percentages.
```

The agent performs deterministic analysis using Python and then uses Gemini to interpret the results in a structured business report.

## Testing

The project includes a basic smoke-test module at:

```text
app/test.py
```

Run it using:

```bash
python -m app.test
```

Additional functionality has been tested through direct tool execution and agent interactions, including:

- Calculator operations.
- Sequential tool calling.
- Division-by-zero handling.
- Text statistics.
- LangGraph tool execution.
- Conversation checkpointing.
- Dataset ingestion and registration.
- Dataset profiling and column analysis.
- Correlation analysis.
- Data aggregation.
- Chart generation.
- Business insights generation.
- Business report generation through the agent.

## Dependencies

The project uses the following primary libraries:

| Library | Purpose |
|---|---|
| `google-genai` | Direct Google Gemini integration |
| `ollama` | Local LLM integration |
| `python-dotenv` | Environment configuration |
| `langchain` | LLM and tool abstractions |
| `langchain-core` | Message and tool interfaces |
| `langchain-google-genai` | Gemini integration for LangChain |
| `langchain-ollama` | Ollama integration for LangChain |
| `langgraph` | Agent graph orchestration and checkpointing |
| `pandas` | Dataset loading and analysis |
| `openpyxl` | Excel XLSX support |
| `matplotlib` | Chart generation |

Refer to `requirements.txt` for the exact installed and pinned package versions.

## Design Principles

The project follows several architectural principles:

1. **Provider abstraction:** Keep LLM provider implementations separate from agent orchestration.
2. **Framework-independent tools:** Keep business logic in `app/tools/` rather than coupling it to LangChain.
3. **Reusable tool adapters:** Use LangChain adapters to expose existing Python functions to LangGraph.
4. **Separation of analysis and interpretation:** Use Python for deterministic calculations and Gemini for natural-language interpretation.
5. **Shared dataset management:** Use a common dataset registry across agent implementations.
6. **Explicit tool schemas:** Define tool arguments and descriptions to support structured function calling.
7. **Controlled LLM reporting:** Ground generated reports in analytical results and explicitly communicate limitations.

## Limitations

- Dataset registry and conversation checkpointing currently use in-memory storage.
- Dataset registrations and conversation checkpoints are lost when the process restarts.
- Generated charts are saved as local PNG files rather than embedded directly in chat responses.
- The hybrid routing policy is implemented separately from the LangGraph workflow.
- The current implementation is a learning and experimentation project, not a production-ready enterprise agent framework.

## License

This repository currently does not include a license file. Add an appropriate license before distributing or publishing the project for reuse.