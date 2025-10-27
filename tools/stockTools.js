// tools/stockTools.js
const fs = require("fs");
const path = require("path");
const { tool } = require("@openai/agents");
const { z } = require("zod");

class NotFoundError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "NotFoundError";
    this.details = details;
  }
}

const PriceRecord = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nullable(),
  currency: z.string().optional().nullable(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sectorName: z.string().optional().nullable()
});

const dataPath = path.resolve("context", "tickers_with_price.json")
let rawData = [];
try {
  rawData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
} catch (err) {
  throw new Error(`Failed to load tickers_with_price.json: ${err.message}`);
}

const pricesData = rawData.map((r, idx) => {
  try {
    return PriceRecord.parse(r);
  } catch (e) {
    throw new Error(`Invalid record at index ${idx}: ${JSON.stringify(e.errors)}`);
  }
});

function findBySymbol(sym) {
  if (!sym) return null;
  const s = sym.toUpperCase();
  const rec = pricesData.find((r) => r.symbol.toUpperCase() === s);
  return rec || null;
}

// Tool: get_price   
const getPriceTool = tool({
  name: "get_price",
  description: "Return price data for a stock symbol (PSX).",
  parameters: z
    .object({
      symbol: z
        .string()
        .regex(/^[A-Z0-9]{1,10}$/)
        .describe("PSX ticker symbol (uppercase)")
    })
    .strict(),
  execute: async (input) => {
    const sym = String(input.symbol).toUpperCase();
    const rec = findBySymbol(sym);
    if (!rec) {
      throw new NotFoundError(`Symbol '${sym}' not found`, { symbol: sym });
    }
    if (rec.price === null || rec.price === undefined) {
      throw new NotFoundError(`Price data not available for '${sym}'`, { symbol: sym });
    }
    // Return plain data object
    return {
      symbol: rec.symbol,
      price: rec.price,
      currency: rec.currency || "PKR",
      asOf: rec.asOf || new Date().toISOString().slice(0, 10)
    };
  }
});


// Tool: get_company 
const getCompanyTool = tool({
  name: "get_company",
  description: "Return company details for a stock symbol.",
  parameters: z
    .object({
      symbol: z.string().regex(/^[A-Z0-9]{1,10}$/).describe("PSX ticker symbol")
    })
    .strict(),
  execute: async (input) => {
    const sym = String(input.symbol).toUpperCase();
    const rec = findBySymbol(sym);
    if (!rec) {
      throw new NotFoundError(`Symbol '${sym}' not found`, { symbol: sym });
    }
    return {
      symbol: rec.symbol,
      name: rec.name,
      sectorName: rec.sectorName || "Unknown"
    };
  }
});


// Tool: search_companies

const uniqueSectors = Array.from(
  new Set(pricesData.map((r) => (r.sectorName || "").toUpperCase()).filter(Boolean))
).sort();

let SectorEnum = null;
if (uniqueSectors.length > 0) {
  SectorEnum = z.enum(uniqueSectors);
}

const searchCompaniesParams = SectorEnum
  ? z.object({
      query: z.string().nullable().describe("Search by company name substring"),
      sector: SectorEnum.nullable().describe("Exact sector name (from dataset)")
    }).strict()
  : z.object({
      query: z.string().nullable().describe("Search by company name substring"),
      sector: z.string().nullable().describe("Sector name")
    }).strict();

const searchCompaniesTool = tool({
  name: "search_companies",
  description: "Search companies by (optional) name substring and/or sector.",
  parameters: searchCompaniesParams,
  execute: async (input) => {
    const query = input.query ? String(input.query).toLowerCase() : null;
    const sector = input.sector ? String(input.sector).toUpperCase() : null;

    let results = pricesData;
    if (query) {
      results = results.filter((r) => r.name.toLowerCase().includes(query));
    }
    if (sector) {
      results = results.filter((r) => (r.sectorName || "").toUpperCase() === sector);
    }

    return results.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      sectorName: r.sectorName || "Unknown"
    }));
  }
});

module.exports = {
  getPriceTool,
  getCompanyTool,
  searchCompaniesTool,
  NotFoundError,
  SectorEnum,
  uniqueSectors
};
