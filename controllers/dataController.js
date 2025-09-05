const fs = require("fs");
const OpenAI = require("openai");

const dotenv = require("dotenv");
dotenv.config(); // Load .env file

// Load JSON once
const companies = JSON.parse(fs.readFileSync(__dirname + "/context/tickers.json", "utf-8"));
const jsonText = JSON.stringify(companies);

// Build system prompt
const systemPrompt = `
You are a stock assistant. Answer questions only using the provided dataset.
Here is the dataset:${jsonText}
With this context, you have to return the stock symbol for the company that the user is asking about.
Just return the symbol as a response.
`;

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST controller
async function askStock(req, res) {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const answer = response.choices[0].message.content;
    return res.json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

module.exports = { askStock };
