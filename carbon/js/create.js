const ALL_INDICATORS = [
  { id: 'total', name: '碳排放总量', unit: 'tCO₂', logic: '目标值 = 碳排放总量' },
  { id: 'intensity', name: '碳排放强度', unit: 'tCO₂/t', logic: '目标值 = 碳排放总量 ÷ 产品产量' },
  { id: 'energy', name: '单位能耗碳排放', unit: 'tCO₂/tce', logic: '目标值 = 碳排放总量 ÷ 综合能耗' },
];

const USER_INDUSTRY = '钢铁行业'; // 演示值：实际取当前登录用户档案中的行业

function findAbateScheme(schemes, id) {
  return (schemes || []).find(function (s) { return s.id === id; }) || (schemes && schemes[0]) || null;
}

function abateEscape(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveAbateIndustryKey(industry) {
  var s = String(industry || '');
  if (/钢铁|钢厂|冶金/.test(s)) return 'steel';
  if (/水泥/.test(s)) return 'cement';
  if (/化工|石化|化学/.test(s)) return 'chemical';
  if (/电力|发电|热电/.test(s)) return 'power';
  if (/有色|电解铝|铝业/.test(s)) return 'nonferrous';
  return 'generic';
}

function formatAbateCutRange(range) {
  if (!range || !range.length) return '--';
  if (range[0] === range[1]) return range[0] + '%';
  return range[0] + '%–' + range[1] + '%';
}

function estimateAbateCutRanges(industry, monthly) {
  var yearly = {
    steel: { efficiency: [5, 8], energy: [10, 16], process: [12, 22] },
    cement: { efficiency: [4, 7], energy: [12, 20], process: [10, 18] },
    chemical: { efficiency: [5, 9], energy: [8, 15], process: [10, 20] },
    power: { efficiency: [3, 6], energy: [10, 18], process: [8, 15] },
    nonferrous: { efficiency: [4, 8], energy: [12, 22], process: [8, 16] },
    generic: { efficiency: [4, 8], energy: [8, 16], process: [10, 18] },
  };
  var table = yearly[resolveAbateIndustryKey(industry)] || yearly.generic;
  if (!monthly) return table;
  function scale(range) {
    var lo = Math.max(1, Math.round(range[0] * 0.35));
    var hi = Math.max(lo + 1, Math.round(range[1] * 0.4));
    return [lo, hi];
  }
  return {
    efficiency: scale(table.efficiency),
    energy: scale(table.energy),
    process: scale(table.process),
  };
}

function buildAbateIndustryMeasures(industry, monthly) {
  var key = resolveAbateIndustryKey(industry);
  var packs = {
    steel: {
      efficiency: [
        { process: '烧结工序', action: '厚料层与终点稳定操作', share: '优先实施', fitKeys: ['total', 'intensity', 'energy'],
          detail: '在现有装备上稳定料层、终点和水份，降低返矿率和固体燃耗。不改主工艺，适合作为当期能效底座。',
          steps: ['建立当班料层、终点温度、水份操作窗口。', '把返矿率、固体燃耗纳入班组对标。', monthly ? '结合当月检修做小步参数寻优。' : '按季度固化有效参数到作业指导书。'] },
        { process: '焦化/公辅', action: '干熄焦运行与余热回收', share: '优先实施', fitKeys: ['energy', 'total'],
          detail: '提高已有干熄焦和余热系统的可用率，减少湿熄、放散和无效减温减压，把二次能源收回来。',
          steps: ['统计非计划湿熄原因并压缩切换。', '检查锅炉、循环风机是否限制回收负荷。', monthly ? '当月盯干熄比和蒸汽回收是否在经济区间。' : '把查漏、保温和大修纳入年度能效计划。'] },
        { process: '能源系统', action: '风机水泵经济运行与避峰', share: '协同实施', fitKeys: ['energy', 'intensity'],
          detail: '主要耗电设备按经济曲线运行，高耗电工序在保障安全前提下避开高峰。',
          steps: ['梳理长期阀门节流和低效并联运行。', '制定大电机经济运行曲线。', monthly ? '按当月计划预排高耗电时段。' : '结合检修安排变频和管网保温。'] },
      ],
      energy: [
        { process: '炼钢工序', action: '转炉煤气回收替代外购能源', share: '优先实施', fitKeys: ['total', 'energy'],
          detail: '提高煤气回收浓度和时长，减少放散，用过程煤气替代部分外购燃料或电力。',
          steps: ['核对煤气柜位、回收阀组和热值仪。', '明确回收起止浓度并与用户负荷联动。', '把放散次数纳入日调度闭环。'] },
        { process: '电力结构', action: '绿电与余电替代部分网电', share: '协同实施', fitKeys: ['energy', 'intensity'],
          detail: '识别可平移负荷，与绿电时段、自发余电匹配，不追求一步到位。',
          steps: ['列出空分、轧线、大风机等可平移负荷。', '确认绿电/谷电窗口，形成用电日历。', '避免为了绿电比例牺牲保安电源。'] },
        { process: '炼铁燃料', action: '富氢/富煤气喷吹减碳燃料', share: '条件成熟后推进', fitKeys: ['total', 'energy'],
          detail: '用氢或富氢气体替代部分碳素燃料。气源、安全和炉况验证要求高，适合作为能源替代的学习与试点方向。',
          steps: ['摸清氢或焦炉煤气资源与管道安全。', '选择单座高炉做小流量试验。', monthly ? '月度内以课题跟踪为主。' : '把中试和投资估算写入年度技术路线。'] },
      ],
      process: [
        { process: '炉料结构', action: '提高球团矿入炉比例', share: '协同实施', fitKeys: ['total', 'intensity'],
          detail: '用球团替代部分烧结矿，降低烧结工序排放并改善高炉料柱。需原料、槽下和高炉协同。',
          steps: ['评估球团供应、碱度和粉末率。', '与高炉共同确定可接受比例区间。', monthly ? '当月只做小幅配比试验。' : '把球团比例列入年度原料结构计划。'] },
        { process: '铁钢比', action: '提高废钢比、优化铁钢比', share: '条件成熟后推进', fitKeys: ['total', 'intensity'],
          detail: '提高废钢比可减少铁水需求，从而降低前端长流程排放。受废钢质量、热平衡和组织约束。',
          steps: ['明确废钢分类、残余元素和供应。', '评估转炉热平衡与预热条件。', monthly ? '当月只安排试验炉次。' : '按年度设定废钢比分步区间。'] },
      ],
    },
    cement: {
      efficiency: [
        { process: '烧成系统', action: '降低熟料烧成热耗', share: '优先实施', fitKeys: ['energy', 'intensity', 'total'],
          detail: '稳定窑况、优化用风和篦冷机热回收，把熟料热耗做下来。水泥行业最直接的当期能效路径。',
          steps: ['建立窑速、头尾煤、二次风温的操作窗口。', '检查篦冷机漏风和热回收效率。', monthly ? '当月以参数寻优为主。' : '把耐火材料和冷却机问题纳入年度检修。'] },
        { process: '粉磨与风机', action: '粉磨电耗与风机变频运行', share: '协同实施', fitKeys: ['energy', 'intensity'],
          detail: '生料、水泥粉磨和窑尾风机是用电大户，经济运行和分级粉磨可稳定降低电耗。',
          steps: ['统计各磨机台时电耗并做对标。', '避免风机长期挡板节流。', monthly ? '按当月产量匹配开停机组合。' : '评估辊压机/立磨改造是否纳入年度。'] },
      ],
      energy: [
        { process: '燃料结构', action: '替代燃料（AFR）替代部分煤', share: '协同实施', fitKeys: ['total', 'energy'],
          detail: '在保证熟料质量和窑况前提下，提高生物质、废弃物等替代燃料比例。',
          steps: ['评估热值、氯、重金属和供应稳定性。', '明确入窑方式和燃烧位置。', monthly ? '当月小比例试验并跟踪结皮。' : '签订年度替代燃料供应协议。'] },
        { process: '电力结构', action: '余热发电与绿电替代网电', share: '优先实施', fitKeys: ['energy', 'intensity'],
          detail: '用窑头窑尾余热发电，并匹配绿电时段，降低外购电力隐含排放。',
          steps: ['检查余热锅炉是否受阻于漏风或积灰。', '把可调节磨机负荷与发电/绿电窗口匹配。', '避免影响窑系统稳定。'] },
      ],
      process: [
        { process: '产品结构', action: '降低熟料系数、提高混合材', share: '条件成熟后推进', fitKeys: ['total', 'intensity'],
          detail: '在满足标准的前提下提高混合材掺量、优化水泥品种结构，从产品侧降低单位排放。',
          steps: ['核对不同品种的熟料系数和质量窗口。', '评估混合材活性和供应。', monthly ? '当月按订单结构微调品种。' : '把低熟料产品作为年度结构方向。'] },
      ],
    },
    chemical: {
      efficiency: [
        { process: '蒸汽与换热', action: '蒸汽梯级利用和换热网络优化', share: '优先实施', fitKeys: ['energy', 'intensity'],
          detail: '减少高品质蒸汽降级使用，提高换热回收，是化工装置普遍适用的能效路径。',
          steps: ['梳理减温减压点和疏水放空。', '对重点换热器做温差和污垢检查。', monthly ? '当月消除明显的蒸汽浪费。' : '把换热网络改造列入年度。'] },
        { process: '机泵系统', action: '机泵经济运行与泄漏治理', share: '协同实施', fitKeys: ['energy', 'total'],
          detail: '大机泵变频/切轮和经济运行，加上物料泄漏治理，能同时改善能耗和逸散排放。',
          steps: ['识别长期回流、旁路全开的机泵。', '建立泄漏巡检和修复闭环。', monthly ? '当月先处理高频泄漏点。' : '评估机泵改造清单。'] },
      ],
      energy: [
        { process: '燃料与电力', action: '燃料替代与绿电直购', share: '协同实施', fitKeys: ['energy', 'total'],
          detail: '锅炉和加热炉燃料低碳化，用电侧匹配绿电，降低单位能耗碳排放。',
          steps: ['评估天然气/氢气/生物质替代可行性。', '识别可平移的电解、压缩负荷。', '与绿电时段做生产日历匹配。'] },
      ],
      process: [
        { process: '工艺路线', action: '原料路线与产品结构优化', share: '条件成熟后推进', fitKeys: ['total', 'intensity'],
          detail: '高耗能产品降负荷、提高高附加值低排放产品占比，或评估更低碳的合成路线。',
          steps: ['识别排放强度最高的产品和装置。', '评估切换原料或工艺的质量与安全约束。', monthly ? '当月以排产结构优化为主。' : '把路线改造作为中长期课题。'] },
      ],
    },
    power: {
      efficiency: [
        { process: '主机运行', action: '降低供电煤耗/热耗', share: '优先实施', fitKeys: ['energy', 'intensity', 'total'],
          detail: '优化运行参数、减少空预器和凝汽器端差，把已有机组效率发挥出来。',
          steps: ['盯主汽温度、真空、辅机电耗对标。', '治理漏风、泄漏和长期低效工况。', monthly ? '按当月负荷曲线优化运行方式。' : '把通流和辅机改造纳入年度。'] },
      ],
      energy: [
        { process: '燃料结构', action: '生物质/耦合掺烧与绿电替代', share: '协同实施', fitKeys: ['total', 'energy'],
          detail: '在锅炉安全允许范围内提高低碳燃料掺烧，同时优化厂用电和绿电使用。',
          steps: ['评估掺烧对结渣、腐蚀和出力的影响。', '厂用电负荷与绿电窗口匹配。', monthly ? '当月控制掺烧比例试验。' : '形成年度燃料结构方案。'] },
      ],
      process: [
        { process: '机组结构', action: '热电联产与机组结构优化', share: '条件成熟后推进', fitKeys: ['total', 'intensity'],
          detail: '提高供热占比、优化开停机组合，从机组结构上降低供电排放强度。',
          steps: ['评估供热需求和抽凝运行经济性。', '高耗能机组优先作为调峰而非基荷。', monthly ? '当月优化开停机顺序。' : '把机组定位写入年度运行策略。'] },
      ],
    },
    nonferrous: {
      efficiency: [
        { process: '电解/熔铸', action: '降低直流电耗和炉窑热损失', share: '优先实施', fitKeys: ['energy', 'intensity'],
          detail: '电解槽或熔铸炉的电耗、炉况和保温是有色行业最直接的能效抓手。',
          steps: ['建立槽电压/炉温操作窗口。', '治理漏电、漏风和无效加热。', monthly ? '当月做参数对标。' : '把槽大修和保温列入年度。'] },
      ],
      energy: [
        { process: '电力结构', action: '绿电匹配高负荷用电', share: '优先实施', fitKeys: ['energy', 'total'],
          detail: '电解等负荷稳定、电量大，绿电替代对单位能耗碳排放影响显著。',
          steps: ['识别可调节与不可调节负荷。', '与绿电曲线做生产匹配。', '评估直购电和自发绿电空间。'] },
      ],
      process: [
        { process: '工艺流程', action: '提高循环物料、优化工艺路线', share: '协同实施', fitKeys: ['total', 'intensity'],
          detail: '提高废杂金属或中间循环物料比例，减少一次资源加工排放。',
          steps: ['评估废料质量和杂质控制。', '明确可接受的配入比例。', monthly ? '当月小比例试验。' : '把循环比例写入年度工艺方针。'] },
      ],
    },
    generic: {
      efficiency: [
        { process: '用能系统', action: '系统经济运行与余热回收', share: '优先实施', fitKeys: ['energy', 'intensity', 'total'],
          detail: '先把现有锅炉、电机、蒸汽和冷却系统跑经济，回收可回收的余热余能。这是多数行业都适用的当期路径。',
          steps: ['识别长期低效运行和明显放空。', '建立主要用能设备经济运行曲线。', monthly ? '当月先消除可马上改的浪费。' : '把系统优化列入年度能效计划。'] },
        { process: '设备与计量', action: '计量完善与泄漏治理', share: '协同实施', fitKeys: ['energy', 'total'],
          detail: '计量不准和跑冒滴漏会同时抬高能耗和排放，属于低成本通用措施。',
          steps: ['核对重点表计是否可用。', '建立泄漏巡检清单。', '把异常用能纳入班组闭环。'] },
      ],
      energy: [
        { process: '能源结构', action: '绿电与低碳燃料替代', share: '协同实施', fitKeys: ['energy', 'total'],
          detail: '在保障生产连续的前提下，用绿电、余电或更低碳燃料替代高碳能源。',
          steps: ['识别可平移的用电和用热负荷。', '评估燃料替代对质量和安全的影响。', monthly ? '当月匹配已有绿电/谷电窗口。' : '形成年度能源采购与替代计划。'] },
      ],
      process: [
        { process: '生产结构', action: '原料、工艺或产品结构优化', share: '条件成熟后推进', fitKeys: ['total', 'intensity'],
          detail: '通过原料替代、工艺路线调整或产品结构变化降低单位产品排放，需结合质量、成本和市场评估。',
          steps: ['识别排放强度最高的工序或产品。', '评估结构切换的约束条件。', monthly ? '当月以排产结构优化为主。' : '把结构优化作为中长期课题。'] },
      ],
    },
  };
  return packs[key] || packs.generic;
}

function buildAbateSchemes(ctx) {
  var monthly = ctx.dimension === '月度';
  var horizon = monthly
    ? (ctx.year + '年' + (ctx.month ? ctx.month + '月' : '') + '月度窗口')
    : (ctx.year + '年度周期');
  var indNames = (ctx.indicators || []).map(function (i) { return i.name; }).join('、') || '未选择指标';
  var timeTip = monthly
    ? '当前为月度目标，措施表述侧重当期可执行的运行与调度；需要改造的内容只作为对照，不要求本月开工。'
    : '当前为年度目标，措施可按年内节奏安排：能效打底，能源替代做结构，工艺调整作为条件评估项。';
  var measures = buildAbateIndustryMeasures(ctx.industry, monthly);
  var cutRanges = estimateAbateCutRanges(ctx.industry, monthly);

  function fitText(keys) {
    var set = {};
    (ctx.indicators || []).forEach(function (i) { set[i.id] = true; });
    var hits = (keys || []).filter(function (k) { return set[k]; });
    if (!hits.length) return '可作为' + (ctx.industry || '本行业') + '通用减排动作，供编制' + indNames + '时对照学习。';
    var names = hits.map(function (k) {
      if (k === 'total') return '碳排放总量';
      if (k === 'intensity') return '碳排放强度';
      if (k === 'energy') return '单位能耗碳排放';
      return k;
    });
    return '与本次所选「' + names.join('、') + '」直接相关，可作为目标分解时的措施对照。';
  }

  function withFit(list) {
    return (list || []).map(function (p) {
      var item = Object.assign({}, p);
      item.fit = fitText(p.fitKeys);
      return item;
    });
  }

  return [
    {
      id: 'efficiency',
      name: '能效提升',
      index: '01',
      tags: ['当期可做', '低投入'],
      hint: '把现有用能做少、做精，不先改工艺路线',
      cutText: formatAbateCutRange(cutRanges.efficiency),
      intro: '面向' + (ctx.industry || '本行业') + '、' + horizon + '。能效提升是各行业通用的第一类路径：先消除运行浪费、把余热余能收回来。该类预计降碳 ' + formatAbateCutRange(cutRanges.efficiency) + '。' + timeTip + '本次对照指标：' + indNames + '。',
      paths: withFit(measures.efficiency),
    },
    {
      id: 'energy',
      name: '能源替代',
      index: '02',
      tags: ['周期内可安排', '需资源匹配'],
      hint: '用更低碳的电、热、燃料，替换现有高碳能源',
      cutText: formatAbateCutRange(cutRanges.energy),
      intro: '面向' + (ctx.industry || '本行业') + '、' + horizon + '。能源替代看的是“用什么能”，而不是先改产品结构。绿电、二次能源回收、燃料替代都属于这一类。该类预计降碳 ' + formatAbateCutRange(cutRanges.energy) + '。' + timeTip + '本次对照指标：' + indNames + '。',
      paths: withFit(measures.energy),
    },
    {
      id: 'process',
      name: '工艺与结构',
      index: '03',
      tags: ['中长期', '需条件评估'],
      hint: '调整原料、工艺路线或产品结构，属于更深一层的减排',
      cutText: formatAbateCutRange(cutRanges.process),
      intro: '面向' + (ctx.industry || '本行业') + '、' + horizon + '。工艺与结构是各行业都有、但内容不同的一类路径：钢铁可能是铁钢比，水泥可能是熟料系数，化工可能是原料路线。适合作为学习与条件评估，而不是当期必选项。该类预计降碳 ' + formatAbateCutRange(cutRanges.process) + '。' + timeTip + '本次对照指标：' + indNames + '。',
      paths: withFit(measures.process),
    },
  ];
}

function renderAbatePathCards(scheme) {
  if (!scheme) return '';
  return '<div class="abate-paths-title">建议路径</div>'
    + scheme.paths.map(function (p, idx) {
      var no = idx + 1 < 10 ? '0' + (idx + 1) : String(idx + 1);
      var steps = (p.steps || []).map(function (s) { return '<li>' + abateEscape(s) + '</li>'; }).join('');
      return '<article class="abate-path-card">'
        + '<div class="abate-path-index">' + no + '</div>'
        + '<div class="abate-path-head">'
        + '<span class="abate-path-process">' + abateEscape(p.process) + '</span>'
        + '<strong>' + abateEscape(p.action) + '</strong>'
        + '<span class="abate-path-share">' + abateEscape(p.share) + '</span>'
        + '</div>'
        + '<p class="abate-path-detail">' + abateEscape(p.detail) + '</p>'
        + (steps ? '<div class="abate-path-step-label">实施要点</div><ul class="abate-path-steps">' + steps + '</ul>' : '')
        + '<div class="abate-path-fit">' + abateEscape(p.fit) + '</div>'
        + '</article>';
    }).join('');
}

function buildAbateReportHtml(ctx, schemes) {
  var period = ctx.year + '年' + (ctx.dimension === '月度' && ctx.month ? ctx.month + '月' : '');
  var indNames = (ctx.indicators || []).map(function (i) { return i.name; }).join('、') || '未选择';
  var generatedAt = nowText();
  var sections = schemes.map(function (s) {
    var paths = s.paths.map(function (p, idx) {
      var steps = (p.steps || []).map(function (st) { return '<li>' + abateEscape(st) + '</li>'; }).join('');
      return '<div class="p">'
        + '<h3>' + (idx + 1) + '. ' + abateEscape(p.process) + ' · ' + abateEscape(p.action) + '</h3>'
        + '<div class="meta">' + abateEscape(p.share) + '</div>'
        + '<p>' + abateEscape(p.detail) + '</p>'
        + (steps ? '<ol>' + steps + '</ol>' : '')
        + '<p class="fit">' + abateEscape(p.fit) + '</p>'
        + '</div>';
    }).join('');
    return '<section>'
      + '<h2>' + abateEscape(s.index ? s.index + '  ' : '') + abateEscape(s.name)
      + (s.cutText ? '　预计降碳 ' + abateEscape(s.cutText) : '') + '</h2>'
      + (s.tags && s.tags.length ? '<div class="meta">' + abateEscape(s.tags.join(' · ')) + '</div>' : '')
      + '<p class="intro">' + abateEscape(s.intro) + '</p>'
      + paths
      + '</section>';
  }).join('');

  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8" />'
    + '<title>智能减排寻优方案报告-' + abateEscape(period) + '</title>'
    + '<style>'
    + 'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#303133;padding:32px 40px;line-height:1.7;}'
    + 'h1{font-size:22px;margin:0 0 8px;}'
    + '.sub{color:#909399;font-size:13px;margin-bottom:20px;}'
    + '.box{border:1px solid #e4e7ed;border-radius:6px;padding:12px 16px;margin-bottom:20px;}'
    + '.box div{margin:4px 0;font-size:13px;}'
    + 'h2{font-size:18px;border-left:3px solid #00a854;padding-left:8px;margin:28px 0 10px;}'
    + 'h3{font-size:14px;margin:16px 0 6px;}'
    + '.intro,.fit{font-size:13px;color:#606266;}'
    + '.meta{font-size:12px;color:#909399;}'
    + 'ol,ul{margin:6px 0 8px 20px;font-size:13px;}'
    + '.foot{margin-top:32px;font-size:12px;color:#909399;}'
    + '@page{margin:16mm;}'
    + '</style></head><body>'
    + '<h1>智能减排寻优方案报告</h1>'
    + '<div class="box">'
    + '<div>行业：' + abateEscape(ctx.industry) + '</div>'
    + '<div>时间维度：' + abateEscape(ctx.dimension || '--') + '</div>'
    + '<div>目标时间：' + abateEscape(period) + '</div>'
    + '<div>所选指标：' + abateEscape(indNames) + '</div>'
    + '<div>目标名称：' + abateEscape(ctx.name || '--') + '</div>'
    + '<div>生成时间：' + abateEscape(generatedAt) + '</div>'
    + '</div>'
    + sections
    + '<div class="foot">本报告依据用户行业与第一步目标设置生成，路径为建议性学习材料，实施前需结合现场工艺、安全和投资条件评估。</div>'
    + '</body></html>';
}

function roundNum(n, d) {
  var p = Math.pow(10, d || 0);
  return Math.round(n * p) / p;
}

function buildOrgNodes() {
  var enterprises = [
    { id: 'ent-a', name: 'A钢铁有限公司', scale: 1 },
    { id: 'ent-b', name: 'B钢铁有限公司', scale: 0.78 },
    { id: 'ent-c', name: 'C特种钢有限公司', scale: 0.42 },
  ];
  var processes = [
    { key: 'sinter', name: '烧结工序', line: '烧结产线', lines: 2, output: 427200, total: 188000, intensity: 0.44, energy: 0.52 },
    { key: 'coke', name: '焦化工序', line: '焦化产线', lines: 2, output: 210000, total: 79800, intensity: 0.38, energy: 0.41 },
    { key: 'iron', name: '炼铁工序', line: '高炉产线', lines: 2, output: 1299600, total: 2573200, intensity: 1.98, energy: 2.10 },
    { key: 'steel', name: '转炉炼钢工序', line: '转炉产线', lines: 2, output: 979200, total: 293760, intensity: 0.30, energy: 0.28 },
  ];
  var nodes = [];
  enterprises.forEach(function (ent) {
    var children = [];
    var eOut = 0;
    var eTotal = 0;
    var eInt = 0;
    var eEnergy = 0;
    var weight = 0;
    processes.forEach(function (p) {
      var output = Math.round(p.output * ent.scale);
      var total = Math.round(p.total * ent.scale);
      var pid = ent.id + '-' + p.key;
      eOut += output;
      eTotal += total;
      eInt += p.intensity * output;
      eEnergy += p.energy * output;
      weight += output;
      children.push({
        id: pid,
        parent: ent.id,
        name: p.name,
        level: 'process',
        output: output,
        pred: { total: total, intensity: p.intensity, energy: p.energy },
      });
      for (var i = 0; i < p.lines; i++) {
        var share = i === 0 ? 0.52 : 0.48;
        children.push({
          id: pid + '-l' + (i + 1),
          parent: pid,
          name: (i + 1) + '#' + p.line,
          level: 'line',
          output: Math.round(output * share),
          pred: {
            total: Math.round(total * share),
            intensity: p.intensity,
            energy: p.energy,
          },
        });
      }
    });
    nodes.push({
      id: ent.id,
      parent: null,
      name: ent.name,
      level: 'enterprise',
      output: eOut,
      pred: {
        total: eTotal,
        intensity: roundNum(weight ? eInt / weight : 0, 2),
        energy: roundNum(weight ? eEnergy / weight : 0, 2),
      },
    });
    nodes = nodes.concat(children);
  });
  return nodes;
}

const ORG_NODES = buildOrgNodes();

// 碳目标分解：各企业独立分解，demo 仅展示 A钢铁有限公司 及其工序、产线
function buildDecomposeOrgNodes(rootId) {
  var ids = {};
  function addDescendants(id) {
    ids[id] = true;
    ORG_NODES.forEach(function (n) {
      if (n.parent === id) addDescendants(n.id);
    });
  }
  addDescendants(rootId);
  return ORG_NODES.filter(function (n) { return ids[n.id]; });
}

const DECOMPOSE_ORG_NODES = buildDecomposeOrgNodes('ent-a');

function findDecomposeOrgNode(id) {
  return DECOMPOSE_ORG_NODES.find(function (n) { return n.id === id; });
}

function decomposeNodeSerial(node) {
  var parts = [];
  var cur = node;
  while (cur) {
    var siblings = DECOMPOSE_ORG_NODES.filter(function (n) { return n.parent === cur.parent; });
    parts.unshift(siblings.findIndex(function (n) { return n.id === cur.id; }) + 1);
    cur = cur.parent ? findDecomposeOrgNode(cur.parent) : null;
  }
  return parts.join('.');
}

function decomposeIsHidden(node, collapsed) {
  var cur = node;
  while (cur && cur.parent) {
    if (collapsed[cur.parent]) return true;
    cur = findDecomposeOrgNode(cur.parent);
  }
  return false;
}

function formatNum(n) {
  if (n == null || n === '' || n === '--') return '';
  var num = Number(n);
  if (isNaN(num)) return String(n);
  if (Number.isInteger(num)) return num.toLocaleString('zh-CN');
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dashOrNum(n) {
  var text = formatNum(n);
  return text === '' ? '--' : text;
}

function findOrgNode(id) {
  return ORG_NODES.find(function (n) { return n.id === id; });
}

function orgNodeSerial(node) {
  var parts = [];
  var cur = node;
  while (cur) {
    var siblings = ORG_NODES.filter(function (n) { return n.parent === cur.parent; });
    parts.unshift(siblings.findIndex(function (n) { return n.id === cur.id; }) + 1);
    cur = cur.parent ? findOrgNode(cur.parent) : null;
  }
  return parts.join('.');
}

function orgIndentClass(level) {
  if (level === 'process') return ' indent-1';
  if (level === 'line') return ' indent-2';
  return '';
}

function orgIsHidden(node, collapsed) {
  var cur = node;
  while (cur && cur.parent) {
    if (collapsed[cur.parent]) return true;
    cur = findOrgNode(cur.parent);
  }
  return false;
}

function xmlEscape(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orgTemplateEnterpriseName(node) {
  var cur = node;
  while (cur && cur.level !== 'enterprise') {
    cur = cur.parent ? findOrgNode(cur.parent) : null;
  }
  return cur ? cur.name : (node && node.name ? node.name : '');
}

function orgTemplateProcessName(node) {
  if (!node || node.level === 'enterprise') return '';
  if (node.level === 'process') return node.name || '';
  var parent = node.parent ? findOrgNode(node.parent) : null;
  return parent && parent.level === 'process' ? (parent.name || '') : '';
}

function orgTemplateLineName(node) {
  if (!node || node.level !== 'line') return '';
  return node.name || '';
}

function forecastTypeFromDimension(dimension) {
  return dimension === '月度' ? '月' : '年';
}

function buildPlanTemplateXml(year, forecastType) {
  var headers = ['企业名称', '工序名称', '产线名称', '年份', '产品产量', '预测类型'];
  var headerCells = headers.map(function (h) {
    return '<Cell ss:StyleID="Header"><Data ss:Type="String">' + xmlEscape(h) + '</Data></Cell>';
  }).join('');

  var bodyRows = ORG_NODES.map(function (node) {
    var cells = [
      orgTemplateEnterpriseName(node),
      orgTemplateProcessName(node),
      orgTemplateLineName(node),
      year,
      '',
      forecastType,
    ].map(function (val, idx) {
      var type = idx === 3 && val !== '' ? 'Number' : 'String';
      return '<Cell><Data ss:Type="' + type + '">' + xmlEscape(val) + '</Data></Cell>';
    }).join('');
    return '<Row ss:Height="20">' + cells + '</Row>';
  }).join('');

  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<?mso-application progid="Excel.Sheet"?>'
    + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
    + ' xmlns:o="urn:schemas-microsoft-com:office:office"'
    + ' xmlns:x="urn:schemas-microsoft-com:office:excel"'
    + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
    + '<Styles>'
    + '<Style ss:ID="Header"><Font ss:Bold="1" ss:Size="11"/>'
    + '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>'
    + '<Interior ss:Color="#D9E2F3" ss:Pattern="Solid"/>'
    + '<Borders>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders></Style>'
    + '<Style ss:ID="Default"><Alignment ss:Vertical="Center"/>'
    + '<Borders>'
    + '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>'
    + '</Borders></Style>'
    + '</Styles>'
    + '<Worksheet ss:Name="生产计划模板">'
    + '<Table ss:DefaultRowHeight="18" ss:StyleID="Default">'
    + '<Column ss:Width="140"/>'
    + '<Column ss:Width="140"/>'
    + '<Column ss:Width="140"/>'
    + '<Column ss:Width="70"/>'
    + '<Column ss:Width="100"/>'
    + '<Column ss:Width="80"/>'
    + '<Row ss:Height="22">' + headerCells + '</Row>'
    + bodyRows
    + '</Table>'
    + '</Worksheet>'
    + '</Workbook>';
}

function downloadProductionPlanTemplate(year, dimension, month) {
  var forecastType = forecastTypeFromDimension(dimension);
  var xml = buildPlanTemplateXml(year, forecastType);
  var rangeLabel = dimension === '月度' && month
    ? year + '年' + month + '月'
    : year + '年';
  var filename = '生产计划模板_' + rangeLabel + '.xls';
  var blob = new Blob(['\uFEFF' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 800);
}

function selectedIndicatorsByIds(ids) {
  var list = ALL_INDICATORS.filter(function (i) { return (ids || []).indexOf(i.id) !== -1; });
  return list.length ? list : ALL_INDICATORS.slice();
}

function annualTargetFor(row, nodeId, indId) {
  var nodeVals = row.nodeValues && row.nodeValues[nodeId];
  if (nodeVals && nodeVals[indId] != null && nodeVals[indId] !== '') return nodeVals[indId];
  var node = findDecomposeOrgNode(nodeId) || findOrgNode(nodeId);
  if (node && node.pred && node.pred[indId] != null) return node.pred[indId];
  return '';
}

function avgDecimalsForInd(indId) {
  return indId === 'total' ? 2 : 4;
}

function formatIndTarget(indId, n) {
  if (n == null || n === '' || isNaN(n)) return '';
  return Number(n).toFixed(avgDecimalsForInd(indId));
}

function buildDemoNodeValues() {
  var values = {};
  ORG_NODES.forEach(function (node) {
    values[node.id] = {
      total: String(node.pred.total),
      intensity: String(node.pred.intensity),
      energy: String(node.pred.energy),
    };
  });
  return values;
}

function buildDemoDecomposeMonths(nodeValues) {
  var values = {};
  ORG_NODES.forEach(function (node) {
    values[node.id] = {};
    ALL_INDICATORS.forEach(function (ind) {
      var annual = parseFloat((nodeValues[node.id] && nodeValues[node.id][ind.id]) || node.pred[ind.id]) || 0;
      var avg = annual ? (annual / 12).toFixed(avgDecimalsForInd(ind.id)) : '';
      values[node.id][ind.id] = {
        months: Array.from({ length: 12 }, function () { return avg; }),
      };
    });
  });
  return values;
}

function monthStatusForDemo(targetYear, monthIndex) {
  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth();
  if (!targetYear) return 'future';
  if (targetYear < y) return 'past';
  if (targetYear > y) return 'future';
  return monthIndex < m ? 'past' : 'future';
}

function buildDemoDecomposeUpdateValues(row) {
  var indicators = selectedIndicatorsByIds(row.indicators);
  var targetYear = rangeYear(row.range) || new Date().getFullYear();
  var result = {};
  var pastActualFactors = [1.03, 0.97, 1.05, 0.96, 1.01, 0.99, 1.04, 0.97];
  var futureAdjustFactor = 0.92;

  DECOMPOSE_ORG_NODES.forEach(function (node) {
    result[node.id] = {};
    indicators.forEach(function (ind) {
      var annual = parseFloat(annualTargetFor(row, node.id, ind.id)) || 0;
      if (!annual) return;
      var decimals = avgDecimalsForInd(ind.id);
      var monthly = parseFloat((annual / 12).toFixed(decimals));
      var months = [];
      var actualMonths = Array(12).fill('');
      var adjustedMonths = [];

      for (var mi = 0; mi < 12; mi++) {
        months.push(monthly.toFixed(decimals));
        if (monthStatusForDemo(targetYear, mi) === 'past') {
          actualMonths[mi] = (monthly * pastActualFactors[mi % pastActualFactors.length]).toFixed(decimals);
          adjustedMonths.push(months[mi]);
        } else {
          adjustedMonths.push((monthly * futureAdjustFactor).toFixed(decimals));
        }
      }

      if (node.id === 'ent-a-coke' && ind.id === 'total') {
        var cokeTargets = [6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650];
        var cokeActuals = [6840, 6440, 6980, 6380, 6720, 6580, 6920, '', '', '', '', ''];
        var cokeAdjusted = ['6650.00', '6650.00', '6650.00', '6650.00', '6650.00', '6650.00', '6650.00', '6100.00', '6100.00', '6100.00', '6100.00', '6100.00'];
        for (var ci = 0; ci < 12; ci++) {
          months[ci] = cokeTargets[ci].toFixed(2);
          adjustedMonths[ci] = cokeAdjusted[ci];
          if (monthStatusForDemo(targetYear, ci) === 'past') {
            actualMonths[ci] = cokeActuals[ci];
          }
        }
      }

      result[node.id][ind.id] = {
        months: months,
        actualMonths: actualMonths,
        adjustedMonths: adjustedMonths,
      };
    });
  });
  return result;
}

function renderOrgTargetTable(tableEl, opts) {
  if (!tableEl) return;
  var inds = opts.indicators || [];
  var collapsed = opts.collapsed || {};
  var values = opts.values || {};
  var planImported = !!opts.planImported;
  var readonly = !!opts.readonly;

  var thead = '<thead><tr>'
    + '<th rowspan="2">序号</th>'
    + '<th rowspan="2" class="th-node">组织节点</th>'
    + '<th rowspan="2">产品产量 (t)</th>';
  inds.forEach(function (ind) {
    thead += '<th colspan="2">' + ind.name + ' (' + ind.unit + ')</th>';
  });
  thead += '</tr><tr>';
  inds.forEach(function () {
    thead += '<th>预测值</th><th>目标值</th>';
  });
  thead += '</tr></thead>';

  var body = '<tbody>';
  ORG_NODES.forEach(function (node) {
    if (orgIsHidden(node, collapsed)) return;
    var serial = orgNodeSerial(node);
    var hasChildren = ORG_NODES.some(function (n) { return n.parent === node.id; });
    var isCollapsed = !!collapsed[node.id];
    var toggle = hasChildren
      ? '<button type="button" class="node-toggle" data-toggle="' + node.id + '">' + (isCollapsed ? '+' : '−') + '</button>'
      : '<span class="node-toggle empty">·</span>';
    var saved = values[node.id] || {};
    var cells = '';
    inds.forEach(function (ind) {
      var pred = node.pred[ind.id];
      var val = '';
      if (saved[ind.id] != null && saved[ind.id] !== '') val = saved[ind.id];
      else if (planImported && pred != null && pred !== '--') val = pred;
      if (readonly) {
        cells += '<td class="pred-cell">' + (planImported ? dashOrNum(pred) : '--') + '</td>'
          + '<td class="num-cell">' + (val === '' ? '--' : dashOrNum(val)) + '</td>';
      } else {
        cells += '<td class="pred-cell">' + (planImported ? formatNum(pred) : '') + '</td>'
          + '<td><input class="target-input" data-node="' + node.id + '" data-ind="' + ind.id + '" placeholder="请输入目标值" value="' + (val === '' ? '' : val) + '" /></td>';
      }
    });
    var outputCell = readonly
      ? (planImported ? dashOrNum(node.output) : '--')
      : (planImported ? formatNum(node.output) : '');
    body += '<tr class="row-' + node.level + '">'
      + '<td>' + serial + '</td>'
      + '<td class="node-cell' + orgIndentClass(node.level) + '">' + toggle + node.name + '</td>'
      + '<td class="num-cell">' + outputCell + '</td>'
      + cells
      + '</tr>';
  });
  body += '</tbody>';
  tableEl.innerHTML = thead + body;
}

function getQuery(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function closeAllPopups() {
  document.querySelectorAll('.select-dropdown.show, .year-panel.show').forEach(function (el) {
    el.classList.remove('show');
  });
  document.querySelectorAll('.select-trigger.open, .year-trigger.open').forEach(function (el) {
    el.classList.remove('open');
  });
}

function initCreateWizard() {
  initLayout('create');

  var list = loadTargets();
  var editingId = getQuery('id') ? Number(getQuery('id')) : null;
  var isDetail = getQuery('mode') === 'detail';
  var isUpdate = getQuery('mode') === 'update';
  var existing = editingId ? list.find(function (x) { return x.id === editingId; }) : null;

  if ((isDetail || isUpdate) && !existing) {
    toast(isUpdate ? '未找到可更新的碳目标' : '未找到该碳目标');
    setTimeout(function () { location.href = 'index.html'; }, 800);
    return;
  }

  if (isDetail) document.body.classList.add('wizard-readonly');
  if (isUpdate) {
    document.getElementById('panel-step1').classList.add('wizard-readonly');
    if (!existing.updateHistory) existing.updateHistory = [];
  }
  var lockStep1 = isDetail || isUpdate;

  var state = {
    step: 1,
    name: existing ? existing.name : '',
    dimension: existing ? existing.dimension : '',
    year: existing ? rangeYear(existing.range) : '',
    month: existing && existing.dimension === '月度' && existing.range.match(/(\d{1,2})月/)
      ? Number(existing.range.match(/(\d{1,2})月/)[1]) : '',
    files: existing && existing.files ? existing.files.slice() : [],
    selected: existing && existing.indicators && existing.indicators.length
      ? existing.indicators.slice()
      : ALL_INDICATORS.map(function (i) { return i.id; }),
    draftSelected: null,
    collapsed: {},
    values: existing && existing.nodeValues ? JSON.parse(JSON.stringify(existing.nodeValues)) : {},
    decomposeValues: existing && existing.decomposeValues ? JSON.parse(JSON.stringify(existing.decomposeValues)) : {},
    activeInd: '',
    planImported: !!(existing && existing.planImported),
    decompose: existing
      ? (existing.dimension === '月度' ? false : existing.decompose !== false)
      : true,
  };

  if (existing && existing.demoScene) {
    if (!state.values || !Object.keys(state.values).length) {
      state.values = buildDemoNodeValues();
      state.planImported = true;
    }
    if (existing.demoScene === 'annual-self' && (!state.decomposeValues || !Object.keys(state.decomposeValues).length)) {
      state.decomposeValues = buildDemoDecomposeMonths(state.values);
    }
  }

  var nameInput = document.getElementById('target-name');
  nameInput.value = state.name;
  document.getElementById('name-count').textContent = state.name.length;

  function selectedIndicators() {
    return ALL_INDICATORS.filter(function (i) { return state.selected.indexOf(i.id) !== -1; });
  }

  function setFieldError(id, msg) {
    var field = document.getElementById('field-' + id);
    var err = document.getElementById('err-' + id);
    if (!field || !err) return;
    field.classList.toggle('has-error', !!msg);
    err.textContent = msg || '';
  }

  function syncTitle() {
    if (isDetail) {
      document.getElementById('wizard-title').textContent = '碳目标详情';
      document.title = '碳目标详情 · 碳目标管理';
      return;
    }
    if (isUpdate) {
      var y = state.year || '';
      var m = state.dimension === '月度' && state.month ? state.month + '月' : '';
      document.getElementById('wizard-title').textContent = (y ? y + '年' + m : '') + '碳目标更新';
      document.title = '碳目标更新 · 碳目标管理';
      return;
    }
    if (state.step === 2 && state.year) {
      document.getElementById('wizard-title').textContent = state.dimension === '月度' && state.month
        ? state.year + '年' + state.month + '月项目目标制定'
        : state.year + '年项目目标制定';
    } else {
      document.getElementById('wizard-title').textContent = '碳目标制定';
    }
  }

  function renderIndicators() {
    var tbody = document.getElementById('indicator-tbody');
    var rows = selectedIndicators();
    if (!rows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (row, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + row.name + '</td><td>' + row.unit + '</td><td class="logic-cell">' + (row.logic || '--') + '</td></tr>';
    }).join('');
  }

  function renderModalBody(tempSelected) {
    document.getElementById('indicator-modal-body').innerHTML = ALL_INDICATORS.map(function (row, i) {
      var checked = tempSelected.indexOf(row.id) !== -1 ? ' checked' : '';
      return '<tr>'
        + '<td><input type="checkbox" data-id="' + row.id + '"' + checked + ' /></td>'
        + '<td>' + (i + 1) + '</td>'
        + '<td>' + row.name + '</td>'
        + '<td>' + row.unit + '</td>'
        + '<td class="logic-cell">' + (row.logic || '--') + '</td>'
        + '</tr>';
    }).join('');
    document.getElementById('ind-check-all').checked = tempSelected.length === ALL_INDICATORS.length;
  }

  function isGroupMonthlyMode() {
    return state.dimension === '年度' && state.decompose === false;
  }

  function createAnnualFor(nodeId, indId) {
    var nodeVals = state.values[nodeId];
    if (nodeVals && nodeVals[indId] != null && nodeVals[indId] !== '') return nodeVals[indId];
    var node = findOrgNode(nodeId);
    if (node && node.pred && node.pred[indId] != null) return node.pred[indId];
    return '';
  }

  function ensureDecomposeNode(indId, nodeId) {
    if (!state.decomposeValues[nodeId]) state.decomposeValues[nodeId] = {};
    if (!state.decomposeValues[nodeId][indId]) {
      state.decomposeValues[nodeId][indId] = { months: ['', '', '', '', '', '', '', '', '', '', '', ''] };
    }
    if (!state.decomposeValues[nodeId][indId].months || state.decomposeValues[nodeId][indId].months.length !== 12) {
      state.decomposeValues[nodeId][indId].months = ['', '', '', '', '', '', '', '', '', '', '', ''];
    }
    return state.decomposeValues[nodeId][indId];
  }

  function renderCreateDecomposeTabs() {
    var indicators = selectedIndicators();
    document.getElementById('create-indicator-tabs').innerHTML = indicators.map(function (ind) {
      return '<button type="button" class="indicator-tab' + (state.activeInd === ind.id ? ' active' : '') + '" data-ind="' + ind.id + '">' + ind.name + '</button>';
    }).join('');
  }

  function renderGroupMonthlyTable() {
    var indId = state.activeInd;
    var table = document.getElementById('target-table');
    if (!indId) {
      table.innerHTML = '';
      return;
    }
    var showExtra = indId === 'total' || indId === 'intensity';
    var thead = '<thead><tr>'
      + '<th class="col-serial">序号</th>'
      + '<th class="col-node">组织节点名称</th>';
    if (showExtra) {
      thead += '<th class="col-output">产品产量</th>'
        + '<th class="col-pred">年度预测值</th>';
    }
    thead += '<th class="col-annual">年度目标值</th>';
    for (var m = 1; m <= 12; m++) thead += '<th class="col-month">' + m + '月</th>';
    thead += '<th class="col-op">操作</th></tr></thead>';

    function extraReadonlyCell(value) {
      var text = '';
      if (!state.planImported) text = isDetail ? '--' : '';
      else if (value == null || value === '' || value === '--') text = isDetail ? '--' : '';
      else text = isDetail ? dashOrNum(value) : formatNum(value);
      return '<td class="num-cell pred-cell">' + text + '</td>';
    }

    var body = '<tbody>';
    ORG_NODES.forEach(function (node) {
      if (orgIsHidden(node, state.collapsed)) return;
      var serial = orgNodeSerial(node);
      var hasChildren = ORG_NODES.some(function (n) { return n.parent === node.id; });
      var isCollapsed = !!state.collapsed[node.id];
      var toggle = hasChildren
        ? '<button type="button" class="node-toggle" data-toggle="' + node.id + '">' + (isCollapsed ? '+' : '−') + '</button>'
        : '<span class="node-toggle empty">·</span>';
      var cell = ensureDecomposeNode(indId, node.id);
      var savedAnnual = state.values[node.id] && state.values[node.id][indId];
      var annual = '';
      if (savedAnnual != null && savedAnnual !== '') annual = savedAnnual;
      else if (state.planImported && node.pred && node.pred[indId] != null) annual = String(node.pred[indId]);
      var annualCell = isDetail
        ? '<span class="num-cell annual-readonly">' + (annual === '' ? '--' : annual) + '</span>'
        : '<input class="target-input month-input" data-node="' + node.id + '" data-ind="' + indId + '" value="' + annual + '" placeholder="请输入" />';

      var extraCells = showExtra
        ? extraReadonlyCell(node.output) + extraReadonlyCell(node.pred && node.pred[indId])
        : '';

      var monthCells = '';
      for (var mi = 0; mi < 12; mi++) {
        var mv = cell.months[mi] || '';
        monthCells += isDetail
          ? '<td class="num-cell">' + (mv === '' ? '--' : mv) + '</td>'
          : '<td><input class="month-input" data-node="' + node.id + '" data-month="' + mi + '" value="' + mv + '" placeholder="请输入" /></td>';
      }

      body += '<tr class="row-' + node.level + '">'
        + '<td>' + serial + '</td>'
        + '<td class="node-cell' + orgIndentClass(node.level) + '">' + toggle + node.name + '</td>'
        + extraCells
        + '<td>' + annualCell + '</td>'
        + monthCells
        + '<td><button type="button" class="op-link" data-chart="' + node.id + '">查看图表</button></td>'
        + '</tr>';
    });
    body += '</tbody>';
    table.innerHTML = thead + body;
  }

  function syncStep2Layout() {
    var monthly = isGroupMonthlyMode();
    document.getElementById('step2-decompose-bar').classList.toggle('hidden', !monthly);
    document.getElementById('step2-table-wrap').classList.toggle('decompose-table-wrap', monthly);
    document.getElementById('target-table').classList.toggle('decompose-table', monthly);
    if (monthly) {
      var inds = selectedIndicators();
      if (!state.activeInd || state.selected.indexOf(state.activeInd) === -1) {
        state.activeInd = inds[0] ? inds[0].id : '';
      }
      if (isDetail) document.getElementById('btn-create-avg').classList.add('hidden');
    }
  }

  function renderTargetTable() {
    if (isGroupMonthlyMode()) {
      renderCreateDecomposeTabs();
      renderGroupMonthlyTable();
      return;
    }
    renderOrgTargetTable(document.getElementById('target-table'), {
      indicators: selectedIndicators(),
      collapsed: state.collapsed,
      values: state.values,
      planImported: state.planImported,
      readonly: isDetail,
    });
  }

  function showStep(step) {
    state.step = step;
    document.getElementById('panel-step1').classList.toggle('hidden', step !== 1);
    document.getElementById('panel-step2').classList.toggle('hidden', step !== 2);
    document.getElementById('footer-step1').classList.toggle('hidden', step !== 1);
    document.getElementById('footer-step2').classList.toggle('hidden', isUpdate || step !== 2);
    document.getElementById('footer-update').classList.toggle('hidden', !isUpdate || step !== 2);

    var s1 = document.getElementById('step-1-label');
    var s2 = document.getElementById('step-2-label');
    s1.classList.toggle('active', step === 1);
    s1.classList.toggle('done', step === 2);
    s2.classList.toggle('active', step === 2);
    document.getElementById('step-1-dot').textContent = step === 2 ? '✓' : '1';
    document.getElementById('step-2-dot').textContent = '2';
    syncTitle();
    if (step === 2) {
      syncStep2Layout();
      renderTargetTable();
    }
  }

  function collectDecomposeValues() {
    document.querySelectorAll('#target-table .month-input').forEach(function (input) {
      var nodeId = input.dataset.node;
      var cell = ensureDecomposeNode(state.activeInd, nodeId);
      if (input.dataset.month != null) cell.months[Number(input.dataset.month)] = input.value.trim();
    });
  }

  function collectNodeValues() {
    if (isGroupMonthlyMode()) collectDecomposeValues();
    document.querySelectorAll('.target-input').forEach(function (input) {
      var nodeId = input.dataset.node;
      var ind = input.dataset.ind;
      if (!state.values[nodeId]) state.values[nodeId] = {};
      state.values[nodeId][ind] = input.value.trim();
    });
  }

  function hasIndicator(id) {
    return state.selected.indexOf(id) !== -1;
  }

  function setNodeTarget(nodeId, indId, value) {
    if (!state.values[nodeId]) state.values[nodeId] = {};
    state.values[nodeId][indId] = value;
    var input = document.querySelector('.target-input[data-node="' + nodeId + '"][data-ind="' + indId + '"]');
    if (input) input.value = value;
  }

  function syncTotalIntensity(nodeId, changedInd, rawValue) {
    if (!hasIndicator('total') || !hasIndicator('intensity')) return;
    var node = findOrgNode(nodeId);
    var output = node && node.output ? Number(node.output) : 0;
    if (!output) return;
    var num = parseFloat(rawValue);
    if (rawValue === '' || isNaN(num)) return;
    if (changedInd === 'total') {
      setNodeTarget(nodeId, 'intensity', formatIndTarget('intensity', num / output));
    } else if (changedInd === 'intensity') {
      setNodeTarget(nodeId, 'total', formatIndTarget('total', num * output));
    }
  }

  function rangeText() {
    if (!state.year) return '';
    return state.year + '年' + (state.dimension === '月度' && state.month ? state.month + '月' : '');
  }

  function validateStep1() {
    var ok = true;
    if (!state.name.trim()) { setFieldError('name', '请输入目标名称'); ok = false; }
    else setFieldError('name', '');
    if (!state.dimension) { setFieldError('dimension', '请选择目标时间维度'); ok = false; }
    else setFieldError('dimension', '');
    if (!state.year) { setFieldError('year', '请选择目标年份'); ok = false; }
    else setFieldError('year', '');
    if (state.dimension === '月度' && !state.month) { setFieldError('month', '请选择目标月份'); ok = false; }
    else setFieldError('month', '');
    if (!state.selected.length) { toast('请至少配置一项指标'); ok = false; }
    return ok;
  }

  function persist(status) {
    collectNodeValues();
    var decompose = state.dimension === '月度' ? false : !!state.decompose;
    var payload = {
      name: state.name.trim(),
      dimension: state.dimension,
      range: rangeText(),
      status: status,
      updatedAt: nowText(),
      remark: existing && existing.remark ? existing.remark : '',
      indicators: state.selected.slice(),
      decompose: decompose,
      files: state.files.slice(),
      nodeValues: JSON.parse(JSON.stringify(state.values)),
      decomposeValues: JSON.parse(JSON.stringify(state.decomposeValues)),
      planImported: state.planImported,
    };
    if (isUpdate && existing && existing.status) payload.status = existing.status;
    if (existing && existing.updateHistory) payload.updateHistory = existing.updateHistory;
    if (existing && existing.demoScene) payload.demoScene = existing.demoScene;
    if (existing && existing.id) payload.id = existing.id;
    if (state.dimension === '年度' && decompose) {
      payload.decomposeStatus = (existing && existing.decomposeStatus) || 'wait';
      if (existing && existing.subordinates && existing.subordinates.length) {
        payload.subordinates = existing.subordinates;
      } else {
        payload.subordinates = buildSubordinatesForTarget(existing && existing.id ? existing.id : 0);
      }
    }
    if (status === 'pending' && existing && existing.status !== 'pending') {
      payload.submittedAt = nowText();
    } else if (status === 'pending' && !existing) {
      payload.submittedAt = nowText();
    } else if (existing && existing.submittedAt) {
      payload.submittedAt = existing.submittedAt;
    }
    if (existing) {
      Object.assign(existing, payload);
    } else {
      payload.id = list.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1;
      list.unshift(payload);
      existing = payload;
      editingId = payload.id;
      history.replaceState(null, '', 'create.html?id=' + editingId);
    }
    saveTargets(list);
  }

  function nextCreateUpdateVersion(history) {
    return 'V' + ((history || []).length + 1);
  }

  function valuesChanged(oldMap, newMap, nodeId, indId) {
    var oldVal = oldMap && oldMap[nodeId] ? oldMap[nodeId][indId] : '';
    var newVal = newMap && newMap[nodeId] ? newMap[nodeId][indId] : '';
    return String(oldVal == null ? '' : oldVal).trim() !== String(newVal == null ? '' : newVal).trim();
  }

  function monthsChanged(oldMap, newMap, nodeId, indId) {
    var oldMonths = oldMap && oldMap[nodeId] && oldMap[nodeId][indId] && oldMap[nodeId][indId].months
      ? oldMap[nodeId][indId].months : [];
    var newMonths = newMap && newMap[nodeId] && newMap[nodeId][indId] && newMap[nodeId][indId].months
      ? newMap[nodeId][indId].months : [];
    for (var i = 0; i < 12; i++) {
      if (String(oldMonths[i] || '').trim() !== String(newMonths[i] || '').trim()) return true;
    }
    return false;
  }

  function buildCreateChangeSummary(oldValues, newValues, oldDecompose, newDecompose) {
    var summaries = [];
    var inds = selectedIndicators();
    ORG_NODES.forEach(function (node) {
      var changed = inds.some(function (ind) {
        return valuesChanged(oldValues, newValues, node.id, ind.id)
          || monthsChanged(oldDecompose, newDecompose, node.id, ind.id);
      });
      if (changed) summaries.push('变更' + node.name + '的目标');
    });
    return summaries.length ? summaries.join('；') : '提交碳目标变更';
  }

  function renderCreateHistory() {
    var history = (existing && existing.updateHistory) || [];
    var body = document.getElementById('create-history-body');
    if (!history.length) {
      body.innerHTML = '<div class="update-history-empty">暂无更新记录</div>';
      return;
    }
    body.innerHTML = '<div class="update-timeline">'
      + history.map(function (item) {
        return '<div class="update-timeline-item">'
          + '<span class="update-timeline-dot"></span>'
          + '<div class="update-timeline-card">'
          + '<div class="update-timeline-head">'
          + '<div class="update-timeline-title">' + (item.summary || item.remark || '提交变更') + '</div>'
          + '<div class="update-timeline-time">' + item.time + '</div>'
          + '</div>'
          + '<div class="update-version-tag">版本：' + (item.version || '--') + '</div>'
          + '<div class="update-timeline-operator">操作人：' + item.operator + '</div>'
          + '</div>'
          + '</div>';
      }).join('')
      + '</div>';
  }

  function updateDimUI() {
    var text = document.getElementById('dim-text');
    if (state.dimension) {
      text.textContent = state.dimension;
      text.classList.remove('ph');
    } else {
      text.textContent = '请选择';
      text.classList.add('ph');
    }
    document.getElementById('field-month').classList.toggle('hidden', state.dimension !== '月度');
    syncDecomposeUI();
  }

  function updateYearUI() {
    var text = document.getElementById('year-text');
    if (state.year) {
      text.textContent = state.year + '年';
      text.classList.remove('ph');
    } else {
      text.textContent = '请选择';
      text.classList.add('ph');
    }
    document.querySelectorAll('#year-grid button').forEach(function (btn) {
      btn.classList.toggle('active', Number(btn.dataset.year) === Number(state.year));
    });
  }

  function updateMonthUI() {
    var text = document.getElementById('month-text');
    if (state.month) {
      text.textContent = state.month + '月';
      text.classList.remove('ph');
    } else {
      text.textContent = '请选择';
      text.classList.add('ph');
    }
  }

  function renderFiles() {
    var box = document.getElementById('file-list');
    if (!state.files.length) { box.innerHTML = ''; return; }
    box.innerHTML = state.files.map(function (f, i) {
      if (isDetail || isUpdate) return '<div class="file-item"><span>' + f.name + '</span></div>';
      return '<div class="file-item"><span>' + f.name + '</span><button type="button" data-file="' + i + '">删除</button></div>';
    }).join('');
  }

  var yearGrid = document.getElementById('year-grid');
  var yearsHtml = '';
  for (var y = 2020; y <= 2035; y++) {
    yearsHtml += '<button type="button" data-year="' + y + '">' + y + '</button>';
  }
  yearGrid.innerHTML = yearsHtml;

  var monthDrop = document.getElementById('month-dropdown');
  var monthsHtml = '';
  for (var m = 1; m <= 12; m++) {
    monthsHtml += '<div class="select-option" data-value="' + m + '">' + m + '月</div>';
  }
  monthDrop.innerHTML = monthsHtml;

  nameInput.addEventListener('input', function () {
    if (lockStep1) return;
    state.name = nameInput.value;
    document.getElementById('name-count').textContent = state.name.length;
    if (state.name.trim()) setFieldError('name', '');
  });

  document.getElementById('dim-trigger').addEventListener('click', function (e) {
    if (lockStep1) return;
    e.stopPropagation();
    var open = document.getElementById('dim-dropdown').classList.contains('show');
    closeAllPopups();
    if (!open) {
      document.getElementById('dim-dropdown').classList.add('show');
      document.getElementById('dim-trigger').classList.add('open');
    }
  });

  document.getElementById('dim-dropdown').addEventListener('click', function (e) {
    e.stopPropagation();
    var opt = e.target.closest('.select-option');
    if (!opt) return;
    state.dimension = opt.dataset.value;
    setFieldError('dimension', '');
    updateDimUI();
    closeAllPopups();
  });

  document.getElementById('year-trigger').addEventListener('click', function (e) {
    if (lockStep1) return;
    e.stopPropagation();
    var open = document.getElementById('year-panel').classList.contains('show');
    closeAllPopups();
    if (!open) {
      document.getElementById('year-panel').classList.add('show');
      document.getElementById('year-trigger').classList.add('open');
    }
  });

  yearGrid.addEventListener('click', function (e) {
    e.stopPropagation();
    var btn = e.target.closest('[data-year]');
    if (!btn) return;
    state.year = Number(btn.dataset.year);
    setFieldError('year', '');
    updateYearUI();
    closeAllPopups();
  });

  document.getElementById('month-trigger').addEventListener('click', function (e) {
    if (lockStep1) return;
    e.stopPropagation();
    var open = monthDrop.classList.contains('show');
    closeAllPopups();
    if (!open) {
      monthDrop.classList.add('show');
      document.getElementById('month-trigger').classList.add('open');
    }
  });

  monthDrop.addEventListener('click', function (e) {
    e.stopPropagation();
    var opt = e.target.closest('.select-option');
    if (!opt) return;
    state.month = Number(opt.dataset.value);
    setFieldError('month', '');
    updateMonthUI();
    closeAllPopups();
  });

  document.addEventListener('click', closeAllPopups);

  document.getElementById('btn-add-file').addEventListener('click', function () {
    if (lockStep1) return;
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', function () {
    if (lockStep1) return;
    var files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    files.forEach(function (file) {
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      if (['pdf', 'docx', 'xlsx', 'xls'].indexOf(ext) === -1) {
        toast('仅支持 pdf / docx / xlsx / xls');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast('单个文件不能超过 100MB');
        return;
      }
      if (state.files.length >= 5) {
        toast('最多上传五个文件');
        return;
      }
      state.files.push({ name: file.name, size: file.size });
    });
    renderFiles();
  });

  document.getElementById('file-list').addEventListener('click', function (e) {
    if (lockStep1) return;
    var btn = e.target.closest('[data-file]');
    if (!btn) return;
    state.files.splice(Number(btn.dataset.file), 1);
    renderFiles();
  });

  document.getElementById('btn-config').addEventListener('click', function () {
    if (lockStep1) return;
    state.draftSelected = state.selected.slice();
    renderModalBody(state.draftSelected);
    openModal('indicator-modal');
  });

  document.getElementById('indicator-modal-body').addEventListener('change', function (e) {
    var box = e.target.closest('input[type="checkbox"]');
    if (!box) return;
    var id = box.dataset.id;
    if (box.checked) {
      if (state.draftSelected.indexOf(id) === -1) state.draftSelected.push(id);
    } else {
      state.draftSelected = state.draftSelected.filter(function (x) { return x !== id; });
    }
    document.getElementById('ind-check-all').checked = state.draftSelected.length === ALL_INDICATORS.length;
  });

  document.getElementById('ind-check-all').addEventListener('change', function () {
    state.draftSelected = this.checked ? ALL_INDICATORS.map(function (i) { return i.id; }) : [];
    renderModalBody(state.draftSelected);
  });

  document.getElementById('btn-ind-ok').addEventListener('click', function () {
    if (!state.draftSelected.length) { toast('请至少选择一项指标'); return; }
    state.selected = state.draftSelected.slice();
    renderIndicators();
    closeModal('indicator-modal');
  });

  document.getElementById('btn-ind-cancel').addEventListener('click', function () { closeModal('indicator-modal'); });
  document.getElementById('btn-ind-close').addEventListener('click', function () { closeModal('indicator-modal'); });

  document.getElementById('btn-next').addEventListener('click', function () {
    if (!validateStep1()) return;
    showStep(2);
  });

  document.getElementById('btn-prev').addEventListener('click', function () {
    collectNodeValues();
    showStep(1);
  });

  document.getElementById('btn-save-1').addEventListener('click', function () {
    if (lockStep1) return;
    if (!state.name.trim()) { setFieldError('name', '请输入目标名称'); return; }
    persist('draft');
    toast('已保存草稿');
  });

  document.getElementById('btn-save-2').addEventListener('click', function () {
    if (isDetail || isUpdate) return;
    persist('draft');
    toast('已保存草稿');
  });

  document.getElementById('btn-submit').addEventListener('click', function () {
    if (isDetail || isUpdate) return;
    persist('pending');
    toast('已提交审核');
    setTimeout(function () { location.href = 'index.html'; }, 700);
  });

  function applyReadonlyUI() {
    if (!lockStep1) return;
    nameInput.readOnly = true;
    nameInput.placeholder = '';
    var hideIds = ['btn-save-1', 'btn-config', 'btn-add-file'];
    if (isDetail) hideIds = hideIds.concat(['btn-save-2', 'btn-submit', 'btn-tpl', 'btn-import', 'btn-create-avg', 'btn-abate']);
    if (isUpdate) hideIds = hideIds.concat(['btn-save-2', 'btn-submit']);
    hideIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.choice-option').forEach(function (btn) {
      btn.disabled = true;
    });
  }

  document.getElementById('btn-back').addEventListener('click', function () {
    location.href = 'index.html';
  });

  document.getElementById('btn-tpl').addEventListener('click', function () {
    if (!state.year) { toast('请先选择目标年份'); return; }
    downloadProductionPlanTemplate(state.year, state.dimension, state.month);
    toast('已开始下载生产计划模板');
  });
  document.getElementById('btn-import').addEventListener('click', function () {
    if (isDetail) return;
    collectNodeValues();
    state.planImported = true;
    ORG_NODES.forEach(function (node) {
      if (!state.values[node.id]) state.values[node.id] = {};
      ALL_INDICATORS.forEach(function (ind) {
        var pred = node.pred[ind.id];
        if (pred != null && pred !== '--') state.values[node.id][ind.id] = String(pred);
      });
    });
    renderTargetTable();
    toast('已解析导入生产计划');
  });
  document.getElementById('btn-export').addEventListener('click', function () { toast('已导出当前目标制定表'); });

  var abateSchemeId = 'efficiency';
  var abateSchemes = [];
  var abateCtx = null;

  function getAbateContext() {
    return {
      industry: USER_INDUSTRY,
      dimension: state.dimension,
      year: state.year,
      month: state.month,
      name: state.name,
      indicators: selectedIndicators(),
    };
  }

  function renderAbatePage() {
    var ctx = abateCtx || getAbateContext();
    var scheme = findAbateScheme(abateSchemes, abateSchemeId);
    var period = (ctx.year || '--') + '年' + (ctx.dimension === '月度' && ctx.month ? ctx.month + '月' : '');
    var indNames = (ctx.indicators || []).map(function (i) { return i.name; }).join('、') || '未选择';
    document.getElementById('abate-ctx').innerHTML = [
      { label: '用户所在行业', value: ctx.industry },
      { label: '时间维度', value: ctx.dimension || '--' },
      { label: '目标年份', value: period },
      { label: '所选指标', value: indNames },
    ].map(function (item) {
      return '<div class="abate-ctx-item"><div class="abate-ctx-label">' + abateEscape(item.label)
        + '</div><div class="abate-ctx-value">' + abateEscape(item.value) + '</div></div>';
    }).join('');

    document.getElementById('abate-schemes').innerHTML = abateSchemes.map(function (s) {
      var tags = (s.tags || []).map(function (t) { return '<span>' + abateEscape(t) + '</span>'; }).join('');
      return '<button type="button" class="abate-scheme' + (s.id === abateSchemeId ? ' active' : '') + '" data-scheme="' + s.id + '">'
        + '<div class="abate-scheme-index">' + abateEscape(s.index || '') + '</div>'
        + '<div class="abate-scheme-main">'
        + '<div class="abate-scheme-name">' + abateEscape(s.name) + '</div>'
        + (tags ? '<div class="abate-scheme-tags">' + tags + '</div>' : '')
        + '<div class="abate-scheme-hint">' + abateEscape(s.hint) + '</div>'
        + '</div>'
        + '<div class="abate-scheme-cut">'
        + '<div class="abate-scheme-cut-label">预计降碳</div>'
        + '<div class="abate-scheme-cut-value">' + abateEscape(s.cutText || '--') + '</div>'
        + '</div>'
        + '</button>';
    }).join('');

    document.getElementById('abate-scheme-intro').textContent = scheme ? scheme.intro : '';
    document.getElementById('abate-paths').innerHTML = renderAbatePathCards(scheme);
  }

  function openAbatePage() {
    abateCtx = getAbateContext();
    abateSchemes = buildAbateSchemes(abateCtx);
    abateSchemeId = abateCtx.dimension === '月度' ? 'efficiency' : 'energy';
    renderAbatePage();
    document.getElementById('abate-page').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeAbatePage() {
    document.getElementById('abate-page').classList.remove('show');
    document.body.style.overflow = '';
  }

  function downloadAbateReport() {
    if (!abateSchemes.length) {
      abateCtx = getAbateContext();
      abateSchemes = buildAbateSchemes(abateCtx);
    }
    var html = buildAbateReportHtml(abateCtx || getAbateContext(), abateSchemes);
    var iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;');
    document.body.appendChild(iframe);
    var doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(function () {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }, 250);
    toast('请在打印窗口中选择「存储为 PDF」完成下载');
  }

  document.getElementById('btn-abate').addEventListener('click', function () {
    if (isDetail) return;
    openAbatePage();
  });
  document.getElementById('abate-schemes').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-scheme]');
    if (!btn) return;
    abateSchemeId = btn.dataset.scheme;
    renderAbatePage();
  });
  document.getElementById('btn-abate-cancel').addEventListener('click', closeAbatePage);
  document.getElementById('btn-abate-download').addEventListener('click', downloadAbateReport);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('abate-page').classList.contains('show')) {
      closeAbatePage();
    }
  });

  document.getElementById('target-table').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-toggle]');
    if (btn) {
      collectNodeValues();
      state.collapsed[btn.dataset.toggle] = !state.collapsed[btn.dataset.toggle];
      renderTargetTable();
      return;
    }
    if (e.target.closest('[data-chart]')) toast('图表预览功能开发中');
  });

  document.getElementById('target-table').addEventListener('input', function (e) {
    if (isDetail || !isGroupMonthlyMode()) return;
    if (!e.target.classList.contains('month-input')) return;
    var cell = ensureDecomposeNode(state.activeInd, e.target.dataset.node);
    if (e.target.dataset.month != null) cell.months[Number(e.target.dataset.month)] = e.target.value.trim();
  });

  document.getElementById('target-table').addEventListener('change', function (e) {
    if (isDetail) return;
    var input = e.target.closest('.target-input');
    if (!input) return;
    var nodeId = input.dataset.node;
    var indId = input.dataset.ind;
    var value = input.value.trim();
    if (!state.values[nodeId]) state.values[nodeId] = {};
    state.values[nodeId][indId] = value;
    if (indId === 'total' || indId === 'intensity') {
      syncTotalIntensity(nodeId, indId, value);
    }
  });

  document.getElementById('create-indicator-tabs').addEventListener('click', function (e) {
    var tab = e.target.closest('[data-ind]');
    if (!tab) return;
    collectNodeValues();
    state.activeInd = tab.dataset.ind;
    renderCreateDecomposeTabs();
    renderGroupMonthlyTable();
  });

  function hasCreateMonthData(indId) {
    return ORG_NODES.some(function (node) {
      var cell = ensureDecomposeNode(indId, node.id);
      return cell.months.some(function (m) { return m != null && String(m).trim() !== ''; });
    });
  }

  function applyCreateAvgDistribution() {
    var decimals = avgDecimalsForInd(state.activeInd);
    ORG_NODES.forEach(function (node) {
      var cell = ensureDecomposeNode(state.activeInd, node.id);
      var annual = parseFloat(createAnnualFor(node.id, state.activeInd));
      if (isNaN(annual) || !annual) return;
      var avg = (annual / 12).toFixed(decimals);
      for (var i = 0; i < 12; i++) cell.months[i] = avg;
    });
    renderGroupMonthlyTable();
    toast('已按全年平均分配');
  }

  document.getElementById('btn-create-avg').addEventListener('click', function () {
    if (isDetail) return;
    collectDecomposeValues();
    if (hasCreateMonthData(state.activeInd)) {
      openModal('create-avg-modal');
      return;
    }
    applyCreateAvgDistribution();
  });
  document.getElementById('btn-create-avg-cancel').addEventListener('click', function () { closeModal('create-avg-modal'); });
  document.getElementById('btn-create-avg-close').addEventListener('click', function () { closeModal('create-avg-modal'); });
  document.getElementById('btn-create-avg-confirm').addEventListener('click', function () {
    closeModal('create-avg-modal');
    applyCreateAvgDistribution();
  });
  document.getElementById('create-avg-modal').addEventListener('click', function (e) {
    if (e.target.id === 'create-avg-modal') closeModal('create-avg-modal');
  });

  document.getElementById('indicator-modal').addEventListener('click', function (e) {
    if (e.target.id === 'indicator-modal') closeModal('indicator-modal');
  });

  function syncDecomposeUI() {
    var monthly = state.dimension === '月度';
    if (monthly) state.decompose = false;
    var yes = document.getElementById('opt-decompose-yes');
    var no = document.getElementById('opt-decompose-no');
    yes.classList.toggle('selected', state.decompose);
    no.classList.toggle('selected', !state.decompose);
    yes.classList.toggle('disabled', monthly);
    yes.disabled = monthly;
    yes.title = monthly ? '月度目标只能选择不分解' : '';
  }

  document.querySelectorAll('.choice-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (lockStep1) return;
      if (btn.classList.contains('disabled') || btn.disabled) return;
      state.decompose = btn.dataset.decompose === '1';
      syncDecomposeUI();
    });
  });

  document.getElementById('btn-create-history').addEventListener('click', function () {
    renderCreateHistory();
    openModal('create-history-modal');
  });
  document.getElementById('btn-create-history-close').addEventListener('click', function () {
    closeModal('create-history-modal');
  });
  document.getElementById('create-history-modal').addEventListener('click', function (e) {
    if (e.target.id === 'create-history-modal') closeModal('create-history-modal');
  });

  document.getElementById('btn-create-change').addEventListener('click', function () {
    collectNodeValues();
    document.getElementById('create-submit-reason').value = '';
    openModal('create-submit-modal');
    setTimeout(function () { document.getElementById('create-submit-reason').focus(); }, 50);
  });
  document.getElementById('btn-create-submit-cancel').addEventListener('click', function () {
    closeModal('create-submit-modal');
  });
  document.getElementById('btn-create-submit-close').addEventListener('click', function () {
    closeModal('create-submit-modal');
  });
  document.getElementById('create-submit-modal').addEventListener('click', function (e) {
    if (e.target.id === 'create-submit-modal') closeModal('create-submit-modal');
  });
  document.getElementById('btn-create-submit-ok').addEventListener('click', function () {
    var reason = document.getElementById('create-submit-reason').value.trim();
    if (!reason) {
      toast('请输入版本更新原因');
      document.getElementById('create-submit-reason').focus();
      return;
    }
    var oldValues = JSON.parse(JSON.stringify((existing && existing.nodeValues) || {}));
    var oldDecompose = JSON.parse(JSON.stringify((existing && existing.decomposeValues) || {}));
    persist(existing.status || 'passed');
    if (!existing.updateHistory) existing.updateHistory = [];
    existing.updateHistory.unshift({
      time: nowText(),
      operator: 'zkgtadmin',
      version: nextCreateUpdateVersion(existing.updateHistory),
      summary: buildCreateChangeSummary(oldValues, existing.nodeValues, oldDecompose, existing.decomposeValues),
      reason: reason,
    });
    saveTargets(list);
    closeModal('create-submit-modal');
    toast('已提交变更');
    setTimeout(function () { location.href = 'index.html'; }, 700);
  });

  updateDimUI();
  updateYearUI();
  updateMonthUI();
  renderIndicators();
  renderFiles();
  syncDecomposeUI();
  applyReadonlyUI();
  showStep(1);
}

if (document.getElementById('panel-step1')) initCreateWizard();
