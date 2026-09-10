/**
 * analysis 模块内置文档数据（由本地服务 npm start 保存时自动写入）
 * 提交本文件 + assets/analysis/flowchart.* + assets/analysis/requirements/* 后，他人打开项目即可看到相同内容
 */
var DEFAULT_FLOWCHART = {
  "fileName": "",
  "fileType": "",
  "filePath": "",
  "savedAt": "",
  "cleared": true
};

var DEFAULT_REQUIREMENTS = {
  "html": "<div><span style=\"background-color: rgb(247, 233, 34); font-size: 24px;\">同比分析/环比分析都同一样调整。</span></div><div><br></div><div><br>推送目标：消息中心模块 -&gt; 待阅消息。</div><div>推送内容：将同比分析/环比分析超过阈值的数据推送上述目标位置。消息模版见下表</div><div><br></div><div><br></div><div>模块：同比分析/环比分析<br>催办业务：企业同步/环比分析超阈值<br>消息标题：【统计时间】<span style=\"font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;PingFang SC&quot;, &quot;Hiragino Sans GB&quot;, &quot;Microsoft YaHei&quot;, sans-serif;\">【企业名称】【指标】同比/环比超过阈值</span></div><div>消息内容：<span style=\"font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;PingFang SC&quot;, &quot;Hiragino Sans GB&quot;, &quot;Microsoft YaHei&quot;, sans-serif;\">【统计时间】</span><span style=\"font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;PingFang SC&quot;, &quot;Hiragino Sans GB&quot;, &quot;Microsoft YaHei&quot;, sans-serif;\">【企业名称】【</span>生产层级<span style=\"font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;PingFang SC&quot;, &quot;Hiragino Sans GB&quot;, &quot;Microsoft YaHei&quot;, sans-serif;\">】【</span>生产线<span style=\"font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, &quot;PingFang SC&quot;, &quot;Hiragino Sans GB&quot;, &quot;Microsoft YaHei&quot;, sans-serif;\">】【指标】同步/环比率为【同比】，超过设定阈值，请及时检查！</span></div>",
  "lineHeight": "",
  "savedAt": "2026-09-08 11:06:23",
  "attachments": []
};
