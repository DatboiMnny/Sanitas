/* Sanitas — loose fruit & veg by PLU sticker code (IFPS codes; 9xxxx = organic).
   Nutrition = typical values per 100g, raw. Pesticide residue ranking follows US residue testing (EWG lists). */
(function(){
'use strict';
// type: [name, emoji, kJ, protein, fat, sat, sugar, fibre, sodium mg, residue: high|mid|low, group]
const T = {
  apple:['Apple','🍎',218,0.3,0.2,0,10.4,2.4,1,'high','fruit'], banana:['Banana','🍌',371,1.1,0.3,0.1,12.2,2.6,1,'low','fruit'],
  avocado:['Avocado','🥑',670,2,14.7,2.1,0.7,6.7,7,'low','fruit'], lemon:['Lemon','🍋',121,1.1,0.3,0,2.5,2.8,2,'mid','fruit'],
  lime:['Lime','🍋',126,0.7,0.2,0,1.7,2.8,2,'mid','fruit'], orange:['Orange','🍊',197,0.9,0.1,0,9.4,2.4,0,'mid','fruit'],
  mandarin:['Mandarin','🍊',223,0.8,0.3,0,10.6,1.8,2,'mid','fruit'], grapefruit:['Grapefruit','🍊',176,0.8,0.1,0,6.9,1.6,0,'mid','fruit'],
  grapes:['Grapes','🍇',288,0.7,0.2,0.1,15.5,0.9,2,'high','fruit'], strawberry:['Strawberries','🍓',136,0.7,0.3,0,4.9,2,1,'high','fruit'],
  blueberry:['Blueberries','🫐',240,0.7,0.3,0,10,2.4,1,'high','fruit'], raspberry:['Raspberries','🫐',220,1.2,0.7,0,4.4,6.5,1,'mid','fruit'],
  blackberry:['Blackberries','🫐',180,1.4,0.5,0,4.9,5.3,1,'mid','fruit'], cherry:['Cherries','🍒',263,1.1,0.2,0,12.8,2.1,0,'high','fruit'],
  apricot:['Apricots','🍑',201,1.4,0.4,0,9.2,2,1,'mid','fruit'], nectarine:['Nectarines','🍑',185,1.1,0.3,0,7.9,1.7,0,'high','fruit'],
  peach:['Peaches','🍑',165,0.9,0.3,0,8.4,1.5,0,'high','fruit'], plum:['Plums','🍑',192,0.7,0.3,0,9.9,1.4,0,'mid','fruit'],
  pear:['Pear','🍐',239,0.4,0.1,0,9.8,3.1,1,'high','fruit'], nashi:['Nashi pear','🍐',176,0.5,0.2,0,7,3.6,0,'high','fruit'],
  kiwi:['Kiwifruit','🥝',255,1.1,0.5,0,9,3,3,'low','fruit'], mango:['Mango','🥭',250,0.8,0.4,0.1,13.7,1.6,1,'low','fruit'],
  pineapple:['Pineapple','🍍',209,0.5,0.1,0,9.9,1.4,1,'low','fruit'], watermelon:['Watermelon','🍉',127,0.6,0.2,0,6.2,0.4,1,'low','fruit'],
  rockmelon:['Rockmelon','🍈',142,0.8,0.2,0,7.9,0.9,16,'mid','fruit'], honeydew:['Honeydew melon','🍈',150,0.5,0.1,0,8.1,0.8,18,'low','fruit'],
  papaya:['Papaya','🥭',179,0.5,0.3,0.1,7.8,1.7,8,'low','fruit'], pomegranate:['Pomegranate','🍎',346,1.7,1.2,0.1,13.7,4,3,'mid','fruit'],
  passionfruit:['Passionfruit','🟣',406,2.2,0.7,0.1,11.2,10.4,28,'mid','fruit'], figs:['Figs','🟤',310,0.8,0.3,0.1,16.3,2.9,1,'mid','fruit'],
  dates:['Dates (fresh)','🟤',1160,1.8,0.2,0,66,6.7,1,'mid','fruit'], coconut:['Coconut','🥥',1480,3.3,33.5,29.7,6.2,9,20,'low','fruit'],
  tomato:['Tomato','🍅',75,0.9,0.2,0,2.6,1.2,5,'mid','veg'], cucumber:['Cucumber','🥒',65,0.7,0.1,0,1.7,0.5,2,'mid','veg'],
  capsicum:['Capsicum','🫑',110,1,0.3,0,3.5,2,4,'high','veg'], chilli:['Chilli','🌶️',167,1.9,0.4,0,5.1,1.5,9,'high','veg'],
  carrot:['Carrot','🥕',173,0.9,0.2,0,4.7,2.8,69,'low','veg'], potato:['Potato','🥔',322,2,0.1,0,0.8,2.2,6,'mid','veg'],
  sweetpotato:['Sweet potato','🍠',359,1.6,0.1,0,4.2,3,55,'low','veg'], onion:['Onion','🧅',166,1.1,0.1,0,4.2,1.7,4,'low','veg'],
  springonion:['Spring onion','🧅',134,1.8,0.2,0,2.3,2.6,16,'mid','veg'], garlic:['Garlic','🧄',623,6.4,0.5,0.1,1,2.1,17,'low','veg'],
  ginger:['Ginger','🫚',333,1.8,0.8,0.2,1.7,2,13,'low','veg'], broccoli:['Broccoli','🥦',141,2.8,0.4,0,1.7,2.6,33,'mid','veg'],
  cauliflower:['Cauliflower','🥦',104,1.9,0.3,0,1.9,2,30,'low','veg'], cabbage:['Cabbage','🥬',105,1.3,0.1,0,3.2,2.5,18,'low','veg'],
  brussels:['Brussels sprouts','🥬',179,3.4,0.3,0.1,2.2,3.8,25,'mid','veg'], bokchoy:['Bok choy','🥬',54,1.5,0.2,0,1.2,1,65,'mid','veg'],
  lettuce:['Lettuce','🥬',60,1,0.2,0,1.5,1.6,15,'mid','veg'], spinach:['Spinach','🥬',97,2.9,0.4,0.1,0.4,2.2,79,'high','veg'],
  kale:['Kale','🥬',206,2.9,1.5,0.2,1,4.1,53,'high','veg'], celery:['Celery','🥬',67,0.7,0.2,0,1.3,1.6,80,'high','veg'],
  zucchini:['Zucchini','🥒',71,1.2,0.3,0.1,2.5,1,8,'mid','veg'], eggplant:['Eggplant','🍆',104,1,0.2,0,3.5,3,2,'mid','veg'],
  pumpkin:['Pumpkin','🎃',188,1,0.1,0,2.2,2,4,'mid','veg'], corn:['Sweet corn','🌽',360,3.3,1.4,0.3,6.3,2,15,'low','veg'],
  mushroom:['Mushrooms','🍄',93,3.1,0.3,0,2,1,5,'low','veg'], beans:['Green beans','🫛',130,1.8,0.2,0,3.3,2.7,6,'high','veg'],
  asparagus:['Asparagus','🌱',85,2.2,0.1,0,1.9,2.1,2,'low','veg'], beetroot:['Beetroot','🟣',180,1.6,0.2,0,6.8,2.8,78,'mid','veg'],
  leek:['Leek','🧅',255,1.5,0.3,0,3.9,1.8,20,'mid','veg'], radish:['Radish','🔴',67,0.7,0.1,0,1.9,1.6,39,'mid','veg'],
  snowpeas:['Snow peas','🫛',176,2.8,0.2,0,4,2.6,4,'mid','veg'], peas:['Peas','🫛',339,5.4,0.4,0.1,5.7,5.7,5,'low','veg'],
  fennel:['Fennel','🌿',130,1.2,0.2,0,3.9,3.1,52,'mid','veg']
};
// [type, variant name, codes...]
const C = [
  ['apple','Braeburn',4101,4103],['apple','Fuji',4129,4131],['apple','Gala',4132,4133,4134,4135],['apple','Granny Smith',4017,4018,4138,4139],
  ['apple','Pink Lady (Cripps Pink)',4128,4130],['apple','Red Delicious',4015,4016,4167,4168,3284],['apple','Honeycrisp',3283],['apple','Red Granny Smith',3071],
  ['banana','Cavendish',4011,4186],['banana','Lady finger / baby',4234],['banana','Red',4236],['banana','Green',4231],['banana','Plantain',4235,3287],['banana','',4233,4229,4230],
  ['avocado','Hass',4046,4225,4770],['lemon','',4033,4958,4053,3617],['lemon','Meyer',3626],['lime','',4048],['lime','Key',4305],
  ['grapefruit','Ruby / pink',4280,4283,4493,4286,4289,4496],['grapefruit','White',4292,4295,3158],
  ['grapes','Red seedless',4635,4023],['grapes','Red globe',4636],['grapes','Black',4056,4957,4270],['grapes','Green seedless',4022,4498],['grapes','Green',4274],
  ['strawberry','',4028,4246,4247,4248,4249,4250,4323,4251],['blueberry','',4240],['blackberry','',4239],['raspberry','',4054,4244,4245],
  ['cherry','',4045,3357,3358],['cherry','Rainier / white',4258],['apricot','',4218,3302],
  ['nectarine','Yellow',4035,4036,4377,4378,3437],['nectarine','White',4188,3035,3439],
  ['peach','Yellow',4037,4038,4402,4403,4043,4044,3115],['peach','White',4400,4401,3113],
  ['plum','',4039,4040,4434,4435,4436,4437,4438,4041,4042,4441,4442],
  ['pear','Williams',4024,4409,4410],['pear','Beurre Bosc',4026,4411,4412,4413],['pear','Packham',4421],['pear','Anjou',4025,4416,4417],['nashi','',4406,4407,4408],
  ['kiwi','Green',4030,3280],['kiwi','Gold',3279],['mango','',4311,4584,3114,4312,4961,4051,4959,3488,3365],
  ['pineapple','',4029,4430,4431,4432,3379,3037],['watermelon','',4031,4032,3470,4340,4341,3421],['rockmelon','',4049,4050,4318,4319],['honeydew','',4329,4034],
  ['papaya','',4052,4394,3111],['pomegranate','',4445,3127,3440],['passionfruit','',4397,3312],['figs','',4266,4267,4268],['dates','Medjool',3047],['dates','',4263,3045],
  ['coconut','',4260,4261],
  ['orange','Navel',4012,4013,4384,4385,3107,3110],['orange','Valencia',3108,4014,4388],
  ['mandarin','',4055,4455,3383,3384,3385,4450,3428,3429,3430,4453,3431,3432,3433,3029,3030],
  ['tomato','',4063,4064,4778,3061],['tomato','Truss / on the vine',4664,3148,3335,3336],['tomato','Roma',4087,3282],['tomato','Cocktail',3150],['tomato','Cherry',4796,3146,4797],
  ['cucumber','Continental',4593],['cucumber','Lebanese / short',4062],['cucumber','',4592,4594],
  ['capsicum','Red',4088,4688],['capsicum','Green',4065,4681,3119,3120],['capsicum','Yellow',4680,4689],['chilli','',4686,4772,4693,4694,4709,3125],
  ['carrot','',4560,4094,4562,4561,3424],['potato','Brushed / white',4083,4726,4724,4072,4725],['potato','Red',4073,4723],
  ['sweetpotato','Gold / orange',4816,4074,4817],['sweetpotato','White',4091,3333,3334],
  ['onion','Brown',4093],['onion','Red',4082],['onion','White',4663],['onion','Sweet',4165,4166,4159,4163],['onion','Shallots',4662],['springonion','',4068],
  ['garlic','',4608,4609,3401],['ginger','',4612],['broccoli','',4060,3277,3082,4548],['broccoli','Gai lan / broccolini',4547],
  ['cauliflower','',4572,4079,4573,4566,4567,4568,3436,3320],['cabbage','Green',4069],['cabbage','Red',4554],['cabbage','Wombok / napa',4552],['cabbage','Savoy',4555,3396],
  ['brussels','',4550,3083],['fennel','',4515],['bokchoy','',4545,4544,3163],['lettuce','Iceberg',4061,4634],['lettuce','Cos',4640,3097],
  ['spinach','',4090,3332],['kale','',4627,3095],['celery','',4070,4582,4576,4575],['zucchini','',4067,3418,4086,4756],
  ['eggplant','',4081,4599,4601,3089,3090],['pumpkin','Butternut',4759],['pumpkin','',4735,3134],['corn','',4078,4077,4590,4589],
  ['mushroom','Button',4645,4085],['mushroom','Swiss brown',4648],['mushroom','Portobello',4650],['mushroom','Shiitake',4651],['mushroom','Oyster',4649],['mushroom','Enoki',3103],
  ['beans','',4066,4533,4527,3049,3048,4530],['asparagus','',4080,4521,3392,4524,3079],['beetroot','',4537,4538,4539,4540,3273],['leek','',4629,4630],
  ['radish','',4089,4742,4743],['snowpeas','',4092],['peas','',4674],['peas','Sugar snap',4675]
];
const BY = {};
for (const [type, variant, ...codes] of C) for (const c of codes) BY[c] = {type, variant};

function build(code){
  const s = String(code).trim();
  if (!/^9?\d{4}$/.test(s)) return null;
  const organic = s.length === 5 && s[0] === '9';
  const base = parseInt(organic ? s.slice(1) : s);
  const e = BY[base]; if (!e) return null;
  const t = T[e.type];
  const name = (organic ? 'Organic ' : '') + t[0] + (e.variant ? ` — ${e.variant}` : '');
  return {
    code: s, product_name: name, brands: '', quantity: 'loose', nova_group: 1,
    nutriments: {'energy-kj_100g': t[2], proteins_100g: t[3], fat_100g: t[4], 'saturated-fat_100g': t[5], carbohydrates_100g: null, sugars_100g: t[6], fiber_100g: t[7], sodium_100g: t[8] / 1000},
    ingredients_text: t[0].toLowerCase(), ingredients_analysis_tags: ['en:vegan'],
    categories_tags: [t[10] === 'fruit' ? 'en:fresh-fruits' : 'en:fresh-vegetables'],
    labels_tags: organic ? ['en:organic'] : [], packaging_tags: ['en:loose'],
    _produce: {type: e.type, emoji: t[1], residue: t[9], organic, group: t[10], plu: s},
    _source: 'Built-in fruit & veg list (IFPS PLU codes) · typical nutrition per 100g'
  };
}
// name search, e.g. "banana" or "granny smith"
function search(q){
  const l = q.toLowerCase().trim(); if (l.length < 3) return [];
  const out = [], seen = new Set();
  for (const [type, variant, ...codes] of C){
    const t = T[type]; const full = (t[0] + ' ' + variant).toLowerCase();
    if (full.includes(l) || l.includes(t[0].toLowerCase().replace(/s$/, ''))){
      const key = type + variant; if (seen.has(key)) continue; seen.add(key);
      out.push({code: String(codes[0]), name: t[0] + (variant ? ` — ${variant}` : ''), emoji: t[1]});
    }
  }
  return out.slice(0, 6);
}
window.FSProduce = { build, search };
})();
