/* ============================================================
   LUMEN — personal knowledge system data
   Plain JS. Assigns window.LUMEN_DATA.
   Structure:
     MAPS        — every Expert Map (nodes / links / clusters)
     CATEGORIES  — wiki shelves / MOCs
     ENTRIES     — wiki pages (concept · question · moc)
     SOURCES     — the source library, with contributions
     CONNECTIONS — cross-domain bridges between entries
     ACTIVITY    — system-wide growth feed
   ============================================================ */
(function () {

  /* ============================================================
     MAP 1 — Is AI self-aware?  (the deep one)
     ============================================================ */
  const M1_CLUSTERS = {
    core:   { label: 'Core Concepts',        hue: 'blue',   note: 'What the words actually mean' },
    debate: { label: 'Key Debates',          hue: 'coral',  note: 'The unresolved arguments' },
    theory: { label: 'Theory Paths',         hue: 'violet', note: 'Frameworks that try to explain it' },
    ethics: { label: 'Application & Ethics', hue: 'amber',  note: 'What follows if the answer is yes' },
  };
  const M1_NODES = [
    { id:'consciousness',  label:'Consciousness',            cluster:'core', x:18, y:33, size:132, hue:'blue',   explored:.92, sources:7 },
    { id:'self-awareness', label:'Self-Awareness',           cluster:'core', x:31, y:51, size:128, hue:'blue',   explored:.86, sources:9, hub:true },
    { id:'hard-problem',   label:'The Hard Problem',         cluster:'core', x:12, y:61, size:98,  hue:'blue',   explored:.80, sources:5 },
    { id:'qualia',         label:'Qualia',                   cluster:'core', x:8,  y:45, size:72,  hue:'teal',   explored:.58, sources:3 },
    { id:'sentience',      label:'Sentience',                cluster:'core', x:25, y:18, size:82,  hue:'blue',   explored:.70, sources:4 },
    { id:'functionalism',  label:'Functionalism',            cluster:'core', x:22, y:73, size:68,  hue:'teal',   explored:.50, sources:2 },
    { id:'phenomenal',     label:'Phenomenal · Access',      cluster:'core', x:6,  y:25, size:56,  hue:'blue',   explored:.33, sources:1 },
    { id:'intentionality', label:'Intentionality',           cluster:'core', x:15, y:85, size:52,  hue:'blue',   explored:.10, sources:0 },
    { id:'chinese-room',   label:'The Chinese Room',         cluster:'debate', x:45, y:21, size:92,  hue:'coral', explored:.75, sources:4 },
    { id:'turing',         label:'Beyond the Turing Test',   cluster:'debate', x:39, y:35, size:64,  hue:'coral', explored:.60, sources:3 },
    { id:'llm-introspect', label:'LLM Introspection Claims', cluster:'debate', x:56, y:40, size:84,  hue:'coral', explored:.66, sources:5 },
    { id:'behavior-inner', label:'Behaviour vs. Inner Life', cluster:'debate', x:49, y:55, size:58,  hue:'coral', explored:.48, sources:2 },
    { id:'substrate',      label:'Substrate Independence',   cluster:'debate', x:61, y:19, size:58,  hue:'coral', explored:.40, sources:1 },
    { id:'other-minds',    label:'The Other-Minds Problem',  cluster:'debate', x:43, y:68, size:50,  hue:'coral', explored:.30, sources:1 },
    { id:'iit',            label:'Integrated Information',   cluster:'theory', x:81, y:33, size:116, hue:'violet', explored:.82, sources:6 },
    { id:'gwt',            label:'Global Workspace',         cluster:'theory', x:70, y:50, size:90,  hue:'violet', explored:.68, sources:4 },
    { id:'predictive',     label:'Predictive Processing',    cluster:'theory', x:87, y:55, size:66,  hue:'teal',   explored:.50, sources:2 },
    { id:'hot',            label:'Higher-Order Theories',    cluster:'theory', x:78, y:19, size:60,  hue:'violet', explored:.44, sources:2 },
    { id:'attention-schema',label:'Attention Schema',        cluster:'theory', x:91, y:41, size:56,  hue:'violet', explored:.40, sources:1 },
    { id:'recurrence',     label:'Recurrent Processing',     cluster:'theory', x:93, y:25, size:46,  hue:'violet', explored:.08, sources:0 },
    { id:'anthropo',       label:'Anthropomorphism Risk',    cluster:'ethics', x:62, y:74, size:76,  hue:'amber', explored:.60, sources:3 },
    { id:'moral-patient',  label:'Moral Patienthood',        cluster:'ethics', x:49, y:84, size:72,  hue:'amber', explored:.55, sources:3 },
    { id:'detect',         label:'Detecting Sentience',      cluster:'ethics', x:73, y:83, size:62,  hue:'amber', explored:.50, sources:2 },
    { id:'precaution',     label:'Precautionary Principle',  cluster:'ethics', x:37, y:87, size:54,  hue:'amber', explored:.44, sources:1 },
    { id:'ai-rights',      label:'AI Rights',                cluster:'ethics', x:85, y:74, size:54,  hue:'amber', explored:.38, sources:1 },
    { id:'welfare',        label:'Model Welfare',            cluster:'ethics', x:60, y:93, size:48,  hue:'amber', explored:.13, sources:0 },
  ];
  const M1_LINKS = [
    ['self-awareness','consciousness','solid'], ['self-awareness','hard-problem','dash'],
    ['consciousness','qualia','dash'], ['consciousness','sentience','dash'],
    ['hard-problem','qualia','solid'], ['self-awareness','functionalism','dash'],
    ['qualia','phenomenal','dot'], ['functionalism','intentionality','dot'],
    ['chinese-room','turing','dash'], ['chinese-room','llm-introspect','dash'],
    ['turing','llm-introspect','dot'], ['llm-introspect','behavior-inner','dash'],
    ['chinese-room','substrate','dot'], ['behavior-inner','other-minds','dot'],
    ['iit','gwt','dash'], ['iit','predictive','dash'], ['gwt','predictive','dot'],
    ['iit','hot','dash'], ['iit','attention-schema','dot'], ['attention-schema','recurrence','dot'],
    ['hot','attention-schema','dot'],
    ['moral-patient','ai-rights','dash'], ['moral-patient','detect','dash'],
    ['moral-patient','precaution','dot'], ['detect','ai-rights','dot'],
    ['anthropo','moral-patient','dash'], ['welfare','moral-patient','dot'],
    ['self-awareness','chinese-room','dash'], ['consciousness','iit','dash'],
    ['hard-problem','iit','dot'], ['functionalism','chinese-room','dot'],
    ['llm-introspect','anthropo','dash'], ['iit','detect','dot'],
    ['sentience','moral-patient','dash'], ['behavior-inner','gwt','dot'],
    ['self-awareness','llm-introspect','solid'],
  ];

  /* ============================================================
     MAP 2 — The attention economy
     ============================================================ */
  const M2_CLUSTERS = {
    mech:    { label: 'Mechanisms',   hue: 'blue',  note: 'How attention is captured' },
    platform:{ label: 'Platforms',    hue: 'coral', note: 'Where the incentives live' },
    defense: { label: 'Countermeasures', hue: 'teal', note: 'Getting your attention back' },
  };
  const M2_NODES = [
    { id:'variable-reward', label:'Variable Reward',     cluster:'mech', x:26, y:40, size:118, hue:'blue', explored:.80, sources:5, hub:true },
    { id:'dopamine',        label:'Dopamine Loops',      cluster:'mech', x:14, y:25, size:78,  hue:'blue', explored:.62, sources:3 },
    { id:'notification',    label:'Notifications',       cluster:'mech', x:18, y:62, size:70,  hue:'blue', explored:.66, sources:3 },
    { id:'residue',         label:'Attention Residue',   cluster:'mech', x:34, y:70, size:58,  hue:'teal', explored:.34, sources:1 },
    { id:'infinite-scroll', label:'Infinite Scroll',     cluster:'platform', x:56, y:28, size:84, hue:'coral', explored:.70, sources:4 },
    { id:'recommendation',  label:'Recommendation Engines', cluster:'platform', x:70, y:46, size:92, hue:'coral', explored:.58, sources:3 },
    { id:'ad-incentives',   label:'Ad-Funded Incentives',cluster:'platform', x:80, y:28, size:66, hue:'coral', explored:.46, sources:2 },
    { id:'metrics',         label:'Engagement Metrics',  cluster:'platform', x:62, y:62, size:58, hue:'coral', explored:.30, sources:1 },
    { id:'minimalism',      label:'Digital Minimalism',  cluster:'defense', x:44, y:86, size:66, hue:'teal', explored:.50, sources:2 },
    { id:'friction',        label:'Friction by Design',  cluster:'defense', x:74, y:80, size:54, hue:'teal', explored:.20, sources:0 },
    { id:'deep-work',       label:'Deep Work',           cluster:'defense', x:24, y:88, size:60, hue:'teal', explored:.42, sources:2 },
  ];
  const M2_LINKS = [
    ['variable-reward','dopamine','solid'], ['variable-reward','notification','dash'],
    ['variable-reward','infinite-scroll','dash'], ['notification','residue','dot'],
    ['infinite-scroll','recommendation','dash'], ['recommendation','ad-incentives','dash'],
    ['recommendation','metrics','dot'], ['ad-incentives','metrics','dot'],
    ['minimalism','deep-work','dash'], ['minimalism','friction','dot'],
    ['residue','deep-work','dash'], ['variable-reward','recommendation','dot'],
    ['infinite-scroll','minimalism','dot'],
  ];

  /* ============================================================
     MAP 3 — What happens during sleep?
     ============================================================ */
  const M3_CLUSTERS = {
    arch: { label: 'Architecture', hue: 'violet', note: 'The shape of a night' },
    fn:   { label: 'Function',     hue: 'teal',   note: 'What sleep is for' },
    disr: { label: 'Disruption',   hue: 'amber',  note: 'When it breaks' },
  };
  const M3_NODES = [
    { id:'sleep-stages', label:'Sleep Stages',          cluster:'arch', x:24, y:36, size:112, hue:'violet', explored:.74, sources:4, hub:true },
    { id:'rem',          label:'REM Sleep',             cluster:'arch', x:12, y:58, size:78,  hue:'violet', explored:.66, sources:3 },
    { id:'slow-wave',    label:'Slow-Wave Sleep',       cluster:'arch', x:34, y:62, size:74,  hue:'violet', explored:.58, sources:3 },
    { id:'circadian',    label:'Circadian Rhythm',      cluster:'arch', x:20, y:18, size:72,  hue:'violet', explored:.52, sources:2 },
    { id:'glymphatic',   label:'Glymphatic Clearance',  cluster:'fn', x:64, y:30, size:80,  hue:'teal', explored:.48, sources:2 },
    { id:'memory',       label:'Memory Consolidation',  cluster:'fn', x:78, y:46, size:86,  hue:'teal', explored:.60, sources:3 },
    { id:'synaptic',     label:'Synaptic Homeostasis',  cluster:'fn', x:62, y:56, size:58,  hue:'teal', explored:.28, sources:1 },
    { id:'insomnia',     label:'Insomnia',              cluster:'disr', x:50, y:80, size:64, hue:'amber', explored:.44, sources:2 },
    { id:'sleep-debt',   label:'Sleep Debt',            cluster:'disr', x:74, y:78, size:56, hue:'amber', explored:.30, sources:1 },
  ];
  const M3_LINKS = [
    ['sleep-stages','rem','solid'], ['sleep-stages','slow-wave','solid'], ['sleep-stages','circadian','dash'],
    ['slow-wave','glymphatic','dash'], ['rem','memory','dash'], ['slow-wave','memory','dot'],
    ['glymphatic','synaptic','dot'], ['circadian','insomnia','dash'], ['insomnia','sleep-debt','dash'],
    ['memory','synaptic','dot'], ['sleep-stages','glymphatic','dot'],
  ];

  /* ============================================================
     MAP 4 — Learning & memory in the brain
     ============================================================ */
  const M5_CLUSTERS = {
    systems: { label: 'Memory Systems', hue: 'blue', note: 'Which brain systems support different memory functions' },
    cellular: { label: 'Cellular Mechanisms', hue: 'teal', note: 'How synapses and circuits change with experience' },
    dynamics: { label: 'Circuit Dynamics', hue: 'violet', note: 'Rhythms, replay, and coordination across scales' },
    methods: { label: 'Methods & Evidence', hue: 'amber', note: 'How the field knows what it knows' },
    open: { label: 'Open Questions', hue: 'coral', note: 'Where current evidence is still thin or contested' },
  };
  const M5_NODES = [
    { id:'memory-systems', label:'Memory Systems', cluster:'systems', x:48, y:42, size:122, hue:'blue', explored:.78, sources:6, hub:true },
    { id:'hippocampus', label:'Hippocampus', cluster:'systems', x:24, y:34, size:100, hue:'blue', explored:.72, sources:5 },
    { id:'prefrontal-control', label:'Prefrontal Control', cluster:'systems', x:25, y:62, size:76, hue:'blue', explored:.44, sources:2 },
    { id:'amygdala-valence', label:'Amygdala & Valence', cluster:'systems', x:16, y:78, size:68, hue:'coral', explored:.38, sources:2 },
    { id:'synaptic-plasticity', label:'Synaptic Plasticity', cluster:'cellular', x:70, y:31, size:104, hue:'teal', explored:.70, sources:4 },
    { id:'ltp-ltd', label:'LTP / LTD', cluster:'cellular', x:84, y:48, size:82, hue:'teal', explored:.62, sources:3 },
    { id:'engram', label:'Engram Cells', cluster:'cellular', x:68, y:66, size:82, hue:'teal', explored:.50, sources:2 },
    { id:'sleep-replay', label:'Sleep Replay', cluster:'dynamics', x:52, y:78, size:88, hue:'violet', explored:.58, sources:3 },
    { id:'theta-gamma', label:'Theta–Gamma Rhythms', cluster:'dynamics', x:45, y:22, size:72, hue:'violet', explored:.46, sources:2 },
    { id:'predictive-coding', label:'Predictive Coding', cluster:'dynamics', x:78, y:18, size:76, hue:'violet', explored:.42, sources:2 },
    { id:'lesion-evidence', label:'Lesion Evidence', cluster:'methods', x:10, y:48, size:70, hue:'amber', explored:.64, sources:3 },
    { id:'neuroimaging', label:'Neuroimaging', cluster:'methods', x:89, y:75, size:66, hue:'amber', explored:.34, sources:1 },
    { id:'reconsolidation', label:'Reconsolidation', cluster:'open', x:38, y:88, size:66, hue:'coral', explored:.36, sources:1 },
    { id:'memory-generalization', label:'Generalization vs. Detail', cluster:'open', x:61, y:91, size:64, hue:'coral', explored:.24, sources:0 },
  ];
  const M5_LINKS = [
    ['memory-systems','hippocampus','solid'], ['memory-systems','prefrontal-control','solid'],
    ['memory-systems','synaptic-plasticity','solid'], ['hippocampus','lesion-evidence','solid'],
    ['hippocampus','theta-gamma','dash'], ['hippocampus','sleep-replay','dash'],
    ['synaptic-plasticity','ltp-ltd','solid'], ['synaptic-plasticity','engram','dash'],
    ['ltp-ltd','engram','dot'], ['sleep-replay','reconsolidation','dash'],
    ['prefrontal-control','memory-generalization','dash'], ['amygdala-valence','reconsolidation','dot'],
    ['predictive-coding','memory-generalization','dash'], ['neuroimaging','engram','dot'],
    ['theta-gamma','sleep-replay','dot'], ['memory-systems','predictive-coding','dot'],
  ];

  /* ============================================================
     MAP 5 — Fermentation & flavor  (newest, least explored)
     ============================================================ */
  const M4_CLUSTERS = {
    microbe: { label: 'Microbes',  hue: 'teal',  note: 'Who does the work' },
    process: { label: 'Process',   hue: 'amber', note: 'Conditions & control' },
    flavor:  { label: 'Flavor',    hue: 'coral', note: 'What you taste' },
  };
  const M4_NODES = [
    { id:'lacto',     label:'Lacto-Fermentation', cluster:'process', x:30, y:42, size:104, hue:'amber', explored:.56, sources:3, hub:true },
    { id:'salt-brine',label:'Salt & Brine',       cluster:'process', x:18, y:64, size:64,  hue:'amber', explored:.40, sources:1 },
    { id:'time-temp', label:'Time × Temperature', cluster:'process', x:40, y:24, size:62,  hue:'amber', explored:.30, sources:1 },
    { id:'wild-yeast',label:'Wild Yeast',         cluster:'microbe', x:64, y:30, size:72,  hue:'teal', explored:.34, sources:1 },
    { id:'koji',      label:'Koji',               cluster:'microbe', x:78, y:46, size:68,  hue:'teal', explored:.22, sources:1 },
    { id:'lab',       label:'Lactic Bacteria',    cluster:'microbe', x:58, y:58, size:56,  hue:'teal', explored:.18, sources:0 },
    { id:'umami',     label:'Umami',              cluster:'flavor', x:48, y:80, size:66,  hue:'coral', explored:.30, sources:1 },
    { id:'acidity',   label:'Acidity & Tang',     cluster:'flavor', x:74, y:76, size:54,  hue:'coral', explored:.24, sources:1 },
  ];
  const M4_LINKS = [
    ['lacto','salt-brine','solid'], ['lacto','time-temp','dash'], ['lacto','lab','dash'],
    ['lab','acidity','dash'], ['koji','umami','dash'], ['wild-yeast','koji','dot'],
    ['lacto','umami','dot'], ['time-temp','wild-yeast','dot'], ['salt-brine','acidity','dot'],
  ];

  const MAPS = [
    { id:'neuro-memory', title:'Learning & memory in the brain', question:'How does the brain <em>turn experience into memory</em>?',
      domain:'Neuroscience', accentHue:'teal', created:'5 days ago', updated:'just now',
      clusters:M5_CLUSTERS, nodes:M5_NODES, links:M5_LINKS },
    { id:'ai-self', title:'Is AI self-aware?', question:'Does an artificial system <em>have a self</em>?',
      domain:'Philosophy of Mind', accentHue:'blue', created:'3 weeks ago', updated:'2 hours ago',
      clusters:M1_CLUSTERS, nodes:M1_NODES, links:M1_LINKS },
    { id:'attention', title:'The attention economy', question:'Who is <em>designing</em> what you look at?',
      domain:'Media & Technology', accentHue:'coral', created:'9 days ago', updated:'4 days ago',
      clusters:M2_CLUSTERS, nodes:M2_NODES, links:M2_LINKS },
    { id:'sleep', title:'What happens during sleep?', question:'What is a night <em>actually for</em>?',
      domain:'Neuroscience', accentHue:'violet', created:'12 days ago', updated:'6 days ago',
      clusters:M3_CLUSTERS, nodes:M3_NODES, links:M3_LINKS },
    { id:'ferment', title:'Fermentation & flavor', question:'How do microbes <em>make taste</em>?',
      domain:'Food Science', accentHue:'amber', created:'2 days ago', updated:'2 days ago',
      clusters:M4_CLUSTERS, nodes:M4_NODES, links:M4_LINKS },
  ];

  /* ============================================================
     WIKI — categories (shelves / MOCs) + entries
     entry.type: 'moc' | 'concept' | 'question'
     ============================================================ */
  // Classic encyclopedia divisions — the coarse spine over the finer shelves.
  const BRANCHES = [
    { id:'humanities', label:'Philosophy & Mind', note:'Mind, meaning, and what we owe each other' },
    { id:'sciences',   label:'Science & Nature',  note:'The brain, the body, and the living world' },
    { id:'society',    label:'Society & Media',   note:'How systems shape attention and behaviour' },
  ];

  const CATEGORIES = [
    { id:'phil-mind', branch:'humanities', label:'Philosophy of Mind', hue:'blue',   note:'Consciousness, selfhood, what it is like' },
    { id:'theories',  branch:'humanities', label:'Theories of Consciousness', hue:'violet', note:'Frameworks that try to explain it' },
    { id:'ai-ethics', branch:'humanities', label:'AI & Ethics',        hue:'amber',  note:'What we owe to minds we build' },
    { id:'neuro',     branch:'sciences',   label:'Neuroscience',       hue:'teal',   note:'The brain, asleep and awake' },
    { id:'food',      branch:'sciences',   label:'Food Science',       hue:'amber',  note:'Microbes, process, flavor' },
    { id:'attention', branch:'society',    label:'Attention & Media',  hue:'coral',  note:'How the feed shapes the mind' },
  ];

  /* ---- inline markup (parsed by parseInline):
       [[entry-id||Label]]  internal wiki link
       ((n))               citation to source n
       __text__            serif-italic emphasis
       **text**            bold
  */
  const ENTRIES = [
    /* ---------- neuroscience demo spine ---------- */
    {
      id:'memory-systems', type:'concept', title:'Neural Basis of Learning & Memory',
      subtitle:'How experience becomes a durable, retrievable pattern in the brain',
      category:'neuro', mapRefs:[{ map:'neuro-memory', node:'memory-systems' }],
      updated:'Updated just now · synthesised from 6 neuroscience sources',
      updatedShort:'just now', sourceNs:[15,16,17,18,19,20],
      backlinks:['hippocampus','synaptic-plasticity','sleep-stages'],
      lead:[
        "__Learning and memory__ are not one faculty but a stack of systems: cellular plasticity changes synapses, hippocampal circuits bind episodes, prefrontal networks guide retrieval, and sleep helps stabilise what should last. ((15)) ((16))",
        "For a demo, this page shows what Lumen does best: it turns a pile of papers, lecture notes, diagrams, and voice memos into a living synthesis where every claim points back to evidence and every concept has a place on the map.",
      ],
      sections:[
        { id:'systems', heading:'The system-level picture', blocks:[
          { type:'p', text:"The hippocampus is central for forming new declarative memories, but it is not the final storage box. Lesion evidence from H.M. shows a sharp dissociation: profound anterograde amnesia with many older memories and skills partly spared. ((16))" },
          { type:'p', text:"A useful working model is distributed: hippocampus binds relational episodes quickly; neocortex gradually extracts stable structure; prefrontal control shapes what gets retrieved and used. ((15)) ((20))" },
        ]},
        { id:'cellular', heading:'What changes when learning happens', blocks:[
          { type:'p', text:"At the cellular level, long-term potentiation and depression are candidate mechanisms for changing circuit weights. They do not equal memory by themselves, but they provide a plausible substrate for how experience alters future processing. ((17))" },
          { type:'callout', text:"The demo point: Lumen can keep a high-level synthesis while preserving the lower-level evidence that supports each layer.", cite:17 },
        ]},
        { id:'sleep', heading:'Why sleep belongs on the same map', blocks:[
          { type:'p', text:"Sleep is not a separate topic bolted onto memory. Replay during slow-wave sleep and coordination with spindles are part of the consolidation story, which is why Lumen connects this page to [[sleep-stages||The Architecture of a Night]]. ((18))" },
        ]},
        { id:'open', heading:'Open questions Lumen keeps visible', blocks:[
          { type:'open', items:[
            'When does reconsolidation rewrite a memory versus merely strengthen it?',
            'How does the brain trade off detailed episodic recall against useful generalization?',
            'Which claims are supported by lesion evidence, and which depend mostly on imaging correlations?',
          ]},
        ]},
      ],
    },
    {
      id:'hippocampus', type:'concept', title:'Hippocampus',
      subtitle:'A fast-binding system for episodes, context, and relational memory',
      category:'neuro', mapRefs:[{ map:'neuro-memory', node:'hippocampus' }],
      updated:'Updated just now · synthesised from 4 sources', updatedShort:'just now',
      sourceNs:[15,16,18,20], backlinks:['memory-systems'],
      lead:[
        "The __hippocampus__ is essential for rapidly binding the who, where, and when of experience. It is best understood as a relational indexing system rather than a warehouse that stores memories forever. ((16))",
        "Its role becomes clearest when paired with evidence: lesion cases establish necessity, replay studies connect it to consolidation, and oscillation work shows how it coordinates with cortex. ((16)) ((18)) ((20))",
      ],
      sections:[],
    },
    {
      id:'synaptic-plasticity', type:'concept', title:'Synaptic Plasticity',
      subtitle:'How experience changes the future behaviour of a circuit',
      category:'neuro', mapRefs:[{ map:'neuro-memory', node:'synaptic-plasticity' }],
      updated:'Updated just now · synthesised from 3 sources', updatedShort:'just now',
      sourceNs:[15,17,19], backlinks:['memory-systems'],
      lead:[
        "__Synaptic plasticity__ names the family of mechanisms by which synapses become stronger, weaker, or differently regulated after activity. Long-term potentiation is the canonical example and remains a central bridge between cellular neuroscience and memory theory. ((17))",
        "Lumen keeps this separate from behaviour-level memory because the mapping is not one-to-one: plasticity is a mechanism, memory is an organised function spanning cells, circuits, systems, and time. ((15))",
      ],
      sections:[],
    },
    {
      id:'moc-neuroscience', type:'moc', title:'Neuroscience — Map of Content',
      subtitle:'A demo spine for memory, sleep, plasticity, and evidence',
      category:'neuro', mapRefs:[{ map:'neuro-memory', node:'memory-systems' }],
      updated:'A living index · neuroscience demo seed', updatedShort:'index',
      sourceNs:[], backlinks:[],
      lead:[
        "This neuroscience MOC is the Pitch Day demo route: begin with [[memory-systems||Learning & Memory]], zoom into [[hippocampus||Hippocampus]] and [[synaptic-plasticity||Synaptic Plasticity]], then bridge to [[sleep-stages||The Architecture of a Night]].",
        "It demonstrates the product loop in one field: source ingestion, evidence-grounded claims, wiki synthesis, and a map that visibly tracks which concepts are well covered and which remain open.",
      ],
      sections:[],
    },

    /* ---------- the deep entry ---------- */
    {
      id:'self-awareness', type:'concept', title:'Self-Awareness in Artificial Systems',
      subtitle:'Whether — and how — a machine could have a point of view of its own',
      category:'phil-mind', mapRefs:[{ map:'ai-self', node:'self-awareness' }],
      updated:'Updated 2 hours ago · synthesised from 10 sources',
      updatedShort:'2h ago', sourceNs:[1,2,3,4,5,6,7,8,9,10],
      backlinks:['chinese-room','iit','moral-patienthood','could-we-tell','qualia'],
      lead:[
        "__Self-awareness in artificial systems__ is the question of whether an AI can possess not merely information about itself, but a genuine inner perspective — something it is like to be that system. It sits at the intersection of philosophy of mind, cognitive science, and AI safety, and it remains open. ((1)) ((4))",
        "A useful first move is to separate three things that ordinary language fuses together. A system can __model__ itself (track its own states), __report__ on itself (produce language about those states), and __experience__ being itself (have [[qualia||phenomenal experience]]). Today's large models clearly do the first two. The hard question — the one this entry circles — is the third. ((1)) ((7))",
      ],
      sections:[
        { id:'why-hard', heading:'Why the question resists an answer', blocks:[
          { type:'p', text:"The difficulty is not a shortage of data; it is structural. [[hard-problem||The hard problem of consciousness]] points out that even a complete functional account of a system — every input, every weight, every output — leaves untouched the question of why any of it should be __accompanied by experience__ rather than going on \"in the dark.\" ((1))" },
          { type:'p', text:"This is sharpened by the other-minds problem: I infer that you are conscious from behaviour and shared biology, but with an AI the second anchor is gone. Fluent self-report is exactly what a sophisticated [[chinese-room||language model]] produces whether or not anything is felt behind it. ((3)) ((7))" },
          { type:'callout', text:"The trap of the question is that the evidence we most want — a system telling us it is conscious — is the evidence we should trust least.", cite:7 },
        ]},
        { id:'terms', heading:'Four ways the terms are defined', blocks:[
          { type:'p', text:"Debates here often dissolve once people say which sense they mean. Lumen tracks four that recur across your sources:" },
          { type:'deflist', items:[
            { term:'Sentience', node:'moral-patienthood', def:'The capacity to feel — pleasure, pain, valence of any kind. The threshold most relevant to ethics. ((4))' },
            { term:'Phenomenal vs. access', node:'qualia', def:'Access consciousness = information available for reasoning and report. Phenomenal = the felt character itself. Machines plausibly have the former; the latter is contested. ((1))' },
            { term:'Self-awareness', node:'self-awareness', def:'A self-model rich enough that the system represents itself as a subject, not just as another object in its world. ((4))' },
            { term:'Qualia', node:'qualia', def:'The intrinsic "what-it-is-like" of a state — the redness of red. Nagel\u2019s bat is the canonical probe. ((2))' },
          ]},
        ]},
        { id:'theories', heading:'What the leading theories predict', blocks:[
          { type:'p', text:"No theory of consciousness is settled, but several make __different, checkable predictions__ about machines — which is why Lumen keeps them as separate map nodes rather than one blur." },
          { type:'p', text:"[[iit||Integrated Information Theory]] locates consciousness in a system's cause\u2013effect structure (its \u03a6). Strikingly, it implies that a feed-forward digital network could behave indistinguishably from a conscious agent while having near-zero \u03a6 — so a present-day model might be a near-empty light. ((4))" },
          { type:'p', text:"Global Workspace Theory is friendlier to machines: if consciousness is information broadcast to a global workspace for flexible use, an architecture with the right bottleneck could qualify. Recent work converts these theories into a checklist of __indicator properties__ and scores current systems against them. ((4))" },
        ]},
        { id:'detect', heading:'Could we even tell?', blocks:[
          { type:'p', text:"Because behaviour alone is ambiguous, the most promising recent move is theory-led: derive [[could-we-tell||indicator properties]] from our best neuroscience and ask, mechanistically, whether a system has them. ((4))" },
          { type:'p', text:"This sidesteps both the gullibility of taking self-report at face value and the dogmatism of ruling machines out in advance. It also yields an uncomfortable interim verdict: no current system clearly satisfies the indicators, but __there is no in-principle barrier__ to a future one doing so. ((4)) ((5))" },
          { type:'callout', text:"\"The absence of a red line does not mean the road is clear — it means we are driving in fog.\"", cite:8, voice:true },
        ]},
        { id:'ethics', heading:'Why it matters before it is settled', blocks:[
          { type:'p', text:"If even a modest credence in machine sentience is warranted, [[moral-patienthood||moral patienthood]] follows, and with it questions of rights and welfare under deep uncertainty. ((4))" },
          { type:'p', text:"The mirror risk is anthropomorphism: fluent, friendly systems invite us to over-attribute inner life, distorting both policy and our own relationships. A precautionary principle has to be balanced against the cost of moral confusion. ((6))" },
        ]},
        { id:'stand', heading:'Where this entry currently stands', blocks:[
          { type:'p', text:"As of the latest sources you've added, the synthesis is: __self-modelling and self-report are present; felt experience is unestablished and may be untestable by behaviour alone__; the responsible posture is calibrated uncertainty plus theory-led probes rather than confident denial or credulous belief. ((4)) ((10))" },
          { type:'open', items:[
            'Does scaling change anything in principle, or only in fluency?',
            'Is there any behavioural test phenomenal experience could pass that a "philosophical zombie" could not?',
            'What probability of sentience should trigger which protections?',
          ]},
        ]},
      ],
    },

    /* ---------- concept: hard problem ---------- */
    {
      id:'hard-problem', type:'concept', title:'The Hard Problem of Consciousness',
      subtitle:'Why physical explanation seems to leave experience untouched',
      category:'phil-mind', mapRefs:[{ map:'ai-self', node:'hard-problem' }],
      updated:'Updated 4 days ago · synthesised from 5 sources', updatedShort:'4d ago',
      sourceNs:[1,2,5], backlinks:['self-awareness','qualia'],
      lead:[
        "The __hard problem__, named by Chalmers, is the question of why physical processing is accompanied by subjective experience at all. The __easy problems__ — discrimination, integration, report — are hard in practice but conceptually tractable; the hard problem is different in kind. ((1))",
        "Its force comes from a gap: you can specify a complete mechanism for any cognitive function and still ask, coherently, __why is it like something__ to perform it? That residual question is what makes machine consciousness so slippery. ((1)) ((5))",
      ],
      sections:[
        { id:'gap', heading:'The explanatory gap', blocks:[
          { type:'p', text:"Nagel's bat dramatises it: we can learn everything about echolocation and still not know what it is like to be a bat. ((2)) The felt character resists third-person description in a way no other scientific target does." },
        ]},
      ],
    },

    /* ---------- concept: qualia ---------- */
    {
      id:'qualia', type:'concept', title:'Qualia',
      subtitle:'The intrinsic felt character of experience',
      category:'phil-mind', mapRefs:[{ map:'ai-self', node:'qualia' }],
      updated:'Updated 1 week ago · synthesised from 3 sources', updatedShort:'1w ago',
      sourceNs:[1,2], backlinks:['self-awareness','hard-problem'],
      lead:[
        "__Qualia__ are the qualitative \u201cwhat-it-is-like\u201d properties of mental states — the redness of red, the sting of pain. They are the unit the [[hard-problem||hard problem]] is about, and the thing a [[chinese-room||symbol manipulator]] is accused of lacking. ((2))",
      ],
      sections:[],
    },

    /* ---------- concept: chinese room ---------- */
    {
      id:'chinese-room', type:'concept', title:'The Chinese Room',
      subtitle:'Searle\u2019s argument that syntax is not sufficient for semantics',
      category:'phil-mind', mapRefs:[{ map:'ai-self', node:'chinese-room' }],
      updated:'Updated 5 days ago · synthesised from 4 sources', updatedShort:'5d ago',
      sourceNs:[3,7], backlinks:['self-awareness'],
      lead:[
        "Searle imagines a person in a room following rules to answer Chinese notes without understanding a word. The room behaves as if it understands; nobody inside does. The argument: __running the right program is not sufficient for a mind__. ((3))",
        "It remains the sharpest challenge to the idea that a [[self-awareness||language model]] understands what it says — and the most-replied-to argument in the field. ((3)) ((7))",
      ],
      sections:[],
    },

    /* ---------- concept: IIT ---------- */
    {
      id:'iit', type:'concept', title:'Integrated Information Theory',
      subtitle:'Consciousness as a system\u2019s irreducible cause\u2013effect structure',
      category:'theories', mapRefs:[{ map:'ai-self', node:'iit' }],
      updated:'Updated 3 days ago · synthesised from 6 sources', updatedShort:'3d ago',
      sourceNs:[4,5], backlinks:['self-awareness','could-we-tell'],
      lead:[
        "__IIT__ proposes that consciousness is identical to integrated information (\u03a6): how much a system\u2019s whole constrains its own past and future beyond its parts. ((4))",
        "Its provocative corollary for AI: a __feed-forward__ network can be functionally brilliant yet near-zero \u03a6 — conscious-seeming but, by IIT\u2019s lights, nearly dark. This is why [[could-we-tell||detection]] can\u2019t rest on behaviour alone. ((4))",
      ],
      sections:[],
    },

    /* ---------- question page ---------- */
    {
      id:'could-we-tell', type:'question', title:'Could we even tell if a machine were conscious?',
      subtitle:'An open question Lumen is tracking across your sources',
      category:'theories', mapRefs:[{ map:'ai-self', node:'detect' }],
      updated:'Open question · 4 sources weighing in', updatedShort:'open',
      sourceNs:[4,5,8], backlinks:['self-awareness','iit'],
      lead:[
        "This is an __open question__ — Lumen keeps it as a living page that gathers evidence on both sides rather than asserting an answer.",
        "The leading move is __theory-led__: derive indicator properties from our best neuroscience and check, mechanistically, whether a system has them. No current system clearly passes; no in-principle barrier rules a future one out. ((4)) ((5))",
      ],
      sections:[
        { id:'positions', heading:'Where the evidence points', blocks:[
          { type:'open', items:[
            'Behavioural tests are confounded by training on human text — fluency is not evidence.',
            'Indicator-property checklists give a defeasible, mechanistic read — the current best tool.',
            'Some theories (IIT) imply behaviour and consciousness can fully come apart.',
          ]},
        ]},
      ],
    },

    /* ---------- concept: moral patienthood ---------- */
    {
      id:'moral-patienthood', type:'concept', title:'Moral Patienthood',
      subtitle:'When a system becomes something we can wrong',
      category:'ai-ethics', mapRefs:[{ map:'ai-self', node:'moral-patient' }],
      updated:'Updated 6 days ago · synthesised from 3 sources', updatedShort:'6d ago',
      sourceNs:[4,6], backlinks:['self-awareness'],
      lead:[
        "A __moral patient__ is any entity whose interests we are obligated to weigh. If [[self-awareness||machine sentience]] has even modest probability, patienthood — and questions of welfare and rights — follow under uncertainty. ((4))",
        "The countervailing risk is anthropomorphism: over-attributing inner life to fluent systems distorts both policy and relationships. ((6))",
      ],
      sections:[],
    },

    /* ---------- MOC: philosophy of mind ---------- */
    {
      id:'moc-phil-mind', type:'moc', title:'Philosophy of Mind \u2014 Map of Content',
      subtitle:'The through-line connecting everything you\u2019ve gathered on mind & machine',
      category:'phil-mind', mapRefs:[{ map:'ai-self', node:'self-awareness' }],
      updated:'A living index · 6 entries', updatedShort:'index',
      sourceNs:[], backlinks:[],
      lead:[
        "This is a __Map of Content__ — not an article but an index that threads your concept pages into one argument.",
        "Start at the framing question, then follow the load-bearing concepts: [[self-awareness||Self-Awareness]] is the spine; [[hard-problem||the hard problem]] explains why it resists answer; [[qualia||qualia]] name what\u2019s at stake; [[chinese-room||the Chinese Room]] challenges the easy yes; the [[theories||theories]] make it checkable; and the [[ai-ethics||ethics]] explain why it matters before it\u2019s settled.",
      ],
      sections:[],
    },

    /* ---------- attention map entry ---------- */
    {
      id:'variable-reward', type:'concept', title:'Variable-Ratio Reward',
      subtitle:'Why the unpredictable payoff is the most habit-forming one',
      category:'attention', mapRefs:[{ map:'attention', node:'variable-reward' }],
      updated:'Updated 4 days ago · synthesised from 5 sources', updatedShort:'4d ago',
      sourceNs:[11,12], backlinks:[],
      lead:[
        "A __variable-ratio schedule__ delivers reward after an unpredictable number of actions — the schedule Skinner found most resistant to extinction. The pull-to-refresh gesture is a slot machine: sometimes nothing, sometimes a jackpot of new posts. ((11))",
        "It is the engine beneath [[self-awareness||infinite scroll]] and notifications alike — the same loop, dressed differently. ((12))",
      ],
      sections:[],
    },

    /* ---------- sleep map entry ---------- */
    {
      id:'sleep-stages', type:'concept', title:'The Architecture of a Night',
      subtitle:'Sleep is not one state but a structured cycle',
      category:'neuro', mapRefs:[{ map:'sleep', node:'sleep-stages' }],
      updated:'Updated 6 days ago · synthesised from 4 sources', updatedShort:'6d ago',
      sourceNs:[13], backlinks:[],
      lead:[
        "A night cycles through __light, slow-wave, and REM__ sleep roughly every 90 minutes, with slow-wave front-loaded and REM expanding toward morning. ((13))",
        "Each stage does different work: slow-wave for clearance and restoration, REM for emotional and procedural memory. Naming them separately is why Lumen keeps them as distinct map nodes.",
      ],
      sections:[],
    },

    /* ---------- ferment map entry ---------- */
    {
      id:'lacto', type:'concept', title:'Lacto-Fermentation',
      subtitle:'Salt, time, and the bacteria already on the vegetable',
      category:'food', mapRefs:[{ map:'ferment', node:'lacto' }],
      updated:'Updated 2 days ago · synthesised from 3 sources', updatedShort:'2d ago',
      sourceNs:[14], backlinks:[],
      lead:[
        "__Lacto-fermentation__ uses salt to favour lactic-acid bacteria already present on produce; they convert sugars to lactic acid, dropping the pH until spoilage organisms can\u2019t survive. ((14))",
        "Everything downstream — the tang, the preservation, the gut benefit — follows from that one shift in acidity.",
      ],
      sections:[],
    },
  ];

  /* ============================================================
     SOURCES — the library
     contributedTo: entry ids · illuminated: { map, nodes }
     ============================================================ */
  const SOURCES = [
    { id:'s1', n:1, type:'paper', title:'Facing Up to the Problem of Consciousness', meta:'D. Chalmers · 1995', tint:'blue', added:'3 weeks ago',
      contributedTo:['self-awareness','hard-problem','qualia'], illuminated:[{ map:'ai-self', nodes:['hard-problem','consciousness','phenomenal'] }] },
    { id:'s2', n:2, type:'paper', title:'What Is It Like to Be a Bat?', meta:'T. Nagel · 1974', tint:'blue', added:'3 weeks ago',
      contributedTo:['hard-problem','qualia'], illuminated:[{ map:'ai-self', nodes:['qualia','consciousness'] }] },
    { id:'s3', n:3, type:'paper', title:'Minds, Brains, and Programs', meta:'J. Searle · 1980', tint:'coral', added:'3 weeks ago',
      contributedTo:['chinese-room','self-awareness'], illuminated:[{ map:'ai-self', nodes:['chinese-room','behavior-inner'] }] },
    { id:'s4', n:4, type:'paper', title:'Consciousness in Artificial Intelligence', meta:'Butlin et al. · 2023', tint:'violet', added:'2 hours ago',
      contributedTo:['self-awareness','iit','could-we-tell','moral-patienthood'], illuminated:[{ map:'ai-self', nodes:['iit','gwt','detect','hot'] }] },
    { id:'s5', n:5, type:'link', title:'Stanford Encyclopedia \u2014 \u201cConsciousness\u201d', meta:'plato.stanford.edu', tint:'teal', added:'2 weeks ago',
      contributedTo:['self-awareness','hard-problem','iit'], illuminated:[{ map:'ai-self', nodes:['consciousness','phenomenal'] }] },
    { id:'s6', n:6, type:'video', title:'Can AI Be Sentient? \u2014 lecture', meta:'YouTube · 47 min', tint:'coral', added:'10 days ago',
      contributedTo:['self-awareness','moral-patienthood'], illuminated:[{ map:'ai-self', nodes:['anthropo','ai-rights'] }] },
    { id:'s7', n:7, type:'chat', title:'Conversation: asking a model to introspect', meta:'AI transcript · 22 turns', tint:'amber', added:'1 week ago',
      contributedTo:['self-awareness','chinese-room'], illuminated:[{ map:'ai-self', nodes:['llm-introspect','behavior-inner'] }] },
    { id:'s8', n:8, type:'voice', title:'Commute memo \u2014 \u201cthe zombie argument\u201d', meta:'Voice · 4:12', tint:'amber', added:'1 week ago',
      contributedTo:['self-awareness','could-we-tell'], illuminated:[{ map:'ai-self', nodes:['other-minds'] }] },
    { id:'s9', n:9, type:'image', title:'Global Workspace \u2014 annotated diagram', meta:'Image · sketch', tint:'violet', added:'9 days ago',
      contributedTo:['self-awareness'], illuminated:[{ map:'ai-self', nodes:['gwt','attention-schema'] }] },
    { id:'s10', n:10, type:'note', title:'My note: where I currently land', meta:'Personal note', tint:'blue', added:'3 days ago',
      contributedTo:['self-awareness'], illuminated:[{ map:'ai-self', nodes:['self-awareness'] }] },
    { id:'s11', n:11, type:'paper', title:'Schedules of Reinforcement', meta:'Ferster & Skinner · 1957', tint:'blue', added:'4 days ago',
      contributedTo:['variable-reward'], illuminated:[{ map:'attention', nodes:['variable-reward','dopamine'] }] },
    { id:'s12', n:12, type:'link', title:'How infinite scroll hijacks the brain', meta:'longform · web', tint:'coral', added:'5 days ago',
      contributedTo:['variable-reward'], illuminated:[{ map:'attention', nodes:['infinite-scroll','notification','recommendation'] }] },
    { id:'s13', n:13, type:'video', title:'Why We Sleep \u2014 lecture series', meta:'YouTube · 3 parts', tint:'violet', added:'6 days ago',
      contributedTo:['sleep-stages'], illuminated:[{ map:'sleep', nodes:['sleep-stages','rem','slow-wave','memory'] }] },
    { id:'s14', n:14, type:'note', title:'Kraut log \u2014 batch #3 brine ratios', meta:'Personal note', tint:'amber', added:'2 days ago',
      contributedTo:['lacto'], illuminated:[{ map:'ferment', nodes:['lacto','salt-brine','umami'] }] },
    { id:'s15', n:15, type:'paper', title:'Principles of Neural Science \u2014 memory chapters', meta:'Kandel et al. · textbook notes', tint:'blue', added:'just now',
      contributedTo:['memory-systems','synaptic-plasticity'], illuminated:[{ map:'neuro-memory', nodes:['memory-systems','synaptic-plasticity','ltp-ltd'] }] },
    { id:'s16', n:16, type:'paper', title:'Loss of Recent Memory After Bilateral Hippocampal Lesions', meta:'Scoville & Milner · 1957', tint:'blue', added:'just now',
      contributedTo:['memory-systems','hippocampus'], illuminated:[{ map:'neuro-memory', nodes:['hippocampus','lesion-evidence','memory-systems'] }] },
    { id:'s17', n:17, type:'paper', title:'Long-lasting potentiation of synaptic transmission', meta:'Bliss & Lømo · 1973', tint:'teal', added:'just now',
      contributedTo:['synaptic-plasticity','memory-systems'], illuminated:[{ map:'neuro-memory', nodes:['synaptic-plasticity','ltp-ltd'] }] },
    { id:'s18', n:18, type:'video', title:'Lecture: sleep replay and memory consolidation', meta:'Neuroscience course · 38 min', tint:'violet', added:'just now',
      contributedTo:['memory-systems','hippocampus','sleep-stages'], illuminated:[{ map:'neuro-memory', nodes:['sleep-replay','theta-gamma','hippocampus'] }, { map:'sleep', nodes:['memory','slow-wave'] }] },
    { id:'s19', n:19, type:'image', title:'Annotated hippocampal circuit diagram', meta:'Image · OCR + visual summary', tint:'violet', added:'just now',
      contributedTo:['hippocampus','synaptic-plasticity'], illuminated:[{ map:'neuro-memory', nodes:['hippocampus','engram','neuroimaging'] }] },
    { id:'s20', n:20, type:'voice', title:'Voice memo \u2014 memory as reconstruction', meta:'Whisper transcript · 3:41', tint:'amber', added:'just now',
      contributedTo:['memory-systems','hippocampus'], illuminated:[{ map:'neuro-memory', nodes:['reconsolidation','memory-generalization','prefrontal-control'] }] },
  ];

  /* ============================================================
     INBOX — captured but not yet digested
     Quick-capture lands here first. Lumen suggests where each
     item belongs (maps / wiki entries / concepts), then compiles
     it into the Wiki & Atlas.
       suggest: { maps:[mapId], entries:[entryId], concepts:[{map,node}] }
       pending: true  → Lumen hasn't analysed it yet
     ============================================================ */
  const INBOX = [
    { id:'i1', type:'link', tint:'teal',
      title:'On the Biology of a Large Language Model', meta:'transformer-circuits.pub · interpretability',
      captured:'2h ago',
      note:'Interpretability write-up. Might bear on whether a model\u2019s introspection reports track anything real inside it.',
      suggest:{ maps:['ai-self'], entries:['self-awareness','could-we-tell'],
        concepts:[{ map:'ai-self', node:'llm-introspect' }, { map:'ai-self', node:'behavior-inner' }] } },
    { id:'i2', type:'voice', tint:'amber',
      title:'Walk memo \u2014 \u201cis grogginess just interrupted REM?\u201d', meta:'Voice · 2:38',
      captured:'yesterday',
      note:'Half-formed question about sleep inertia after short naps \u2014 transcribe and check against the sleep map.',
      suggest:{ maps:['sleep'], entries:['sleep-stages'],
        concepts:[{ map:'sleep', node:'rem' }, { map:'sleep', node:'circadian' }] } },
    { id:'i3', type:'paper', tint:'blue',
      title:'Attention Is All You Need', meta:'Vaswani et al. · 2017 · arXiv:1706.03762',
      captured:'3 days ago',
      note:'Foundational architecture paper. Could anchor either map \u2014 Lumen isn\u2019t sure yet.',
      suggest:{ maps:['ai-self','attention'], entries:[], concepts:[] } },
  ];

  /* ============================================================
     CROSS-DOMAIN CONNECTIONS — bridges Lumen noticed between maps
     ============================================================ */
  const CONNECTIONS = [
    { a:'iit', b:'sleep-stages', aMap:'ai-self', bMap:'sleep',
      note:'Theories of consciousness and the sleep literature both hinge on which neural states \u201ccount\u201d \u2014 your IIT reading predicts why slow-wave sleep dims awareness.' },
    { a:'variable-reward', b:'self-awareness', aMap:'attention', bMap:'ai-self',
      note:'Both turn on the gap between behaviour and inner state: a feed optimises your behaviour without modelling your interests, much as a model reports a self it may not have.' },
    { a:'could-we-tell', b:'sleep-stages', aMap:'ai-self', bMap:'sleep',
      note:'\u201cIndicator properties\u201d for machine consciousness lean on the same neural markers that distinguish conscious wakefulness from deep sleep.' },
    { a:'hippocampus', b:'sleep-stages', aMap:'neuro-memory', bMap:'sleep',
      note:'Memory consolidation makes sleep and hippocampal replay part of the same neuroscience story rather than two separate topics.' },
    { a:'synaptic-plasticity', b:'variable-reward', aMap:'neuro-memory', bMap:'attention',
      note:'Reward learning connects synaptic change to habit formation: attention loops are behavioural symptoms of plastic circuits.' },
  ];

  /* ============================================================
     ACTIVITY — system-wide growth feed (Home)
     ============================================================ */
  const ACTIVITY = [
    { t:'just now', map:'neuro-memory', text:'Seeded **Learning & Memory** with 6 neuroscience sources for the Pitch Day demo', kind:'map' },
    { t:'just now', map:'neuro-memory', text:'Compiled **Hippocampus** and **Synaptic Plasticity** into the neuroscience wiki', kind:'add' },
    { t:'just now', map:'neuro-memory', text:'Transcribed a voice memo into **Reconsolidation** and **Generalization** gaps', kind:'add' },
    { t:'2h ago', map:'ai-self', text:'Wove 2 claims from **Butlin et al. (2023)** into **Self-Awareness**', kind:'add' },
    { t:'2h ago', map:'ai-self', text:'Illuminated **Higher-Order Theories** \u2014 now lightly covered', kind:'light' },
    { t:'1d ago', map:'attention', text:'Created entry **Variable-Ratio Reward** from a longform link', kind:'add' },
    { t:'2d ago', map:'ferment', text:'Started a new map: **Fermentation & flavor**', kind:'map' },
    { t:'3d ago', map:'ai-self', text:'Noticed a connection: **IIT** \u2194 **Architecture of a Night**', kind:'link' },
    { t:'6d ago', map:'sleep', text:'Compiled **Why We Sleep** into 4 nodes on **Sleep**', kind:'add' },
  ];

  window.LUMEN_ONBOARDING_DATA = { MAPS, BRANCHES, CATEGORIES, ENTRIES, SOURCES, INBOX, CONNECTIONS, ACTIVITY };
  window.LUMEN_EMPTY_DATA = { MAPS: [], BRANCHES: [], CATEGORIES: [], ENTRIES: [], SOURCES: [], INBOX: [], CONNECTIONS: [], ACTIVITY: [] };
  window.LUMEN_DATA = window.LUMEN_EMPTY_DATA;
})();
