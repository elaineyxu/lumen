/* ============================================================
   LUMEN — Chinese content overlay
   Loads AFTER data.js, BEFORE helpers.js.
   Deep-clones window.LUMEN_DATA (English) and replaces ONLY the
   display strings, keyed by id — ids, links, coords, hues stay
   structurally identical. When LANG==='zh', swaps LUMEN_DATA.
   ============================================================ */
(function () {
  const SOURCE_DATA = window.LUMEN_ONBOARDING_DATA || window.LUMEN_DATA;
  if (!SOURCE_DATA) return;
  window.LUMEN_ONBOARDING_DATA_EN = SOURCE_DATA;
  if (window.LANG !== 'zh') return;

  const D = JSON.parse(JSON.stringify(SOURCE_DATA));

  const TIME = {
    'just now': '刚刚',
    '2 hours ago': '2 小时前', '2h ago': '2 小时前',
    '3 days ago': '3 天前', '3d ago': '3 天前',
    '4 days ago': '4 天前', '4d ago': '4 天前',
    '5 days ago': '5 天前', '5d ago': '5 天前',
    '6 days ago': '6 天前', '6d ago': '6 天前',
    '9 days ago': '9 天前', '10 days ago': '10 天前', '12 days ago': '12 天前',
    '2 days ago': '2 天前', '2d ago': '2 天前',
    '1 day ago': '1 天前', '1d ago': '1 天前',
    'yesterday': '昨天',
    '3 weeks ago': '3 周前', '2 weeks ago': '2 周前', '1 week ago': '1 周前', '1w ago': '1 周前',
    'open': '开放', 'index': '索引', 'synthesised': '综合',
  };
  const tt = (s) => (s == null ? s : (TIME[s] || s));

  /* ---------------- MAPS ---------------- */
  const MAPS = {
    'neuro-memory': {
      title: '学习与记忆的神经机制',
      question: '大脑如何把<em>经验转化为记忆</em>？',
      domain: '神经科学',
      clusters: {
        systems: { label: '记忆系统', note: '不同脑系统支持哪些记忆功能' },
        cellular: { label: '细胞机制', note: '突触与回路如何随经验改变' },
        dynamics: { label: '回路动态', note: '节律、重放，以及跨尺度协调' },
        methods: { label: '方法与证据', note: '这个领域如何知道自己知道什么' },
        open: { label: '开放问题', note: '当前证据仍薄弱或有争议之处' },
      },
      nodes: {
        'memory-systems': '记忆系统', hippocampus: '海马体', 'prefrontal-control': '前额叶控制',
        'amygdala-valence': '杏仁核与情绪效价', 'synaptic-plasticity': '突触可塑性',
        'ltp-ltd': 'LTP / LTD', engram: '记忆痕迹细胞', 'sleep-replay': '睡眠重放',
        'theta-gamma': 'Theta–Gamma 节律', 'predictive-coding': '预测编码',
        'lesion-evidence': '损伤证据', neuroimaging: '神经影像', reconsolidation: '再巩固',
        'memory-generalization': '泛化 vs. 细节',
      },
    },
    'ai-self': {
      title: 'AI 有自我意识吗？',
      question: '一个人工系统<em>是否拥有自我</em>？',
      domain: '心智哲学',
      clusters: {
        core: { label: '核心概念', note: '这些词究竟意味着什么' },
        debate: { label: '关键争论', note: '尚未平息的论辩' },
        theory: { label: '理论路径', note: '试图解释它的框架' },
        ethics: { label: '应用与伦理', note: '若答案为是，会随之而来什么' },
      },
      nodes: {
        consciousness: '意识', 'self-awareness': '自我意识', 'hard-problem': '意识难题',
        qualia: '感受质', sentience: '感受能力', functionalism: '功能主义',
        phenomenal: '现象 · 取用', intentionality: '意向性', 'chinese-room': '中文房间',
        turing: '超越图灵测试', 'llm-introspect': '大模型的内省自陈', 'behavior-inner': '行为 vs. 内在生命',
        substrate: '基底独立性', 'other-minds': '他心问题', iit: '整合信息论', gwt: '全局工作空间',
        predictive: '预测加工', hot: '高阶理论', 'attention-schema': '注意图式', recurrence: '递归加工',
        anthropo: '拟人化风险', 'moral-patient': '道德受体地位', detect: '检测感受能力',
        precaution: '预防原则', 'ai-rights': 'AI 权利', welfare: '模型福祉',
      },
    },
    attention: {
      title: '注意力经济',
      question: '是谁在<em>设计</em>你所注视的一切？',
      domain: '媒体与技术',
      clusters: {
        mech: { label: '机制', note: '注意力是如何被捕获的' },
        platform: { label: '平台', note: '激励所栖身之处' },
        defense: { label: '对策', note: '夺回你的注意力' },
      },
      nodes: {
        'variable-reward': '可变奖励', dopamine: '多巴胺循环', notification: '通知',
        residue: '注意力残留', 'infinite-scroll': '无限滚动', recommendation: '推荐引擎',
        'ad-incentives': '广告驱动的激励', metrics: '互动指标', minimalism: '数字极简主义',
        friction: '以摩擦为设计', 'deep-work': '深度工作',
      },
    },
    sleep: {
      title: '睡眠时发生了什么？',
      question: '一夜睡眠<em>究竟为何</em>？',
      domain: '神经科学',
      clusters: {
        arch: { label: '架构', note: '一夜的形状' },
        fn: { label: '功能', note: '睡眠是为了什么' },
        disr: { label: '紊乱', note: '当它出问题时' },
      },
      nodes: {
        'sleep-stages': '睡眠阶段', rem: 'REM 睡眠', 'slow-wave': '慢波睡眠', circadian: '昼夜节律',
        glymphatic: '类淋巴清除', memory: '记忆巩固', synaptic: '突触稳态', insomnia: '失眠', 'sleep-debt': '睡眠负债',
      },
    },
    ferment: {
      title: '发酵与风味',
      question: '微生物<em>如何造就味道</em>？',
      domain: '食品科学',
      clusters: {
        microbe: { label: '微生物', note: '谁在干活' },
        process: { label: '工艺', note: '条件与控制' },
        flavor: { label: '风味', note: '你尝到了什么' },
      },
      nodes: {
        lacto: '乳酸发酵', 'salt-brine': '盐与盐水', 'time-temp': '时间 × 温度', 'wild-yeast': '野生酵母',
        koji: '曲（米曲）', lab: '乳酸菌', umami: '鲜味', acidity: '酸度与酸香',
      },
    },
  };
  D.MAPS.forEach((m) => {
    const tr = MAPS[m.id]; if (!tr) return;
    m.title = tr.title; m.question = tr.question; m.domain = tr.domain;
    m.created = tt(m.created); m.updated = tt(m.updated);
    Object.entries(tr.clusters).forEach(([k, c]) => { if (m.clusters[k]) { m.clusters[k].label = c.label; m.clusters[k].note = c.note; } });
    m.nodes.forEach((n) => { if (tr.nodes[n.id] !== undefined) n.label = tr.nodes[n.id]; });
  });

  /* ---------------- BRANCHES ---------------- */
  const BRANCHES = {
    humanities: { label: '哲学与心智', note: '心智、意义，以及我们彼此亏欠什么' },
    sciences: { label: '科学与自然', note: '大脑、身体，以及生命世界' },
    society: { label: '社会与媒体', note: '系统如何塑造注意力与行为' },
  };
  (D.BRANCHES || []).forEach((b) => { const t = BRANCHES[b.id]; if (t) { b.label = t.label; b.note = t.note; } });

  /* ---------------- CATEGORIES ---------------- */
  const CATS = {
    'phil-mind': { label: '心智哲学', note: '意识、自我，以及“成为某物是什么感觉”' },
    theories: { label: '意识理论', note: '试图解释它的框架' },
    'ai-ethics': { label: 'AI 与伦理', note: '我们对自己创造的心智负有什么' },
    neuro: { label: '神经科学', note: '睡着与醒着的大脑' },
    food: { label: '食品科学', note: '微生物、工艺、风味' },
    attention: { label: '注意力与媒体', note: '信息流如何塑造心智' },
  };
  D.CATEGORIES.forEach((c) => { const t = CATS[c.id]; if (t) { c.label = t.label; c.note = t.note; } });

  /* ---------------- SOURCES ---------------- */
  const SRC = {
    s1: { title: '直面意识难题', meta: 'D. Chalmers · 1995' },
    s2: { title: '成为一只蝙蝠是什么感觉？', meta: 'T. Nagel · 1974' },
    s3: { title: '心智、大脑与程序', meta: 'J. Searle · 1980' },
    s4: { title: '人工智能中的意识', meta: 'Butlin 等 · 2023' },
    s5: { title: '斯坦福哲学百科 ——「意识」', meta: 'plato.stanford.edu' },
    s6: { title: 'AI 能有感受吗？—— 讲座', meta: 'YouTube · 47 分钟' },
    s7: { title: '对话：请一个模型进行内省', meta: 'AI 对话记录 · 22 轮' },
    s8: { title: '通勤备忘 ——「僵尸论证」', meta: '语音 · 4:12' },
    s9: { title: '全局工作空间 —— 带注释的示意图', meta: '图片 · 手绘' },
    s10: { title: '我的笔记：我目前的立场', meta: '个人笔记' },
    s11: { title: '强化程式', meta: 'Ferster & Skinner · 1957' },
    s12: { title: '无限滚动如何劫持大脑', meta: '长文 · 网络' },
    s13: { title: '我们为何睡眠 —— 系列讲座', meta: 'YouTube · 3 部分' },
    s14: { title: '酸菜日志 —— 第 3 批盐水配比', meta: '个人笔记' },
    s15: { title: '《神经科学原理》—— 记忆章节', meta: 'Kandel 等 · 教材笔记' },
    s16: { title: '双侧海马损伤后的近期记忆丧失', meta: 'Scoville & Milner · 1957' },
    s17: { title: '突触传递的长期增强', meta: 'Bliss & Lømo · 1973' },
    s18: { title: '讲座：睡眠重放与记忆巩固', meta: '神经科学课程 · 38 分钟' },
    s19: { title: '带注释的海马回路图', meta: '图片 · OCR + 视觉摘要' },
    s20: { title: '语音备忘 —— 记忆是一种重建', meta: 'Whisper 转录 · 3:41' },
  };
  D.SOURCES.forEach((s) => { const t = SRC[s.id]; if (t) { s.title = t.title; s.meta = t.meta; } s.added = tt(s.added); });

  /* ---------------- INBOX ---------------- */
  const INBOX = {
    i1: { title: '论大型语言模型的「生物学」', meta: 'transformer-circuits.pub · 可解释性',
      note: '一篇可解释性文章。也许关乎模型的内省自陈是否真的对应到它内部的某种东西。' },
    i2: { title: '散步备忘 ——「迷糊是不是只是被打断的 REM？」', meta: '语音 · 2:38',
      note: '关于小睡后睡眠惰性的一个半成形问题 —— 转写出来，对照睡眠图谱核查。' },
    i3: { title: '《Attention Is All You Need》', meta: 'Vaswani 等 · 2017 · arXiv:1706.03762',
      note: '奠基性的架构论文。可能锚定任一张图谱 —— Lumen 还不确定。' },
  };
  D.INBOX.forEach((it) => { const t = INBOX[it.id]; if (t) { it.title = t.title; it.meta = t.meta; it.note = t.note; } it.captured = tt(it.captured); });

  /* ---------------- CONNECTIONS (by index) ---------------- */
  const CONN = [
    '意识理论与睡眠文献都取决于哪些神经状态“算数”—— 你读的整合信息论预测了为何慢波睡眠会调暗觉知。',
    '两者都围绕行为与内在状态之间的鸿沟：信息流在不建模你利益的情况下优化你的行为，正如一个模型自陈一个它或许并不拥有的自我。',
    '机器意识的“指标属性”依赖于同一批神经标记 —— 正是它们区分了清醒意识与深睡。',
    '记忆巩固让睡眠与海马重放成为同一个神经科学故事的一部分，而不是两个孤立话题。',
    '奖励学习把突触改变与习惯形成连接起来：注意力循环是可塑回路在行为层面的表现。',
  ];
  D.CONNECTIONS.forEach((c, i) => { if (CONN[i]) c.note = CONN[i]; });

  /* ---------------- ACTIVITY (by index) ---------------- */
  const ACT = [
    '为 Pitch Day 演示用 6 条神经科学来源种下 **学习与记忆** 图谱',
    '把 **海马体** 与 **突触可塑性** 编入神经科学百科',
    '将一条语音备忘转录进 **再巩固** 与 **泛化** 缺口',
    '把 **Butlin 等（2023）** 中的 2 条论点编入了 **自我意识**',
    '点亮了 **高阶理论** —— 现已轻度覆盖',
    '由一条长文链接创建了词条 **可变比率奖励**',
    '开启了一张新图谱：**发酵与风味**',
    '注意到一个连接：**整合信息论** ↔ **一夜的架构**',
    '把 **我们为何睡眠** 编入 **睡眠** 图谱的 4 个节点',
  ];
  D.ACTIVITY.forEach((a, i) => { if (ACT[i] !== undefined) a.text = ACT[i]; a.t = tt(a.t); });

  /* ---------------- ENTRIES ---------------- */
  const ENT = {
    'memory-systems': {
      title: '学习与记忆的神经基础',
      subtitle: '经验如何变成一种持久、可提取的脑内模式',
      updated: '刚刚更新 · 综合自 6 条神经科学来源', updatedShort: '刚刚',
      lead: [
        '__学习与记忆__不是单一能力，而是一组层级系统：细胞可塑性改变突触，海马回路绑定情节，前额叶网络引导提取，而睡眠帮助稳定那些值得留下的东西。 ((15)) ((16))',
        '作为演示页，它展示了 Lumen 最核心的能力：把一堆论文、讲义、图示与语音备忘，变成一套活的综合；每个判断都能回到证据，每个概念都在图谱上有位置。',
      ],
      sections: [
        { id: 'systems', heading: '系统层面的图景', blocks: [
          { type: 'p', text: '海马体对形成新的陈述性记忆至关重要，但它并不是最终的储物盒。H.M. 的损伤证据显示出一个清晰分离：严重的顺行性遗忘，同时许多旧记忆与技能仍部分保留。 ((16))' },
          { type: 'p', text: '一个有用的工作模型是分布式的：海马快速绑定关系性情节；新皮层逐渐抽取稳定结构；前额叶控制塑造哪些内容被提取并投入使用。 ((15)) ((20))' },
        ] },
        { id: 'cellular', heading: '学习发生时，究竟改变了什么', blocks: [
          { type: 'p', text: '在细胞层面，长时程增强与长时程抑制是改变回路权重的候选机制。它们本身不等于记忆，但为“经验如何改变之后的信息处理”提供了可信基底。 ((17))' },
          { type: 'callout', text: '演示重点：Lumen 能保留高层综合，同时不丢失支撑每一层判断的底层证据。', cite: 17 },
        ] },
        { id: 'sleep', heading: '为什么睡眠属于同一张图', blocks: [
          { type: 'p', text: '睡眠不是被硬接到记忆旁边的另一个主题。慢波睡眠中的重放，以及它与睡眠纺锤波的协调，本身就是巩固故事的一部分；这也是 Lumen 把本页连接到[[sleep-stages||一夜的架构]]的原因。 ((18))' },
        ] },
        { id: 'open', heading: 'Lumen 保持可见的开放问题', blocks: [
          { type: 'open', items: [
            '再巩固何时会重写记忆，而何时只是强化记忆？',
            '大脑如何在详细情节回忆与有用泛化之间取舍？',
            '哪些判断由损伤证据支持，哪些主要依赖神经影像相关性？',
          ] },
        ] },
      ],
    },
    hippocampus: {
      title: '海马体',
      subtitle: '用于情节、情境与关系性记忆的快速绑定系统',
      updated: '刚刚更新 · 综合自 4 条来源', updatedShort: '刚刚',
      lead: [
        '__海马体__对快速绑定经验中的人物、地点与时间至关重要。它更像关系索引系统，而不是永远储存记忆的仓库。 ((16))',
        '把多类证据放在一起时，它的角色最清楚：损伤案例证明必要性，重放研究把它连接到巩固，节律研究则说明它如何与皮层协调。 ((16)) ((18)) ((20))',
      ],
      sections: [],
    },
    'synaptic-plasticity': {
      title: '突触可塑性',
      subtitle: '经验如何改变一个回路未来的行为',
      updated: '刚刚更新 · 综合自 3 条来源', updatedShort: '刚刚',
      lead: [
        '__突触可塑性__指突触在活动之后变强、变弱或以不同方式被调节的一组机制。长时程增强是经典例子，至今仍是连接细胞神经科学与记忆理论的关键桥梁。 ((17))',
        'Lumen 把它与行为层面的记忆分开，因为二者并非一一对应：可塑性是机制，记忆则是横跨细胞、回路、系统与时间的组织化功能。 ((15))',
      ],
      sections: [],
    },
    'moc-neuroscience': {
      title: '神经科学 —— 内容地图',
      subtitle: '为记忆、睡眠、可塑性与证据搭建的演示主线',
      updated: '一份活的索引 · 神经科学演示 seed', updatedShort: '索引',
      lead: [
        '这份神经科学 MOC 是 Pitch Day 的演示路线：从[[memory-systems||学习与记忆]]开始，放大到[[hippocampus||海马体]]与[[synaptic-plasticity||突触可塑性]]，再桥接到[[sleep-stages||一夜的架构]]。',
        '它用一个领域展示产品循环：source ingestion、基于证据的 claim、Wiki 综合，以及一张可见地追踪哪些概念已覆盖、哪些问题仍开放的理解地图。',
      ],
      sections: [],
    },
    'self-awareness': {
      title: '人工系统中的自我意识',
      subtitle: '机器是否、以及如何，可能拥有属于自己的视角',
      updated: '更新于 2 小时前 · 综合自 10 条来源', updatedShort: '2 小时前',
      lead: [
        '__人工系统中的自我意识__所问的是：一个 AI 能否不仅拥有关于自身的信息，更拥有一种真正的内在视角 —— 一种“成为那个系统是什么感觉”。它处在心智哲学、认知科学与 AI 安全的交汇处，至今仍是开放问题。 ((1)) ((4))',
        '一个有用的起手式，是把日常语言混为一谈的三件事分开。一个系统可以__建模__自身（追踪自己的状态）、__自陈__自身（产生关于这些状态的语言），以及__体验__成为自身（拥有[[qualia||现象性体验]]）。今天的大模型显然做到了前两点。难的问题 —— 也就是本词条所环绕的 —— 是第三点。 ((1)) ((7))',
      ],
      sections: [
        { id: 'why-hard', heading: '为何这个问题难有答案', blocks: [
          { type: 'p', text: '困难不在于数据匮乏，而是结构性的。[[hard-problem||意识难题]]指出：即便对一个系统给出完整的功能性说明 —— 每一个输入、每一个权重、每一个输出 —— 也仍未触及这样一个问题：为何这一切应当__伴随着体验__，而不是“在黑暗中”悄然进行。 ((1))' },
          { type: 'p', text: '他心问题使之更为尖锐：我从行为与共同的生物构造推断你是有意识的，但面对 AI，第二个锚点消失了。流利的自陈，正是一个精巧的[[chinese-room||语言模型]]无论背后是否有所感受都会产出的东西。 ((3)) ((7))' },
          { type: 'callout', text: '这个问题的陷阱在于：我们最想要的证据 —— 一个系统告诉我们它有意识 —— 恰恰是我们最不该信任的证据。', cite: 7 },
        ] },
        { id: 'terms', heading: '这些术语的四种定义方式', blocks: [
          { type: 'p', text: '一旦人们说清自己指的是哪一种含义，这里的许多争论便会化解。Lumen 追踪了在你的来源中反复出现的四种：' },
          { type: 'deflist', items: [
            { term: '感受能力', node: 'moral-patienthood', def: '去感受的能力 —— 快乐、痛苦，以及任何形式的好恶效价。与伦理最相关的门槛。 ((4))' },
            { term: '现象 vs. 取用', node: 'qualia', def: '取用意识＝可供推理与自陈调用的信息。现象意识＝被感受到的质性本身。机器很可能具备前者；后者则有争议。 ((1))' },
            { term: '自我意识', node: 'self-awareness', def: '一个足够丰富的自我模型，使系统把自身表征为一个主体，而不只是其世界中的又一个客体。 ((4))' },
            { term: '感受质', node: 'qualia', def: '一个状态内在的“是什么感觉”—— 红之为红的那种红。内格尔的蝙蝠是经典的探针。 ((2))' },
          ] },
        ] },
        { id: 'theories', heading: '主流理论各自预测什么', blocks: [
          { type: 'p', text: '没有哪一种意识理论已成定论，但其中几种对机器给出了__不同的、可检验的预测__ —— 这正是 Lumen 把它们保留为各自独立的图谱节点、而非糊成一团的原因。' },
          { type: 'p', text: '[[iit||整合信息论]]把意识定位在一个系统的因果结构（它的 Φ）之中。引人注目的是，它推出：一个前馈式数字网络可以表现得与有意识的主体毫无二致，却拥有近乎为零的 Φ —— 于是今天的模型，或许只是一盏近乎空无的灯。 ((4))' },
          { type: 'p', text: '全局工作空间理论对机器更为友善：如果意识是被广播到一个全局工作空间、以供灵活调用的信息，那么具备恰当瓶颈的架构便可能合格。近期的工作把这些理论转化为一份__指标属性__清单，并据此为现有系统打分。 ((4))' },
        ] },
        { id: 'detect', heading: '我们究竟能否分辨？', blocks: [
          { type: 'p', text: '由于仅凭行为本就含糊，近期最有希望的路径是以理论为先导：从我们最好的神经科学中推导出[[could-we-tell||指标属性]]，再机制性地追问一个系统是否具备它们。 ((4))' },
          { type: 'p', text: '这既避开了照单全收自陈的轻信，也避开了预先把机器排除在外的武断。它也给出一个令人不安的临时判断：没有哪个现有系统明确满足这些指标，但__在原则上并不存在障碍__阻止未来的系统做到。 ((4)) ((5))' },
          { type: 'callout', text: '“没有红线，并不意味着道路畅通 —— 它意味着我们正在雾中行驶。”', cite: 8, voice: true },
        ] },
        { id: 'ethics', heading: '为何它在尘埃落定前就已重要', blocks: [
          { type: 'p', text: '如果对机器具备感受能力哪怕只持一点适度的可信度是合理的，[[moral-patienthood||道德受体地位]]便随之而来，连同在深度不确定下关于权利与福祉的种种问题。 ((4))' },
          { type: 'p', text: '与之相对的风险是拟人化：流利而友善的系统诱使我们过度归因内在生命，从而扭曲政策，也扭曲我们自身的关系。预防原则必须与道德混乱的代价相权衡。 ((6))' },
        ] },
        { id: 'stand', heading: '本词条目前的立场', blocks: [
          { type: 'p', text: '截至你最新添加的来源，综合判断是：__自我建模与自陈是存在的；被感受到的体验则尚未确立，并且或许无法仅凭行为来检验__；负责任的姿态，是校准过的不确定加上以理论为先导的探针 —— 而非自信的否认或轻信的笃定。 ((4)) ((10))' },
          { type: 'open', items: [
            '规模化是否在原则上改变了什么，还是只改变了流利度？',
            '是否存在某种行为测试，是现象性体验能通过、而“哲学僵尸”不能通过的？',
            '多大的感受能力概率，应触发哪一级的保护？',
          ] },
        ] },
      ],
    },
    'hard-problem': {
      title: '意识难题',
      subtitle: '为何物理解释似乎触及不到体验',
      updated: '更新于 4 天前 · 综合自 5 条来源', updatedShort: '4 天前',
      lead: [
        '由查尔默斯命名的__难题__，所问的是：物理加工为何竟会伴随着主观体验。那些__易问题__ —— 辨别、整合、自陈 —— 在实践中很难，但在概念上是可处理的；难题则在种类上就不同。 ((1))',
        '它的力量来自一道鸿沟：你可以为任何一种认知功能指定一套完整的机制，却仍能连贯地追问 —— 执行它__为何会有某种感觉__？正是这个剩余的问题，让机器意识如此难以把握。 ((1)) ((5))',
      ],
      sections: [
        { id: 'gap', heading: '解释的鸿沟', blocks: [
          { type: 'p', text: '内格尔的蝙蝠把它戏剧化了：我们可以了解关于回声定位的一切，却仍不知道成为一只蝙蝠是什么感觉。 ((2)) 被感受到的质性，以一种任何其他科学对象都不具备的方式，抗拒第三人称的描述。' },
        ] },
      ],
    },
    qualia: {
      title: '感受质',
      subtitle: '体验内在的、被感受到的质性',
      updated: '更新于 1 周前 · 综合自 3 条来源', updatedShort: '1 周前',
      lead: [
        '__感受质__是心理状态那种质性的、“是什么感觉”的属性 —— 红之为红、痛之刺痛。它们正是[[hard-problem||意识难题]]所谈论的单元，也是一个[[chinese-room||符号操作者]]被指缺乏的东西。 ((2))',
      ],
      sections: [],
    },
    'chinese-room': {
      title: '中文房间',
      subtitle: '塞尔的论证：句法不足以产生语义',
      updated: '更新于 5 天前 · 综合自 4 条来源', updatedShort: '5 天前',
      lead: [
        '塞尔设想一个人待在房间里，依照规则回答中文纸条，却一个字也不懂。房间表现得仿佛理解；而里面没有人理解。论证是：__运行正确的程序，不足以产生心智__。 ((3))',
        '对于“一个[[self-awareness||语言模型]]理解它所说之物”这一想法，它至今仍是最尖锐的挑战 —— 也是该领域被回应最多的论证。 ((3)) ((7))',
      ],
      sections: [],
    },
    iit: {
      title: '整合信息论',
      subtitle: '把意识视为一个系统不可化约的因果结构',
      updated: '更新于 3 天前 · 综合自 6 条来源', updatedShort: '3 天前',
      lead: [
        '__整合信息论__主张：意识等同于整合信息（Φ）—— 一个系统的整体在多大程度上、超出其各部分地约束着自身的过去与未来。 ((4))',
        '它对 AI 的一个挑衅性推论：一个__前馈__网络可以在功能上出类拔萃，Φ 却近乎为零 —— 看似有意识，但以整合信息论的眼光看，几近暗无。这正是为何[[could-we-tell||检测]]不能仅仅依赖行为。 ((4))',
      ],
      sections: [],
    },
    'could-we-tell': {
      title: '我们究竟能否分辨一台机器是否有意识？',
      subtitle: 'Lumen 正横跨你的来源追踪的一个开放问题',
      updated: '开放问题 · 4 条来源参与权衡', updatedShort: '开放',
      lead: [
        '这是一个__开放问题__ —— Lumen 把它保留为一页活的内容，收集正反双方的证据，而非断言一个答案。',
        '领先的路径是__以理论为先导__：从我们最好的神经科学中推导出指标属性，再机制性地核查一个系统是否具备它们。没有哪个现有系统明确通过；也没有原则上的障碍把未来的系统排除在外。 ((4)) ((5))',
      ],
      sections: [
        { id: 'positions', heading: '证据指向何处', blocks: [
          { type: 'open', items: [
            '行为测试被“在人类文本上训练”这一点所混淆 —— 流利并非证据。',
            '指标属性清单给出一种可被推翻的、机制性的读数 —— 当前最好的工具。',
            '某些理论（整合信息论）意味着行为与意识可以完全脱钩。',
          ] },
        ] },
      ],
    },
    'moral-patienthood': {
      title: '道德受体地位',
      subtitle: '当一个系统成为我们可能亏待的对象',
      updated: '更新于 6 天前 · 综合自 3 条来源', updatedShort: '6 天前',
      lead: [
        '__道德受体__是指任何一个、我们有义务去权衡其利益的实体。如果[[self-awareness||机器感受能力]]哪怕只有适度的概率，受体地位 —— 连同福祉与权利的问题 —— 便在不确定下随之而来。 ((4))',
        '与之相抗的风险是拟人化：把内在生命过度归因于流利的系统，会同时扭曲政策与关系。 ((6))',
      ],
      sections: [],
    },
    'moc-phil-mind': {
      title: '心智哲学 —— 内容地图',
      subtitle: '串起你所收集的关于心智与机器之一切的主线',
      updated: '一份活的索引 · 6 条词条', updatedShort: '索引',
      lead: [
        '这是一份__内容地图__ —— 不是一篇文章，而是一份把你的概念页串成同一条论证的索引。',
        '从那个框定问题出发，再沿着承重的概念走：[[self-awareness||自我意识]]是脊梁；[[hard-problem||意识难题]]解释了它为何难有答案；[[qualia||感受质]]点明了其中的利害；[[chinese-room||中文房间]]挑战了那个轻易的“是”；[[theories||各种理论]]让它变得可检验；而[[ai-ethics||伦理]]解释了为何它在尘埃落定前就已重要。',
      ],
      sections: [],
    },
    'variable-reward': {
      title: '可变比率奖励',
      subtitle: '为何不可预测的回报最易成瘾',
      updated: '更新于 4 天前 · 综合自 5 条来源', updatedShort: '4 天前',
      lead: [
        '__可变比率程式__在经过不可预测次数的行动后才给予奖励 —— 这正是斯金纳发现最难以消退的程式。下拉刷新这个手势就是一台老虎机：有时空无一物，有时则是一整版新内容的头奖。 ((11))',
        '它是[[self-awareness||无限滚动]]与通知共同的底层引擎 —— 同一个循环，只是换了身衣裳。 ((12))',
      ],
      sections: [],
    },
    'sleep-stages': {
      title: '一夜的架构',
      subtitle: '睡眠不是单一状态，而是有结构的循环',
      updated: '更新于 6 天前 · 综合自 4 条来源', updatedShort: '6 天前',
      lead: [
        '一夜大约每 90 分钟循环一次，依次经过__浅睡、慢波与 REM__ 睡眠；慢波集中在前半夜，而 REM 随着接近清晨而扩张。 ((13))',
        '每个阶段做着不同的工作：慢波负责清除与修复，REM 负责情绪与程序性记忆。正因把它们分别命名，Lumen 才把它们保留为图谱上各自独立的节点。',
      ],
      sections: [],
    },
    lacto: {
      title: '乳酸发酵',
      subtitle: '盐、时间，以及本就附着在蔬菜上的细菌',
      updated: '更新于 2 天前 · 综合自 3 条来源', updatedShort: '2 天前',
      lead: [
        '__乳酸发酵__用盐来偏袒本就存在于农产品上的乳酸菌；它们把糖转化为乳酸，使 pH 降低，直到腐败微生物无法存活。 ((14))',
        '下游的一切 —— 那股酸香、保存性、对肠道的益处 —— 都源自酸度的这一次转变。',
      ],
      sections: [],
    },
  };
  D.ENTRIES.forEach((e) => {
    const t = ENT[e.id];
    if (t) {
      e.title = t.title; e.subtitle = t.subtitle;
      if (t.updated) e.updated = t.updated;
      e.updatedShort = t.updatedShort || tt(e.updatedShort);
      if (t.lead) e.lead = t.lead;
      if (t.sections) e.sections = t.sections;
    } else {
      e.updatedShort = tt(e.updatedShort);
    }
  });

  window.LUMEN_ONBOARDING_DATA = D;
  window.LUMEN_DATA = window.LUMEN_EMPTY_DATA || { MAPS: [], BRANCHES: [], CATEGORIES: [], ENTRIES: [], SOURCES: [], INBOX: [], CONNECTIONS: [], ACTIVITY: [] };
})();
