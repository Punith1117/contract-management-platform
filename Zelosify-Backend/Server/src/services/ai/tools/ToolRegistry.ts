export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: any): Promise<any> | any;
}

export interface GroqToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): GroqToolDefinition[] {
    const definitions: GroqToolDefinition[] = [];
    for (const tool of this.tools.values()) {
      definitions.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      });
    }
    return definitions;
  }

  async execute(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`[ToolRegistry] Access denied: Tool '${name}' is not in the tool registry allowlist.`);
    }
    console.log(`[ToolRegistry] Executing tool: ${name}`);
    const result = await tool.execute(args);
    console.log(`[ToolRegistry] Tool ${name} completed.`);
    return result;
  }
}
