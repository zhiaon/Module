// AI 中转站余额面板 for Surge
// 模块传参：BaseURL / APIKey / Path / QuotaPerUSD / Currency
// 默认兼容 One API / New API: GET /api/user/self

const DEFAULTS = {
  baseURL: "",
  apiKey: "",
  path: "/api/user/self",
  quotaPerUSD: 500000,
  currency: "$",
};

function parseArgument() {
  let raw = typeof $argument === "undefined" ? "" : String($argument || "");
  if (!raw) return { ...DEFAULTS };
  try {
    const obj = JSON.parse(raw);
    return { ...DEFAULTS, ...obj };
  } catch (_) {
    const obj = {};
    raw.split("&").forEach((part) => {
      const i = part.indexOf("=");
      if (i < 0) return;
      const k = decodeURIComponent(part.slice(0, i));
      const v = decodeURIComponent(part.slice(i + 1));
      obj[k] = v;
    });
    return { ...DEFAULTS, ...obj };
  }
}

const cfg = parseArgument();
cfg.baseURL = String(cfg.baseURL || "").replace(/\/$/, "");
cfg.path = String(cfg.path || DEFAULTS.path);
cfg.quotaPerUSD = Number(cfg.quotaPerUSD || DEFAULTS.quotaPerUSD);
cfg.currency = String(cfg.currency || DEFAULTS.currency);

function finish(title, content, color = "#1E90FF") {
  $done({
    title,
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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fmtMoney(v) {
  const n = num(v);
  if (n === undefined) return "-";
  return `${cfg.currency}${n.toFixed(4)}`;
}

function fmtQuota(v) {
  const n = num(v);
  if (n === undefined) return "-";
  if (!cfg.quotaPerUSD || cfg.quotaPerUSD <= 0) return String(n);
  return `${cfg.currency}${(n / cfg.quotaPerUSD).toFixed(4)} (${n})`;
}

function normalize(json) {
  const data = json && (json.data || json.result || json);

  // Pipio / One API token usage style: /api/usage/token/
  const usageAvailable = get(data, ["total_available"]);
  const usageUsed = get(data, ["total_used"]);
  const usageTotal = get(data, ["total_quota", "quota"]);
  if (usageAvailable !== undefined || usageUsed !== undefined || usageTotal !== undefined) {
    return {
      mode: "quota",
      user: get(data, ["name", "username", "email"]),
      quota: usageAvailable,
      used: usageUsed,
      total: usageTotal,
      unlimited: get(data, ["unlimited_quota"]),
    };
  }

  // OpenAI-compatible billing: /dashboard/billing/credit_grants
  const totalAvailable = get(data, ["credit_grants.total_available"]);
  const totalUsed = get(data, ["credit_grants.total_used"]);
  const totalGranted = get(data, ["credit_grants.total_granted"]);
  if (totalAvailable !== undefined || totalUsed !== undefined || totalGranted !== undefined) {
    return {
      mode: "money",
      available: totalAvailable,
      used: totalUsed,
      granted: totalGranted,
      user: get(data, ["username", "name", "email"]),
    };
  }

  // One API / New API user style
  return {
    mode: "quota",
    user: get(data, ["username", "display_name", "name", "email"]),
    group: get(data, ["group"]),
    quota: get(data, ["quota", "remain_quota", "remaining_quota", "balance", "credit"]),
    used: get(data, ["used_quota", "used", "total_used_quota"]),
    requestCount: get(data, ["request_count", "requestCount"]),
  };
}

function render(info) {
  const lines = [];
  if (info.user) lines.push(`账号：${info.user}`);
  if (info.group) lines.push(`分组：${info.group}`);

  if (info.mode === "money") {
    if (info.available !== undefined) lines.push(`余额：${fmtMoney(info.available)}`);
    if (info.used !== undefined) lines.push(`已用：${fmtMoney(info.used)}`);
    if (info.granted !== undefined) lines.push(`总额：${fmtMoney(info.granted)}`);
  } else {
    if (info.unlimited) lines.push("余额：无限额度");
    else if (info.quota !== undefined) lines.push(`余额：${fmtQuota(info.quota)}`);
    if (info.used !== undefined) lines.push(`已用：${fmtQuota(info.used)}`);
    if (info.total !== undefined) lines.push(`总额：${fmtQuota(info.total)}`);
    if (info.requestCount !== undefined) lines.push(`请求：${info.requestCount}`);
  }

  lines.push(`更新：${new Date().toLocaleString()}`);
  return lines.join("\n");
}

if (!cfg.baseURL || !cfg.apiKey) {
  finish("AI 中转站余额", "请在模块参数填写 BaseURL 和 APIKey/Token", "#FF9500");
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
    if (error) return finish("AI 中转站余额", `请求失败：${error}`, "#FF3B30");
    const status = response ? response.status : 0;
    if (status === 401) return finish("AI 中转站余额", "HTTP 401：API Key 无效或无权查询余额，请检查 base_url / api_key / path。", "#FF3B30");
    if (status < 200 || status >= 300) return finish("AI 中转站余额", `HTTP ${status}，请检查 BaseURL / Path / Token`, "#FF3B30");

    let json;
    try {
      json = JSON.parse(body || "{}");
    } catch (e) {
      return finish("AI 中转站余额", "返回不是 JSON，请检查接口地址", "#FF3B30");
    }

    if (json && json.success === false) {
      const message = String(json.message || json.error || "接口返回失败");
      return finish("AI 中转站余额", message.slice(0, 180), "#FF3B30");
    }

    const content = render(normalize(json));
    finish("AI 中转站余额", content, "#34C759");
  });
}
