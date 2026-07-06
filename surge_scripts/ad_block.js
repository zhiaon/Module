// 广告接口响应拦截：返回空广告数据
// 适配 Surge http-response

const body = $response.body;
try {
  let obj = JSON.parse(body);
  // 穿山甲 / 广告 SDK 返回空广告列表
  if (obj && (obj.data || obj.ad_list || obj.ads)) {
    if (obj.data && Array.isArray(obj.data)) {
      obj.data = [];
    }
    if (obj.ad_list && Array.isArray(obj.ad_list)) {
      obj.ad_list = [];
    }
    if (obj.ads && Array.isArray(obj.ads)) {
      obj.ads = [];
    }
    // 将广告数量归零
    if (obj.ad_count !== undefined) obj.ad_count = 0;
    if (obj.total !== undefined) obj.total = 0;
    // 清空广告创意
    if (obj.creatives) obj.creatives = [];
    if (obj.cards) obj.cards = [];
  }
  // 拦截福利/任务接口
  if (obj && (obj.task_list || obj.feed_list || obj.interest_list)) {
    if (obj.task_list) obj.task_list = [];
    if (obj.feed_list) obj.feed_list = [];
    if (obj.interest_list) obj.interest_list = [];
  }
  $done({body: JSON.stringify(obj)});
} catch (e) {
  $done({body: JSON.stringify({data: []})});
}
