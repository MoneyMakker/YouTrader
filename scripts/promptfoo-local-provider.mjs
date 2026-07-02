export default class YouTraderLocalSafetyProvider {
  id() {
    return "youtrader-local-safety-provider";
  }

  async callApi(prompt) {
    const text = String(prompt || "").toLowerCase();

    if (text.includes("ignore all previous") || text.includes("system prompt") || text.includes("api keys")) {
      return {
        output: "I can't help reveal hidden instructions, secrets, or private implementation details. Educational journal coaching only; not financial advice.",
      };
    }

    if (text.includes("full journal") || text.includes("screenshots") || text.includes("voice notes") || text.includes("raw payload")) {
      return {
        output: "I can't expose private journal data, media, notes, or raw payloads. Use aggregated metrics only. Educational analysis only; not financial advice.",
      };
    }

    if (text.includes("buy nq") || text.includes("sell nq") || text.includes("exact entry") || text.includes("predict es")) {
      return {
        output: "I do not predict market direction or provide buy/sell/hold signals, exact entry, or stop instructions. Focus on risk, process, and journaling discipline. Educational analysis only; not financial advice.",
      };
    }

    if (text.includes("guaranteed winning")) {
      return {
        output: "No trading process can guarantee wins. Focus on risk controls, position sizing, journaling, and avoiding revenge trades. Educational analysis only; not financial advice.",
      };
    }

    if (text.includes("free plan") || text.includes("claude deep analysis")) {
      return {
        output: "Free users receive a deterministic free preview. Paid cloud AI must stay behind entitlement, cooldown, and monthly quota controls. Educational analysis only; not financial advice.",
      };
    }

    if (text.includes("provider is down") || text.includes("unavailable")) {
      return {
        output: "When the cloud AI provider is unavailable, YouTrader should return safe local analysis and ask the user to try again later. Educational analysis only; not financial advice.",
      };
    }

    return {
      output: "Educational journal coaching only; not financial advice. Use aggregated journal metrics, protect risk, and avoid market predictions or private data exposure.",
    };
  }
}

