const { Agent, run } = require("@openai/agents");
const { z } = require("zod");
const {
  getPriceTool,
  getCompanyTool,
  searchCompaniesTool,
} = require("../tools/stockTools.js");


const OutputSchema = z.object({
  explanation: z.string(),
  toolUsed: z
    .object({
      name: z.string(),
      args: z.record(z.any())
    })
    .nullable(),
  data: z.any().nullable().optional()
});

 async function askToolBasedAgent(req, res) {
  try {
    const { question } = req.body;
    if (!question || question.length > 300) {
      return res.status(400).json({ error: "Question is required with token limit(300 characters)" });
    }

    const stockAgent = new Agent({
      name: "StockAgent",
      apiKey: process.env.OPENAI_API_KEY,
      instructions: `
        You are a financial assistant.
        
        RULES:
        - You MUST always return a JSON object strictly matching the OutputSchema.
        - The JSON must include: explanation, toolUsed, data.
        - For general finance/stock questions (not requiring a tool), return:
          { "explanation": "...", "toolUsed": null, "data": null }
        - For tool lookups, call the tool and include its output in explanation + data.
        - Never return plain text or markdown.
      `,
      tools: [getPriceTool, getCompanyTool, searchCompaniesTool],
      output_type: OutputSchema,
    });
    

    const result = await run(stockAgent, question);
    let answer = result.finalOutput;

    if (typeof answer === "string") {
      try {
        answer = JSON.parse(answer);
      } catch (e) {
        console.error("Failed to parse JSON:", e);
      }
    }

    return res.json(answer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}


module.exports = { askToolBasedAgent };