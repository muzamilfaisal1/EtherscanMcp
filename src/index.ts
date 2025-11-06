#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const ETHERSCAN_API_BASE = "https://api.etherscan.io/api";

// Get API key from environment variable (required for Smithery deployment)
function getApiKey(): string {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ETHERSCAN_API_KEY environment variable is required. " +
      "Please set it in your Smithery configuration or environment."
    );
  }
  return apiKey;
}

// Helper function to make Etherscan API calls
// Supports Etherscan API V2 multichain with optional chainid parameter
async function callEtherscanAPI(
  params: Record<string, string | number>,
  chainid?: number
): Promise<any> {
  const apiKey = getApiKey();
  const requestParams: Record<string, string | number> = {
    ...params,
    apikey: apiKey,
  };
  
  // Add chainid for multichain support (API V2)
  // If not provided, defaults to Ethereum mainnet (chainid 1)
  if (chainid !== undefined) {
    requestParams.chainid = chainid;
  }
  
  const response = await axios.get(ETHERSCAN_API_BASE, {
    params: requestParams,
  });
  return response.data;
}

// Helper function to format response as MCP content
function formatResponse(data: any) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// Create MCP server
const server = new Server(
  {
    name: "etherscan-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List all available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Account Tools
      {
        name: "get_balance",
        description: "Get ETH balance for a single Ethereum address (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Ethereum address to check balance for",
            },
            tag: {
              type: "string",
              description: "Block tag (latest, earliest, pending, or block number)",
              default: "latest",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "get_multiple_balances",
        description: "Get ETH balances for multiple Ethereum addresses (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            addresses: {
              type: "array",
              items: { type: "string" },
              description: "Array of Ethereum addresses (comma-separated or array)",
            },
            tag: {
              type: "string",
              description: "Block tag (latest, earliest, pending, or block number)",
              default: "latest",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["addresses"],
        },
      },
      {
        name: "get_transactions",
        description: "Get a list of normal transactions for an address (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Ethereum address to get transactions for",
            },
            startblock: {
              type: "number",
              description: "Start block number",
              default: 0,
            },
            endblock: {
              type: "number",
              description: "End block number (use 99999999 for latest)",
              default: 99999999,
            },
            page: {
              type: "number",
              description: "Page number",
              default: 1,
            },
            offset: {
              type: "number",
              description: "Number of transactions per page",
              default: 10,
            },
            sort: {
              type: "string",
              description: "Sort order (asc or desc)",
              enum: ["asc", "desc"],
              default: "desc",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["address"],
        },
      },
      // Block Tools
      {
        name: "get_block_reward",
        description: "Get block and uncle rewards by block number (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            blockno: {
              type: "number",
              description: "Block number to get rewards for",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["blockno"],
        },
      },
      {
        name: "get_block_countdown",
        description: "Get estimated time remaining until a certain block is mined (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            blockno: {
              type: "number",
              description: "Target block number",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["blockno"],
        },
      },
      {
        name: "get_block_number_by_timestamp",
        description: "Get block number closest to a given timestamp (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            timestamp: {
              type: "number",
              description: "Unix timestamp",
            },
            closest: {
              type: "string",
              description: "Direction to search (before or after)",
              enum: ["before", "after"],
              default: "before",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["timestamp"],
        },
      },
      // Transaction Tools
      {
        name: "get_tx_status",
        description: "Get transaction execution status (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            txhash: {
              type: "string",
              description: "Transaction hash",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["txhash"],
        },
      },
      {
        name: "get_internal_transactions",
        description: "Get internal transactions by transaction hash or address (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            txhash: {
              type: "string",
              description: "Transaction hash (if provided, address params are ignored)",
            },
            address: {
              type: "string",
              description: "Address to get internal transactions for",
            },
            startblock: {
              type: "number",
              description: "Start block number",
              default: 0,
            },
            endblock: {
              type: "number",
              description: "End block number (use 99999999 for latest)",
              default: 99999999,
            },
            page: {
              type: "number",
              description: "Page number",
              default: 1,
            },
            offset: {
              type: "number",
              description: "Number of transactions per page",
              default: 10,
            },
            sort: {
              type: "string",
              description: "Sort order (asc or desc)",
              enum: ["asc", "desc"],
              default: "desc",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
        },
      },
      // Contract Tools
      {
        name: "get_abi",
        description: "Get contract ABI (Application Binary Interface) for a verified contract (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Contract address",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["address"],
        },
      },
      {
        name: "get_source_code",
        description: "Get contract source code for a verified contract (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Contract address",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["address"],
        },
      },
      // Gas Tracker Tools
      {
        name: "get_gas_oracle",
        description: "Get current gas prices (Safe, Propose, Fast) (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
        },
      },
      // Token Tools
      {
        name: "get_token_supply",
        description: "Get total supply of an ERC-20 token (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            contractaddress: {
              type: "string",
              description: "ERC-20 token contract address",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["contractaddress"],
        },
      },
      {
        name: "get_token_balance",
        description: "Get ERC-20 token balance for an address (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            contractaddress: {
              type: "string",
              description: "ERC-20 token contract address",
            },
            address: {
              type: "string",
              description: "Address to check token balance for",
            },
            tag: {
              type: "string",
              description: "Block tag (latest, earliest, pending, or block number)",
              default: "latest",
            },
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
          required: ["contractaddress", "address"],
        },
      },
      // Stats Tools
      {
        name: "get_eth_price",
        description: "Get current ETH price in USD and BTC (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
        },
      },
      {
        name: "get_node_count",
        description: "Get total number of Ethereum nodes (supports multichain via chainid)",
        inputSchema: {
          type: "object",
          properties: {
            chainid: {
              type: "number",
              description: "Chain ID for multichain support (1=Ethereum, 56=BSC, 137=Polygon, etc.). Defaults to 1 if not provided.",
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: any } }) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Account Tools
      case "get_balance": {
        const { address, tag = "latest", chainid } = args as {
          address: string;
          tag?: string;
          chainid?: number;
        };
        if (!address) {
          throw new McpError(ErrorCode.InvalidParams, "address is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "account",
            action: "balance",
            address,
            tag,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_multiple_balances": {
        const { addresses, tag = "latest", chainid } = args as {
          addresses: string[] | string;
          tag?: string;
          chainid?: number;
        };
        if (!addresses) {
          throw new McpError(ErrorCode.InvalidParams, "addresses is required");
        }
        const addressList = Array.isArray(addresses)
          ? addresses.join(",")
          : addresses;
        const data = await callEtherscanAPI(
          {
            module: "account",
            action: "balancemulti",
            address: addressList,
            tag,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_transactions": {
        const {
          address,
          startblock = 0,
          endblock = 99999999,
          page = 1,
          offset = 10,
          sort = "desc",
          chainid,
        } = args as {
          address: string;
          startblock?: number;
          endblock?: number;
          page?: number;
          offset?: number;
          sort?: string;
          chainid?: number;
        };
        if (!address) {
          throw new McpError(ErrorCode.InvalidParams, "address is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "account",
            action: "txlist",
            address,
            startblock,
            endblock,
            page,
            offset,
            sort,
          },
          chainid
        );
        return formatResponse(data);
      }

      // Block Tools
      case "get_block_reward": {
        const { blockno, chainid } = args as { blockno: number; chainid?: number };
        if (blockno === undefined) {
          throw new McpError(ErrorCode.InvalidParams, "blockno is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "block",
            action: "getblockreward",
            blockno,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_block_countdown": {
        const { blockno, chainid } = args as { blockno: number; chainid?: number };
        if (blockno === undefined) {
          throw new McpError(ErrorCode.InvalidParams, "blockno is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "block",
            action: "getblockcountdown",
            blockno,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_block_number_by_timestamp": {
        const { timestamp, closest = "before", chainid } = args as {
          timestamp: number;
          closest?: string;
          chainid?: number;
        };
        if (timestamp === undefined) {
          throw new McpError(ErrorCode.InvalidParams, "timestamp is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "block",
            action: "getblocknobytime",
            timestamp,
            closest,
          },
          chainid
        );
        return formatResponse(data);
      }

      // Transaction Tools
      case "get_tx_status": {
        const { txhash, chainid } = args as { txhash: string; chainid?: number };
        if (!txhash) {
          throw new McpError(ErrorCode.InvalidParams, "txhash is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "transaction",
            action: "getstatus",
            txhash,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_internal_transactions": {
        const {
          txhash,
          address,
          startblock = 0,
          endblock = 99999999,
          page = 1,
          offset = 10,
          sort = "desc",
          chainid,
        } = args as {
          txhash?: string;
          address?: string;
          startblock?: number;
          endblock?: number;
          page?: number;
          offset?: number;
          sort?: string;
          chainid?: number;
        };
        if (!txhash && !address) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Either txhash or address is required"
          );
        }
        const params: Record<string, string | number> = {
          module: "account",
          action: "txlistinternal",
        };
        if (txhash) {
          params.txhash = txhash;
        } else if (address) {
          params.address = address;
          params.startblock = startblock;
          params.endblock = endblock;
          params.page = page;
          params.offset = offset;
          params.sort = sort;
        }
        const data = await callEtherscanAPI(params, chainid);
        return formatResponse(data);
      }

      // Contract Tools
      case "get_abi": {
        const { address, chainid } = args as { address: string; chainid?: number };
        if (!address) {
          throw new McpError(ErrorCode.InvalidParams, "address is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "contract",
            action: "getabi",
            address,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_source_code": {
        const { address, chainid } = args as { address: string; chainid?: number };
        if (!address) {
          throw new McpError(ErrorCode.InvalidParams, "address is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "contract",
            action: "getsourcecode",
            address,
          },
          chainid
        );
        return formatResponse(data);
      }

      // Gas Tracker Tools
      case "get_gas_oracle": {
        const { chainid } = args as { chainid?: number };
        const data = await callEtherscanAPI(
          {
            module: "gastracker",
            action: "gasoracle",
          },
          chainid
        );
        return formatResponse(data);
      }

      // Token Tools
      case "get_token_supply": {
        const { contractaddress, chainid } = args as {
          contractaddress: string;
          chainid?: number;
        };
        if (!contractaddress) {
          throw new McpError(ErrorCode.InvalidParams, "contractaddress is required");
        }
        const data = await callEtherscanAPI(
          {
            module: "stats",
            action: "tokensupply",
            contractaddress,
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_token_balance": {
        const { contractaddress, address, tag = "latest", chainid } = args as {
          contractaddress: string;
          address: string;
          tag?: string;
          chainid?: number;
        };
        if (!contractaddress || !address) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "contractaddress and address are required"
          );
        }
        const data = await callEtherscanAPI(
          {
            module: "account",
            action: "tokenbalance",
            contractaddress,
            address,
            tag,
          },
          chainid
        );
        return formatResponse(data);
      }

      // Stats Tools
      case "get_eth_price": {
        const { chainid } = args as { chainid?: number };
        const data = await callEtherscanAPI(
          {
            module: "stats",
            action: "ethprice",
          },
          chainid
        );
        return formatResponse(data);
      }

      case "get_node_count": {
        const { chainid } = args as { chainid?: number };
        const data = await callEtherscanAPI(
          {
            module: "stats",
            action: "nodecount",
          },
          chainid
        );
        return formatResponse(data);
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start the server
async function main() {
  // Validate API key is available before starting
  try {
    getApiKey();
  } catch (error) {
    console.error("ERROR: Failed to start Etherscan MCP server");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\nPlease set the ETHERSCAN_API_KEY environment variable.");
    console.error("Get your API key at: https://etherscan.io/apis");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Etherscan MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

