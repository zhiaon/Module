// 广告请求拦截：直接返回空体
// 适配 Surge http-request

$done({body: JSON.stringify({data: [], ad_count: 0})});
