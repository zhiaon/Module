// AI 中转站 API Key 已用量面板 for Surge
// 默认兼容 pipio: GET /api/usage/token/

const DEFAULTS = {
  baseURL: "",
  apiKey: "",
  path: "/api/usage/token/",
  quotaPerUSD: 500000,
  currency: "$",
};

function parseArgument() {
  const raw = typeof $argument === "undefined" ? "" : String($argument || "");
  if (!raw) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) {
    const obj = {};
    raw.split("&").forEach((part) => {
      const i = part.indexOf("=");
      if (i < 0) return;
      obj[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1));
    });
    return { ...DEFAULTS, ...obj };
  }
}

const cfg = parseArgument();
cfg.baseURL = String(cfg.baseURL || "").replace(/\/$/, "");
cfg.path = String(cfg.path || DEFAULTS.path);
cfg.quotaPerUSD = Number(cfg.quotaPerUSD || DEFAULTS.quotaPerUSD);
cfg.currency = String(cfg.currency || DEFAULTS.currency);
if (cfg.apiKey === "sk-xxxx") cfg.apiKey = "";

function done(content, color = "#34C759") {
  $done({
    title: "AI 中转站余额",
    content,
    icon: "creditcard",
    "icon-color": color,
  });
}

function get(obj, paths) {
  for (const path of paths) {
    const val = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (val !== undefined && val !== null && val !== "") return val;
  }
}

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fmtQuota(v) {
  const n = number(v);
  if (n === undefined) return "-";
  if (!cfg.quotaPerUSD || cfg.quotaPerUSD <= 0) return String(n);
  return `${cfg.currency}${(n / cfg.quotaPerUSD).toFixed(4)}`;
}

function fmtMoney(v) {
  const n = number(v);
  return n === undefined ? "-" : `${cfg.currency}${n.toFixed(4)}`;
}

function render(json) {
  const data = json && (json.data || json.result || json);
  const name = get(data, ["name", "username", "display_name", "email"]);

  // pipio / One API token usage: response.data.total_used is quota units
  const quotaUsed = get(data, ["total_used", "used_quota", "used", "total_used_quota"]);
  if (quotaUsed !== undefined) {
    const lines = [];
    if (name) lines.push(`名称：${name}`);
    lines.push(`已用：${fmtQuota(quotaUsed)}`);
    lines.push(`更新：${new Date().toLocaleString()}`);
    return lines.join("\n");
  }

  // OpenAI-compatible billing object, if a provider returns direct money values
  const moneyUsed = get(data, ["credit_grants.total_used"]);
  if (moneyUsed !== undefined) {
    return [`已用：${fmtMoney(moneyUsed)}`, `更新：${new Date().toLocaleString()}`].join("\n");
  }

  return [`已用：接口未返回用量字段`, `更新：${new Date().toLocaleString()}`].join("\n");
}

if (!cfg.baseURL || !cfg.apiKey) {
  done("请填写 base_url 和 api_key。", "#FF9500");
} else {
  const url = cfg.baseURL + (cfg.path.startsWith("/") ? cfg.path : `/${cfg.path}`);
  $httpClient.get({
    url,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  }, (error, response, body) => {
    if (error) return done(`请求失败：${error}`, "#FF3B30");
    const status = response ? response.status : 0;
    let json;
    try {
      json = JSON.parse(body || "{}");
    } catch (e) {
      return done(status >= 200 && status < 300 ? "返回不是 JSON" : `HTTP ${status}`, "#FF3B30");
    }
    if (status < 200 || status >= 300 || json.success === false) {
      const message = String(json.message || json.error || `HTTP ${status}`);
      return done(message.slice(0, 160), "#FF3B30");
    }
    done(render(json));
  });
}
