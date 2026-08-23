// AI 中转站余额面板 for Surge
// 模块传参：BaseURL / APIKey / SiteToken / Path / SitePath / QuotaPerUSD / Currency
// APIKey 查询 API Key 已用量；SiteToken 查询网站账户剩余余额。

const DEFAULTS = {
  baseURL: "",
  apiKey: "",
  siteToken: "",
  userId: "",
  path: "/api/usage/token/",
  sitePath: "/api/user/self",
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
cfg.sitePath = String(cfg.sitePath || DEFAULTS.sitePath);
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
    lines.push(`已用：${info.used !== undefined ? fmtMoney(info.used) : "-"}`);
  } else {
    lines.push(`已用：${info.used !== undefined ? fmtQuota(info.used) : "-"}`);
    if (info.requestCount !== undefined) lines.push(`请求：${info.requestCount}`);
  }

  lines.push(`更新：${new Date().toLocaleString()}`);
  return lines.join("\n");
}

function requestJSON(url, token, callback, extraHeaders = {}) {
  $httpClient.get({
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    timeout: 10000,
  }, (error, response, body) => {
    if (error) return callback(`请求失败：${error}`);
    const status = response ? response.status : 0;
    let json;
    try {
      json = JSON.parse(body || "{}");
    } catch (e) {
      if (status < 200 || status >= 300) return callback(`HTTP ${status}`);
      return callback("返回不是 JSON");
    }
    if (status < 200 || status >= 300) {
      const message = String(json.message || json.error || `HTTP ${status}`);
      return callback(message.slice(0, 160));
    }
    if (json && json.success === false) {
      return callback(String(json.message || json.error || "接口返回失败").slice(0, 160));
    }
    callback(null, json);
  });
}

function renderSiteBalance(json) {
  const data = json && (json.data || json.result || json);
  const quota = get(data, ["quota", "remain_quota", "remaining_quota", "balance", "credit"]);
  const user = get(data, ["username", "display_name", "name", "email"]);
  const lines = [];
  if (user) lines.push(`账号：${user}`);
  lines.push(`剩余：${quota !== undefined ? fmtQuota(quota) : "接口未返回余额"}`);
  return lines;
}

if (!cfg.baseURL || !cfg.apiKey || !cfg.siteToken || !cfg.userId) {
  finish("AI 中转站余额", "请填写 api_key、site_token 和 user_id；api_key 查已用，site_token + user_id 查网站剩余余额。", "#FF9500");
} else {
  const apiURL = cfg.baseURL + (cfg.path.startsWith("/") ? cfg.path : `/${cfg.path}`);
  const siteURL = cfg.baseURL + (cfg.sitePath.startsWith("/") ? cfg.sitePath : `/${cfg.sitePath}`);
  let usageText = "已用：查询中";
  let siteLines = ["剩余：查询中"];
  let usageDone = false;
  let siteDone = false;

  function finishWhenReady() {
    if (!usageDone || !siteDone) return;
    finish("AI 中转站余额", [usageText, ...siteLines, `更新：${new Date().toLocaleString()}`].join("\n"), "#34C759");
  }

  requestJSON(apiURL, cfg.apiKey, (error, json) => {
    usageText = error ? `已用：${error}` : render(normalize(json)).split("\n").find((line) => line.startsWith("已用：")) || "已用：接口未返回";
    usageDone = true;
    finishWhenReady();
  });

  requestJSON(siteURL, cfg.siteToken, (error, json) => {
    siteLines = error ? [`剩余：${error}`] : renderSiteBalance(json);
    siteDone = true;
    finishWhenReady();
  }, { "Pipio-User": cfg.userId });
}
