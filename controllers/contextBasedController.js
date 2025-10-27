const { Agent, run } = require("@openai/agents");
const { z } = require("zod");
const {
  getPriceTool,
  getCompanyTool,
  searchCompaniesTool,
} = require("../tools/stockTools.js");
const sessionStore = require("../db/store.js");


const OutputSchema = z.object({
  explanation: z.string(),
  toolUsed: z
    .object({
      name: z.string(),
      args: z.record(z.any()),
    })
    .nullable(),
  data: z.any().nullable(),
});

const QuestionSchema = z.string()
                        .trim()
                        .min(1, "Question cannot be empty")
                        .max(300, "Question must be under 300 characters")
                        .refine((q) => q.split(/\s+/).length >= 2, {message: "Question must contain at least 2 words"})
                        .refine((q) => !/(.)\1{10,}/.test(q), {message: "Invalid question format"});


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

function buildConversationContext(sessionId, userText, limit = 10) {
  const messages = sessionStore.getRecentMessages(sessionId, limit); // oldest->newest
  const convo = messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  return convo + (convo ? "\n" : "") + `User: ${userText}`;
}

function containsPronoun(text) {
  return /\b(it|that|them|they|this|those|the stock|the company|the previous one|the last one)\b/i.test(
    text
  );
}

function extractSymbol(text) {
  if (!text) return null;
  const match = text.toUpperCase().match(/\b[A-Z]{2,20}\b/);
  return match ? match[0] : null;
}

function getOrCreateSession(sessionId) {
  let session = null;
  if (sessionId) {
    session = sessionStore.getSession(sessionId);
    if (!session) return null;
    if (sessionStore.sessionExpired(session)) {
      sessionStore.deleteSession(sessionId);
      session = sessionStore.createSession();
    }
  } else {
    session = sessionStore.createSession();
  }

  sessionStore.touchSession(session.id);
  return session;
}

function resolveAndUpdateSymbol(session, text) {
  let activeSymbol = extractSymbol(text);
  if (!activeSymbol && containsPronoun(text)) {
    activeSymbol = session.activeSymbol || null;
  }
  if (activeSymbol) {
    sessionStore.updateSessionFields(session.id, { activeSymbol });
    return sessionStore.getSession(session.id);
  }
  return session;
}

function parseAgentResult(result) {
  let output = result.finalOutput ?? result.output_text ?? null;
  if (!output) {
    return { explanation: "No output", toolUsed: null, data: null };
  }
  if (typeof output === "string") {
    try {
      output = JSON.parse(output);
    } catch (e) {
      return { explanation: String(output), toolUsed: null, data: null };
    }
  }
  return output;
}

function persistAssistantOutput(session, output) {

  sessionStore.addMessage(session.id, "assistant", JSON.stringify(output));

  const symbol = output?.toolUsed?.args?.symbol;
  if (symbol) {
    const symUp = String(symbol).toUpperCase();
    const current = sessionStore.getSession(session.id);
    const refs = current.referencedSymbols || [];
    if (!refs.includes(symUp)) refs.push(symUp);
    sessionStore.updateSessionFields(session.id, { activeSymbol: symUp, referencedSymbols: refs, lastOp: current.lastOp });
  }

  sessionStore.touchSession(session.id);
}


async function askContextBasedAgent(req, res) {
  try {
    let { question, sessionId } = req.body || {};
    try {
      question = QuestionSchema.parse(question);
    } catch (e) {
      return res.status(400).json({
        code: "INVALID_QUESTION",
        message: e.errors?.[0]?.message || "Invalid question"
      });
    }
    
    let session = getOrCreateSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found or expired" });
    }

    sessionStore.addMessage(session.id, "user", question);

    const updatedSession = resolveAndUpdateSymbol(session, question);

    const context = buildConversationContext(updatedSession.id, question, 20);
    let result;
    try {
       result = await run(stockAgent, context);
    } catch (err) {
      console.error("Agent run error:", err);
      return res.status(503).json({ code: "LLM_UNAVAILABLE", message: "AI service temporarily unavailable" });
    }

    const output = parseAgentResult(result);

    persistAssistantOutput(updatedSession, output);

    return res.json({ sessionId: updatedSession.id, output });
  } catch (err) {
    console.error("askToolBasedAgent error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

module.exports = { askContextBasedAgent };
