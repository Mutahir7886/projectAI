const fs = require("fs");
const path = require("path");
const { tool } = require("@openai/agents");
const { z } = require("zod");

const pricesPath = path.resolve("context", "tickers_with_price.json");
const pricesData = JSON.parse(fs.readFileSync(pricesPath, "utf-8"));

// TOOL 1 — get_price
 const getPriceTool = tool({
  name: "get_price",
  description: "Get the current price of a stock by its symbol",
  parameters: z.object({
    symbol: z.string().describe("Stock symbol, e.g. HBL, AAPL, TSLA")
  }),
  execute: async (input) => {
    const sym = input.symbol.toUpperCase().trim();
    const record = pricesData.find((r) => r.symbol.toUpperCase() === sym);

    if (!record) {
      return {
        explanation: `Stock with symbol '${input.symbol}' not found.`,
        toolUsed: { name: "get_price", args: { symbol: input.symbol } },
        data: null
      };
    }

    const currency = record.currency ?? "PKR";
    const asOf = record.asOf ?? new Date().toISOString().slice(0, 10);

    return {
      explanation: `${record.name} trades at ${currency} ${record.price} as of ${asOf}.`,
      toolUsed: { name: "get_price", args: { symbol: record.symbol } },
      data: {
        symbol: record.symbol,
        price: record.price,
        currency,
        asOf
      }
    };
  }
});

// TOOL 2 — get_company
 const getCompanyTool = tool({
  name: "get_company",
  description: "Get details of a company by its stock symbol",
  parameters: z.object({
    symbol: z.string().describe("Stock symbol, e.g. HBL, AAPL, TSLA")
  }),
  execute: async (input) => {
    const sym = input.symbol.toUpperCase().trim();
    const record = pricesData.find((r) => r.symbol.toUpperCase() === sym);

    if (!record) {
      return {
        explanation: `No company found for symbol '${input.symbol}'.`,
        toolUsed: { name: "get_company", args: { symbol: input.symbol } },
        data: null
      };
    }

    return {
      explanation: `Company lookup successful: ${record.name} belongs to sector '${record.sectorName}'.`,
      toolUsed: { name: "get_company", args: { symbol: record.symbol } },
      data: {
        symbol: record.symbol,
        name: record.name,
        sectorName: record.sectorName || "Unknown"
      }
    };
  }
});

// TOOL 3 — search_companies
 const searchCompaniesTool = tool({
  name: "search_companies",
  description: "Search companies by optional name query and/or sector",
  parameters: z.object({
    query: z.string().nullable().describe("Search by company name substring"),
    sector: z.string().nullable().describe("Filter by sector name")
  }),
  execute: async (input) => {
    const query = input.query ? input.query.toLowerCase() : null;
    const sector = input.sector ? input.sector.toLowerCase() : null;

    let results = pricesData;

    if (query) {
      results = results.filter((c) =>
        c.name.toLowerCase().includes(query)
      );
    }

    if (sector) {
      results = results.filter(
        (c) => (c.sectorName || "").toLowerCase() === sector
      );
    }

    if (results.length === 0) {
      return {
        explanation: `No companies found for query='${input.query || ""}' sector='${input.sector || ""}'.`,
        toolUsed: { name: "search_companies", args: input },
        data: []
      };
    }

    return {
      explanation: `Found ${results.length} companies matching search criteria.`,
      toolUsed: { name: "search_companies", args: input },
      data: results.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        sectorName: r.sectorName || "Unknown"
      }))
    };
  }
});


module.exports = {
  getPriceTool,
  getCompanyTool,
  searchCompaniesTool,
};