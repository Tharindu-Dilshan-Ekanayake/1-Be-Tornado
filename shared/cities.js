import { objectLevel, objectPower, PAY_SHARE, SIZES, STAGES } from './balance.js'
import { mulberry32 } from './rng.js'
import { STAGE_COUNT, stageCenterZ } from './world.js'

/**
 * What every city is made of, and where each thing stands.
 *
 * Shared by client and server: the layout of city `i` comes from a seeded random, so both
 * build exactly the same objects at the same spots with the same ids. That's what lets
 * the server decide on its own what a tornado swallows (from where it knows the player
 * is) without a single object ever being sent over the network: every player has their
 * own copy of every city, and only "you absorbed these ids" goes back.
 *
 * KINDS: every kind of thing, `size` (balance SIZES: what it's worth, the level it needs,
 * how far it reaches) and how it looks (`arch`: the client's builder, `v` its variant,
 * `c` its colours). THEMES: each city's ground, roads and which kinds fill which lots.
 */

// --- Kinds ----------------------------------------------------------------------------

const k = (name, size, arch, v, c, s = 1) => ({ name, size, arch, v, c, s })

export const KINDS = {
  // Farm
  hay: k('Hay Bale', 'tiny', 'bale', 'square', ['#e8c25a', '#c9a03a']),
  pumpkin: k('Pumpkin', 'tiny', 'pumpkin', '', ['#ff8a1e', '#3a8a2a']),
  woodFence: k('Fence', 'tiny', 'fence', 'wood', ['#9a6a3a', '#7a4a22']),
  appleTree: k('Apple Tree', 'small', 'tree', 'round', ['#7a4a2a', '#3fae3a', '#ff4a4a']),
  scarecrow: k('Scarecrow', 'small', 'scarecrow', '', ['#c9a03a', '#3a6ad8', '#e8c25a']),
  cow: k('Cow', 'small', 'cow', '', ['#ffffff', '#222222', '#ffb0c0']),
  tractor: k('Tractor', 'medium', 'truck', 'tractor', ['#3aa83a', '#ffd21f', '#222222']),
  shed: k('Shed', 'medium', 'shed', 'shed', ['#c84a2a', '#ffffff', '#7a3a22']),
  barn: k('Barn', 'large', 'barn', '', ['#d8322a', '#ffffff', '#5a3a2a']),
  farmhouse: k('Farmhouse', 'large', 'house', 'gable', ['#fff2d8', '#8a4a2a', '#5aa8ff']),
  silo: k('Silo', 'huge', 'tower', 'silo', ['#d0d6de', '#5a8ad8', '#8a96a6']),
  pickup: k('Pickup Truck', 'small', 'car', 'pickup', ['#d83a3a', '#2a2a2a', '#bfe6ff']),
  // Suburb
  mailbox: k('Mailbox', 'tiny', 'mailbox', '', ['#3a6ad8', '#ff3a3a']),
  hydrant: k('Fire Hydrant', 'tiny', 'hydrant', '', ['#ff3a2a', '#ffd21f']),
  bush: k('Bush', 'tiny', 'bush', 'round', ['#3fae3a', '#2f8a2a']),
  oakTree: k('Oak Tree', 'small', 'tree', 'round', ['#7a4a2a', '#4fc63a', '#3fae3a']),
  sedan: k('Car', 'small', 'car', 'sedan', ['#3a7ae8', '#222222', '#bfe6ff']),
  minivan: k('Minivan', 'small', 'car', 'van', ['#f2f2f2', '#222222', '#bfe6ff']),
  schoolBus: k('School Bus', 'medium', 'truck', 'bus', ['#ffc21f', '#222222', '#bfe6ff']),
  garage: k('Garage', 'medium', 'shed', 'garage', ['#e8e2d8', '#8a96a6', '#5a5a66']),
  house: k('House', 'large', 'house', 'gable', ['#9fd8ff', '#c84a3a', '#ffffff']),
  bigHouse: k('Big House', 'large', 'house', 'twostory', ['#ffe0b0', '#5a5a8a', '#ffffff']),
  apartment: k('Apartment Block', 'huge', 'tower', 'apartment', ['#e8a87a', '#ffffff', '#8a5a4a']),
  streetLamp: k('Street Lamp', 'tiny', 'lamp', 'street', ['#3a3f4a', '#fff2a8']),
  // Downtown
  cone: k('Traffic Cone', 'tiny', 'cone', '', ['#ff7a1e', '#ffffff']),
  trafficLight: k('Traffic Light', 'tiny', 'lamp', 'traffic', ['#2a2f3a', '#3fe85a']),
  bench: k('Bench', 'tiny', 'bench', '', ['#8a5a32', '#3a3f4a']),
  taxi: k('Taxi', 'small', 'car', 'taxi', ['#ffd21f', '#222222', '#bfe6ff']),
  streetTree: k('Street Tree', 'small', 'tree', 'round', ['#6a4a2a', '#3fbf4a', '#2f9a3a'], 0.85),
  cityBus: k('City Bus', 'medium', 'truck', 'bus', ['#2f8ae8', '#222222', '#bfe6ff']),
  kiosk: k('News Kiosk', 'medium', 'shed', 'kiosk', ['#2fae5a', '#ffffff', '#ffd21f']),
  shop: k('Shop', 'large', 'shop', 'store', ['#f2e8d8', '#e8423a', '#5aa8ff']),
  cafe: k('Cafe', 'large', 'shop', 'store', ['#ffd8b0', '#2fae5a', '#5aa8ff']),
  office: k('Office Block', 'huge', 'tower', 'office', ['#8fb8d8', '#ffffff', '#4a6a8a']),
  glassTower: k('Glass Tower', 'huge', 'tower', 'glass', ['#5ab8e8', '#e8f6ff', '#2a5a8a']),
  // Desert
  tumbleweed: k('Tumbleweed', 'tiny', 'bush', 'tumble', ['#c9a35a', '#a8823a']),
  desertRock: k('Rock', 'tiny', 'rock', '', ['#c98a5a', '#a86a3a']),
  woodBarrel: k('Barrel', 'tiny', 'barrel', 'wood', ['#9a6a3a', '#5a3a22']),
  cactus: k('Cactus', 'small', 'tree', 'cactus', ['#3a9a3a', '#2f7a2f', '#ff5fa8']),
  jeep: k('Jeep', 'small', 'car', 'jeep', ['#c9a35a', '#2a2a2a', '#bfe6ff']),
  signpost: k('Signpost', 'small', 'sign', 'wood', ['#8a5a32', '#e8c48a']),
  oilTruck: k('Tanker Truck', 'medium', 'truck', 'tanker', ['#e8e8e8', '#d83a3a', '#2a2a2a']),
  tent: k('Tent', 'medium', 'shed', 'tent', ['#e8d8b0', '#c84a2a', '#8a5a32']),
  adobe: k('Adobe House', 'large', 'house', 'adobe', ['#e8a86a', '#c9824a', '#5aa8ff']),
  saloon: k('Saloon', 'large', 'shop', 'saloon', ['#b87a4a', '#7a4a22', '#ffd21f']),
  mesa: k('Rock Tower', 'huge', 'tower', 'mesa', ['#d8824a', '#b8623a', '#f2b07a']),
  // Snow
  snowman: k('Snowman', 'tiny', 'snowman', '', ['#ffffff', '#ff7a1e', '#2a2a2a']),
  iceBlock: k('Ice Block', 'tiny', 'crate', 'ice', ['#bff0ff', '#8fd8ff']),
  snowBush: k('Snowy Bush', 'tiny', 'bush', 'snow', ['#3a8a4a', '#ffffff']),
  pine: k('Pine Tree', 'small', 'tree', 'pine', ['#6a4a2a', '#2f8a4a', '#ffffff']),
  snowmobile: k('Snowmobile', 'small', 'car', 'sled', ['#e8322a', '#2a2a2a', '#bfe6ff']),
  bigSnowman: k('Giant Snowman', 'small', 'snowman', '', ['#ffffff', '#ff7a1e', '#2a2a2a'], 1.7),
  igloo: k('Igloo', 'medium', 'shed', 'igloo', ['#f2fbff', '#bfe0f2', '#2a3a4a']),
  snowplow: k('Snowplow', 'medium', 'truck', 'box', ['#ff9a1e', '#2a2a2a', '#bfe6ff']),
  cabin: k('Log Cabin', 'large', 'house', 'cabin', ['#9a6a3a', '#ffffff', '#ffd27a']),
  lodge: k('Ski Lodge', 'large', 'shop', 'lodge', ['#7a4a2a', '#ffffff', '#ffd27a']),
  chalet: k('Chalet', 'huge', 'tower', 'chalet', ['#8a5a32', '#ffffff', '#ffd27a']),
  // Park
  balloons: k('Balloons', 'tiny', 'lamp', 'balloon', ['#ff5fa8', '#ffd21f', '#3fb8ff']),
  trashCan: k('Trash Can', 'tiny', 'barrel', 'trash', ['#3a8a4a', '#2a5a3a']),
  candyCart: k('Cotton Candy Cart', 'small', 'stall', '', ['#ff9ad8', '#ffffff', '#5fd8ff']),
  teacup: k('Teacup Ride', 'small', 'statue', 'teacup', ['#ff7ad2', '#ffd21f', '#ffffff']),
  funTree: k('Party Tree', 'small', 'tree', 'round', ['#7a4a2a', '#ff7ad2', '#ffd21f']),
  carousel: k('Carousel', 'medium', 'shed', 'carousel', ['#ff5f8a', '#ffffff', '#ffd21f']),
  booth: k('Ticket Booth', 'medium', 'shed', 'kiosk', ['#ffd21f', '#e8322a', '#ffffff']),
  funhouse: k('Funhouse', 'large', 'shop', 'funhouse', ['#9a5cff', '#ffd21f', '#ff5fa8']),
  arcade: k('Arcade', 'large', 'shop', 'club', ['#2a2f5a', '#3fe8ff', '#ff5fd2']),
  dropTower: k('Drop Tower', 'huge', 'tower', 'drop', ['#e8e8f2', '#ff3a5a', '#ffd21f']),
  // Beach
  umbrella: k('Beach Umbrella', 'tiny', 'umbrella', '', ['#ff5a5a', '#ffffff', '#ffffff']),
  beachChair: k('Beach Chair', 'tiny', 'chair', '', ['#3fb8ff', '#ffffff']),
  sandcastle: k('Sandcastle', 'tiny', 'rock', 'castle', ['#f2d49a', '#e2b672']),
  palm: k('Palm Tree', 'small', 'tree', 'palm', ['#a8743f', '#3fbf4a', '#8a5a2a']),
  buggy: k('Beach Buggy', 'small', 'car', 'buggy', ['#ff7a1e', '#2a2a2a', '#bfe6ff']),
  surfboard: k('Surfboard', 'small', 'sign', 'surf', ['#3fd8ff', '#ffffff']),
  speedboat: k('Speedboat', 'medium', 'truck', 'boat', ['#ffffff', '#2f6ae8', '#bfe6ff']),
  tikiHut: k('Tiki Hut', 'medium', 'shed', 'hut', ['#c9a35a', '#8a5a2a', '#ffd27a']),
  beachHouse: k('Beach House', 'large', 'house', 'beach', ['#bff6ff', '#ff7a6a', '#ffffff']),
  snackShack: k('Snack Shack', 'large', 'shop', 'store', ['#ffe28a', '#3fb8ff', '#ff5a5a']),
  hotel: k('Beach Hotel', 'huge', 'tower', 'hotel', ['#fff2e0', '#3fd8e8', '#e8a87a']),
  // Industrial
  steelDrum: k('Oil Drum', 'tiny', 'barrel', 'steel', ['#3a6ad8', '#2a4a8a']),
  crate: k('Crate', 'tiny', 'crate', 'wood', ['#c9a35a', '#8a6a3a']),
  pipes: k('Pipe Stack', 'tiny', 'rock', 'pipes', ['#8a96a6', '#5a6676']),
  forklift: k('Forklift', 'small', 'car', 'forklift', ['#ffc21f', '#2a2a2a', '#bfe6ff']),
  generator: k('Generator', 'small', 'crate', 'generator', ['#5a6676', '#ffd21f']),
  dumpTruck: k('Dump Truck', 'medium', 'truck', 'dump', ['#ffb21e', '#2a2a2a', '#bfe6ff']),
  container: k('Shipping Container', 'medium', 'crate', 'container', ['#e8422a', '#b8321f']),
  warehouse: k('Warehouse', 'large', 'shop', 'warehouse', ['#a8b0bc', '#5a6676', '#ffd21f']),
  workshop: k('Workshop', 'large', 'shop', 'warehouse', ['#c97a4a', '#5a4a3a', '#ffffff']),
  factory: k('Factory', 'huge', 'tower', 'factory', ['#b8705a', '#5a5a66', '#ffd21f']),
  // Candy
  gumdrop: k('Gumdrop', 'tiny', 'gumdrop', '', ['#ff5fa8', '#ffffff']),
  candyCane: k('Candy Cane', 'tiny', 'candycane', '', ['#ffffff', '#ff3a4a']),
  donut: k('Donut', 'tiny', 'rock', 'donut', ['#e8b07a', '#ff7ad2']),
  lollipop: k('Lollipop Tree', 'small', 'tree', 'lolli', ['#ffffff', '#ff5fd2', '#5fd8ff']),
  candyCar: k('Candy Car', 'small', 'car', 'sedan', ['#ff9ad8', '#7a3a5a', '#ffffff']),
  cupcake: k('Cupcake', 'small', 'statue', 'cupcake', ['#ffd8b0', '#ff7ad2', '#ff3a4a']),
  iceCreamTruck: k('Ice Cream Truck', 'medium', 'truck', 'box', ['#ffffff', '#ff9ad8', '#bfe6ff']),
  gingerHut: k('Gingerbread Hut', 'medium', 'shed', 'shed', ['#b8703a', '#ffffff', '#ff5fa8']),
  candyHouse: k('Candy House', 'large', 'house', 'candy', ['#ffd0e8', '#ff5fa8', '#ffffff']),
  sweetShop: k('Sweet Shop', 'large', 'shop', 'store', ['#c8f0ff', '#ff7ad2', '#ffffff']),
  candyTower: k('Candy Tower', 'huge', 'tower', 'candy', ['#ff9ad8', '#ffffff', '#7ad8ff']),
  // Medieval
  torch: k('Torch', 'tiny', 'lamp', 'torch', ['#6a4a2a', '#ff8a1e']),
  hayRound: k('Haystack', 'tiny', 'bale', 'round', ['#e8c25a', '#c9a03a']),
  well: k('Well', 'tiny', 'rock', 'well', ['#8a8a96', '#6a4a2a']),
  cart: k('Cart', 'small', 'car', 'cart', ['#9a6a3a', '#5a3a22', '#e8c25a']),
  knight: k('Knight Statue', 'small', 'statue', 'knight', ['#b8c0cc', '#e8322a', '#ffd21f']),
  medievalTent: k('Market Tent', 'medium', 'shed', 'tent', ['#ffffff', '#3a6ad8', '#ffd21f']),
  wagon: k('Wagon', 'medium', 'truck', 'wagon', ['#9a6a3a', '#ffffff', '#5a3a22']),
  cottage: k('Cottage', 'large', 'house', 'cottage', ['#f2e8d0', '#7a4a22', '#5a3a22']),
  tavern: k('Tavern', 'large', 'shop', 'tavern', ['#e8d8b0', '#7a3a22', '#ffd21f']),
  castleTower: k('Castle Tower', 'huge', 'tower', 'castle', ['#a8acb8', '#3a6ad8', '#8a8e9a']),
  // Harbor
  buoy: k('Buoy', 'tiny', 'barrel', 'buoy', ['#ff3a2a', '#ffffff']),
  van: k('Delivery Van', 'small', 'car', 'van', ['#ffffff', '#2a2a2a', '#bfe6ff']),
  fishStand: k('Fish Stand', 'small', 'stall', '', ['#3fb8ff', '#ffffff', '#ff7a1e']),
  tugboat: k('Tugboat', 'medium', 'truck', 'boat', ['#e8322a', '#ffffff', '#2a2a2a']),
  blueContainer: k('Cargo Container', 'medium', 'crate', 'container', ['#2f6ae8', '#1f4aa8']),
  fishMarket: k('Fish Market', 'large', 'shop', 'warehouse', ['#5ab8c8', '#2a5a6a', '#ffffff']),
  containerStack: k('Container Stack', 'huge', 'tower', 'containers', ['#e8422a', '#2f8ae8', '#3fbf4a']),
  // Neon
  neonSign: k('Neon Sign', 'tiny', 'sign', 'neon', ['#2a2f3a', '#ff3ad2']),
  vending: k('Vending Machine', 'tiny', 'crate', 'vending', ['#e8322a', '#3fe8ff']),
  neonLamp: k('Neon Lamp', 'tiny', 'lamp', 'neon', ['#2a2f3a', '#3fe8ff']),
  sportsCar: k('Sports Car', 'small', 'car', 'sports', ['#ff2a6a', '#1a1a22', '#3fe8ff']),
  neonTree: k('Neon Palm', 'small', 'tree', 'palm', ['#2a2f3a', '#ff3ad2', '#3fe8ff']),
  arcadeCab: k('Arcade Machine', 'small', 'statue', 'arcade', ['#2a2f5a', '#3fe8ff', '#ff3ad2']),
  limo: k('Limo', 'medium', 'truck', 'limo', ['#1a1a22', '#ffd21f', '#3fe8ff']),
  foodTruck: k('Food Truck', 'medium', 'truck', 'box', ['#ff5fd2', '#2a2a2a', '#3fe8ff']),
  club: k('Night Club', 'large', 'shop', 'club', ['#1f1f3a', '#ff3ad2', '#3fe8ff']),
  neonTower: k('Neon Tower', 'huge', 'tower', 'neon', ['#1f2240', '#3fe8ff', '#ff3ad2']),
  // Volcano
  lavaRock: k('Lava Rock', 'tiny', 'rock', 'lava', ['#3a2a2a', '#ff6a1e']),
  obsidian: k('Obsidian', 'tiny', 'crystal', '', ['#2a1f3a', '#7a5aff']),
  ashBush: k('Ash Bush', 'tiny', 'bush', 'ash', ['#5a5a5a', '#ff6a1e']),
  charredTree: k('Charred Tree', 'small', 'tree', 'dead', ['#2a1f1a', '#ff6a1e', '#3a2a22']),
  mineCart: k('Mine Cart', 'small', 'car', 'mine', ['#5a5a66', '#ff8a1e', '#3a2a22']),
  fireStatue: k('Fire Idol', 'small', 'statue', 'idol', ['#3a2a2a', '#ff6a1e', '#ffd21f']),
  drill: k('Lava Drill', 'medium', 'truck', 'drill', ['#ffb21e', '#3a3a46', '#ff6a1e']),
  magmaHut: k('Magma Hut', 'medium', 'shed', 'hut', ['#3a2a2a', '#ff6a1e', '#ffd21f']),
  forge: k('Forge', 'large', 'shop', 'forge', ['#4a3a3a', '#ff6a1e', '#2a1f1a']),
  stoneHouse: k('Stone House', 'large', 'house', 'stone', ['#5a4a4a', '#2a1f1a', '#ff8a1e']),
  obsidianTower: k('Obsidian Tower', 'huge', 'tower', 'spire', ['#2a1f3a', '#ff6a1e', '#7a5aff']),
  // Crystal
  gem: k('Gem', 'tiny', 'crystal', '', ['#c08cff', '#5ac8ff']),
  geode: k('Geode Rock', 'tiny', 'rock', 'geode', ['#6a5a7a', '#ff7ad2']),
  glowShroom: k('Glow Shroom', 'tiny', 'mushroom', '', ['#e8e0ff', '#5ae8ff']),
  crystalTree: k('Crystal Tree', 'small', 'tree', 'crystal', ['#8a7aa8', '#c08cff', '#5ac8ff']),
  gemCart: k('Gem Cart', 'small', 'car', 'mine', ['#5a5a66', '#c08cff', '#3a2a22']),
  crystalStatue: k('Crystal Statue', 'small', 'statue', 'crystal', ['#c08cff', '#5ac8ff', '#ffffff']),
  crystalHut: k('Crystal Hut', 'medium', 'shed', 'dome', ['#d8c8ff', '#8a5aff', '#5ac8ff']),
  drillCart: k('Mining Drill', 'medium', 'truck', 'drill', ['#ffd21f', '#3a3a46', '#c08cff']),
  gemHouse: k('Gem House', 'large', 'house', 'stone', ['#a89ac8', '#6a4aa8', '#5ac8ff']),
  gemShop: k('Gem Shop', 'large', 'shop', 'store', ['#e8e0ff', '#8a5aff', '#5ac8ff']),
  crystalSpire: k('Crystal Spire', 'huge', 'tower', 'spire', ['#c08cff', '#5ac8ff', '#ffffff']),
  // Sky
  cloudPuff: k('Cloud Puff', 'tiny', 'bush', 'cloud', ['#ffffff', '#e8f2ff']),
  kite: k('Kite', 'tiny', 'sign', 'kite', ['#8a96a6', '#ff5a5a']),
  skyBalloon: k('Balloon Post', 'tiny', 'lamp', 'balloon', ['#5fd8ff', '#ffd21f', '#ff7ad2']),
  cloudTree: k('Cloud Tree', 'small', 'tree', 'cloud', ['#c9b8e8', '#ffffff', '#ffe0f8']),
  airBalloon: k('Hot Air Balloon', 'small', 'statue', 'balloon', ['#ff5a5a', '#ffd21f', '#9a6a3a']),
  propCar: k('Propeller Car', 'small', 'car', 'hover', ['#5fd8ff', '#2a2a2a', '#ffffff']),
  blimp: k('Blimp', 'medium', 'truck', 'blimp', ['#d8e0ec', '#ff5a5a', '#2a2a2a']),
  skyHut: k('Sky Dome', 'medium', 'shed', 'dome', ['#ffffff', '#5fd8ff', '#ffd21f']),
  skyHouse: k('Sky House', 'large', 'house', 'flat', ['#ffffff', '#5fd8ff', '#ffd21f']),
  windmill: k('Windmill', 'large', 'shop', 'windmill', ['#f2e8d8', '#c84a3a', '#ffffff']),
  skyTower: k('Sky Tower', 'huge', 'tower', 'glass', ['#e8f6ff', '#5fd8ff', '#ffd21f']),
  // Moon
  moonRock: k('Moon Rock', 'tiny', 'rock', 'moon', ['#a8acb8', '#7a7e8a']),
  flag: k('Flag', 'tiny', 'sign', 'flag', ['#d8dce4', '#e8322a']),
  antenna: k('Antenna', 'tiny', 'lamp', 'antenna', ['#d8dce4', '#ff3a3a']),
  rover: k('Moon Rover', 'small', 'car', 'rover', ['#f2f2f2', '#3a3a46', '#ffd21f']),
  satellite: k('Satellite Dish', 'small', 'statue', 'satellite', ['#f2f2f2', '#8a96a6', '#3a6ad8']),
  solarPanel: k('Solar Panel', 'small', 'sign', 'solar', ['#d8dce4', '#2a4aa8']),
  lander: k('Lunar Lander', 'medium', 'truck', 'lander', ['#ffd21f', '#d8dce4', '#3a3a46']),
  habitat: k('Habitat Pod', 'medium', 'shed', 'dome', ['#f2f2f2', '#8fd8ff', '#ff7a1e']),
  lab: k('Moon Lab', 'large', 'shop', 'lab', ['#f2f2f2', '#3a6ad8', '#ff7a1e']),
  moonDome: k('Moon Dome', 'large', 'house', 'dome', ['#e8ecf2', '#8fd8ff', '#3a6ad8']),
  commsTower: k('Comms Tower', 'huge', 'tower', 'comms', ['#d8dce4', '#ff3a3a', '#3a6ad8']),
  // Jungle
  fern: k('Fern', 'tiny', 'bush', 'fern', ['#2f9a3a', '#5ad84a']),
  idol: k('Stone Idol', 'tiny', 'statue', 'idol', ['#8a9a7a', '#3fae3a', '#ffd21f'], 0.6),
  jungleRock: k('Mossy Rock', 'tiny', 'rock', '', ['#7a8a6a', '#3fae3a']),
  jungleTree: k('Jungle Tree', 'small', 'tree', 'palm', ['#6a4a2a', '#2f9a3a', '#5ad84a'], 1.2),
  safariJeep: k('Safari Jeep', 'small', 'car', 'jeep', ['#5a7a3a', '#2a2a2a', '#bfe6ff']),
  totem: k('Totem', 'small', 'statue', 'totem', ['#a8743f', '#e8322a', '#3fbf4a']),
  jungleHut: k('Jungle Hut', 'medium', 'shed', 'hut', ['#8a6a3a', '#3fae3a', '#ffd27a']),
  raft: k('Raft', 'medium', 'truck', 'raft', ['#a8743f', '#ffffff', '#6a4a2a']),
  templeHouse: k('Temple House', 'large', 'house', 'stone', ['#9aa88a', '#5a7a4a', '#ffd21f']),
  junglemarket: k('Jungle Market', 'large', 'shop', 'tavern', ['#c9a35a', '#3fae3a', '#ff7a1e']),
  ruinTower: k('Ruined Tower', 'huge', 'tower', 'ruin', ['#8a9a7a', '#3fae3a', '#6a7a5a']),
  // Cyber
  holoSign: k('Holo Sign', 'tiny', 'sign', 'neon', ['#1a1f2a', '#3fe8ff']),
  drone: k('Drone', 'tiny', 'crate', 'drone', ['#2a2f3a', '#3fe8ff']),
  cyberLamp: k('Cyber Lamp', 'tiny', 'lamp', 'neon', ['#1a1f2a', '#ff3ad2']),
  hoverCar: k('Hover Car', 'small', 'car', 'hover', ['#e8eef8', '#1a1f2a', '#3fe8ff']),
  robot: k('Robot', 'small', 'statue', 'robot', ['#c8d0dc', '#3fe8ff', '#5a6676']),
  dataTree: k('Data Tree', 'small', 'tree', 'crystal', ['#1a1f2a', '#3fe8ff', '#ff3ad2']),
  hoverBus: k('Hover Bus', 'medium', 'truck', 'hoverbus', ['#e8eef8', '#3fe8ff', '#1a1f2a']),
  pod: k('Sleep Pod', 'medium', 'shed', 'pod', ['#e8eef8', '#3fe8ff', '#1a1f2a']),
  cyberShop: k('Cyber Shop', 'large', 'shop', 'club', ['#1a1f2a', '#3fe8ff', '#ff3ad2']),
  cyberHouse: k('Cyber House', 'large', 'house', 'flat', ['#d8e0ec', '#3fe8ff', '#1a1f2a']),
  megaTower: k('Mega Tower', 'huge', 'tower', 'neon', ['#141826', '#ff3ad2', '#3fe8ff']),
  // Alien
  alienEgg: k('Alien Egg', 'tiny', 'crystal', 'egg', ['#8aff5a', '#3a8a2a']),
  glowPlant: k('Glow Plant', 'tiny', 'mushroom', '', ['#c8ff8a', '#ff5fd2']),
  alienCrystal: k('Alien Crystal', 'tiny', 'crystal', '', ['#5aff8a', '#3fe8ff']),
  alienTree: k('Alien Tree', 'small', 'tree', 'mushroom', ['#7a5aa8', '#5aff8a', '#ff5fd2']),
  alienRover: k('Alien Rover', 'small', 'car', 'rover', ['#8a5aff', '#2a2a3a', '#5aff8a']),
  alienStatue: k('Alien Statue', 'small', 'statue', 'alien', ['#5aff8a', '#2a2a3a', '#ffffff']),
  ufo: k('UFO', 'medium', 'truck', 'ufo', ['#c8d0dc', '#5aff8a', '#8a5aff']),
  alienPod: k('Alien Pod', 'medium', 'shed', 'pod', ['#8a5aff', '#5aff8a', '#2a2a3a']),
  alienHouse: k('Alien House', 'large', 'house', 'dome', ['#a87aff', '#5aff8a', '#2a2a3a']),
  alienLab: k('Alien Lab', 'large', 'shop', 'lab', ['#7a5aa8', '#5aff8a', '#ff5fd2']),
  alienSpire: k('Alien Spire', 'huge', 'tower', 'spire', ['#8a5aff', '#5aff8a', '#ff5fd2']),
  // Cosmic
  starShard: k('Star Shard', 'tiny', 'crystal', 'star', ['#ffe27a', '#ffffff']),
  orb: k('Energy Orb', 'tiny', 'orb', '', ['#8a7aff', '#ffffff']),
  meteor: k('Meteor', 'tiny', 'rock', 'meteor', ['#5a4a5a', '#ff7a3a']),
  starTree: k('Star Tree', 'small', 'tree', 'crystal', ['#3a2a6a', '#ffe27a', '#ff7ad2']),
  cometCar: k('Comet Car', 'small', 'car', 'hover', ['#3a2a6a', '#ffe27a', '#8a7aff']),
  planetStatue: k('Planet Statue', 'small', 'statue', 'planet', ['#ff9a4a', '#8a7aff', '#ffe27a']),
  spaceship: k('Spaceship', 'medium', 'truck', 'ship', ['#e8eef8', '#8a7aff', '#ffe27a']),
  portalPod: k('Portal Pod', 'medium', 'shed', 'pod', ['#3a2a6a', '#ffe27a', '#8a7aff']),
  starHouse: k('Star House', 'large', 'house', 'dome', ['#3a2a6a', '#ffe27a', '#8a7aff']),
  observatory: k('Observatory', 'large', 'shop', 'lab', ['#e8eef8', '#3a2a6a', '#ffe27a']),
  cosmicSpire: k('Cosmic Spire', 'huge', 'tower', 'spire', ['#3a2a6a', '#ffe27a', '#ff7ad2']),
  // Every city
  trophy: k('Giant Trophy', 'trophy', 'trophy', '', ['#ffd21f', '#ffb000', '#fff2a8']),
}
for (const [id, kind] of Object.entries(KINDS)) kind.id = id

// --- Themes ---------------------------------------------------------------------------

/**
 * Each city's look and contents. `ground` and `lot` are the island's grass and the lots'
 * own ground; `road` / `roadStyle` its streets ('asphalt' with lines, 'path' plain);
 * `edge` the island's cliffs. The kind lists fill the lots by size; `lots` weights pick
 * what each of the 16 lots is. `sky` is [top, horizon] for when you're there.
 */
export const THEMES = {
  farm: {
    ground: '#5fc94a', lot: '#72d655', road: '#c9975a', roadStyle: 'path', edge: '#7a5236', field: '#8a5a32',
    tiny: ['hay', 'pumpkin', 'woodFence'], small: ['appleTree', 'scarecrow', 'cow'], medium: ['tractor', 'shed'],
    large: ['barn', 'farmhouse'], huge: ['silo'], vehicle: ['pickup', 'tractor'], prop: ['hay', 'woodFence'],
    lots: { field: 5, yard: 4, park: 2, pasture: 3 }, sky: ['#5ab8ff', '#dff3ff'],
  },
  suburb: {
    ground: '#55c24a', lot: '#6fd25a', road: '#54596a', roadStyle: 'asphalt', edge: '#7a5236', field: '#8a5a32',
    tiny: ['mailbox', 'hydrant', 'bush'], small: ['oakTree', 'sedan', 'minivan'], medium: ['schoolBus', 'garage'],
    large: ['house', 'bigHouse'], huge: ['apartment'], vehicle: ['sedan', 'minivan', 'schoolBus'], prop: ['streetLamp', 'hydrant', 'mailbox'],
    lots: { houses: 8, park: 3, parking: 2, mixed: 2 }, sky: ['#4aa8ff', '#e2f4ff'],
  },
  downtown: {
    ground: '#c7ccd6', lot: '#d8dce4', road: '#3e4250', roadStyle: 'asphalt', edge: '#6a6e7a', field: '#8a8e9a',
    tiny: ['cone', 'bench', 'trafficLight'], small: ['taxi', 'sedan', 'streetTree'], medium: ['cityBus', 'kiosk'],
    large: ['shop', 'cafe'], huge: ['office', 'glassTower'], vehicle: ['taxi', 'sedan', 'cityBus'], prop: ['trafficLight', 'cone', 'streetLamp'],
    lots: { towers: 8, plaza: 3, parking: 2, mixed: 3 }, sky: ['#5a8aff', '#ffd8c0'],
  },
  desert: {
    ground: '#ecc884', lot: '#f2d49a', road: '#b8864a', roadStyle: 'path', edge: '#b8703a', field: '#d8a86a',
    tiny: ['tumbleweed', 'desertRock', 'woodBarrel'], small: ['cactus', 'jeep', 'signpost'], medium: ['oilTruck', 'tent'],
    large: ['adobe', 'saloon'], huge: ['mesa'], vehicle: ['jeep', 'oilTruck'], prop: ['woodBarrel', 'tumbleweed'],
    lots: { houses: 5, forest: 3, yard: 3, plaza: 2 }, sky: ['#3f9aff', '#ffe8c0'],
  },
  snow: {
    ground: '#eef6ff', lot: '#f8fbff', road: '#8a9aac', roadStyle: 'path', edge: '#8a9aac', field: '#d8e6f2',
    tiny: ['snowman', 'iceBlock', 'snowBush'], small: ['pine', 'snowmobile', 'bigSnowman'], medium: ['igloo', 'snowplow'],
    large: ['cabin', 'lodge'], huge: ['chalet'], vehicle: ['snowmobile', 'snowplow'], prop: ['snowBush', 'streetLamp'],
    lots: { houses: 6, forest: 5, plaza: 2, parking: 1 }, sky: ['#7ab8f2', '#f2f8ff'],
  },
  park: {
    ground: '#6fd65a', lot: '#ffd8ec', road: '#ff9ac8', roadStyle: 'path', edge: '#9a6a4a', field: '#ffe6a8',
    tiny: ['balloons', 'trashCan', 'bench'], small: ['candyCart', 'teacup', 'funTree'], medium: ['carousel', 'booth'],
    large: ['funhouse', 'arcade'], huge: ['dropTower'], vehicle: ['candyCart', 'buggy'], prop: ['balloons', 'trashCan'],
    lots: { plaza: 6, park: 4, mixed: 3 }, sky: ['#7a8aff', '#ffd8f0'],
  },
  beach: {
    ground: '#f2dca0', lot: '#f8e6b4', road: '#d8b884', roadStyle: 'path', edge: '#c9a46a', field: '#efd290',
    tiny: ['umbrella', 'beachChair', 'sandcastle'], small: ['palm', 'buggy', 'surfboard'], medium: ['speedboat', 'tikiHut'],
    large: ['beachHouse', 'snackShack'], huge: ['hotel'], vehicle: ['buggy', 'speedboat'], prop: ['umbrella', 'beachChair'],
    lots: { houses: 4, park: 4, plaza: 4, mixed: 2 }, sky: ['#3fb8ff', '#ffe8d0'],
  },
  industrial: {
    ground: '#9aa0aa', lot: '#b0b6c0', road: '#4a4e5a', roadStyle: 'asphalt', edge: '#5a5e6a', field: '#8a8e98',
    tiny: ['steelDrum', 'crate', 'pipes'], small: ['forklift', 'generator', 'trafficLight'], medium: ['dumpTruck', 'container'],
    large: ['warehouse', 'workshop'], huge: ['factory'], vehicle: ['forklift', 'dumpTruck'], prop: ['cone', 'steelDrum'],
    lots: { yard: 6, parking: 3, towers: 4, mixed: 2 }, sky: ['#8aa0c0', '#f2dcc8'],
  },
  candy: {
    ground: '#ffc8e8', lot: '#fff0f8', road: '#ffffff', roadStyle: 'path', edge: '#c8784a', field: '#ffe0b0',
    tiny: ['gumdrop', 'candyCane', 'donut'], small: ['lollipop', 'candyCar', 'cupcake'], medium: ['iceCreamTruck', 'gingerHut'],
    large: ['candyHouse', 'sweetShop'], huge: ['candyTower'], vehicle: ['candyCar', 'iceCreamTruck'], prop: ['candyCane', 'gumdrop'],
    lots: { houses: 6, park: 4, plaza: 3 }, sky: ['#ff9ad8', '#fff0c8'],
  },
  medieval: {
    ground: '#6ab84a', lot: '#82c860', road: '#a8a296', roadStyle: 'path', edge: '#6a6a72', field: '#b8904a',
    tiny: ['woodBarrel', 'crate', 'torch'], small: ['pine', 'cart', 'knight'], medium: ['medievalTent', 'wagon'],
    large: ['cottage', 'tavern'], huge: ['castleTower'], vehicle: ['cart', 'wagon'], prop: ['torch', 'hayRound'],
    lots: { houses: 6, field: 2, plaza: 3, forest: 3 }, sky: ['#5aa0f2', '#ffeacc'],
  },
  harbor: {
    ground: '#a8b0b8', lot: '#c0c6ce', road: '#4a505c', roadStyle: 'asphalt', edge: '#5a6270', field: '#9aa4ae',
    tiny: ['buoy', 'crate', 'steelDrum'], small: ['forklift', 'van', 'fishStand'], medium: ['tugboat', 'blueContainer'],
    large: ['warehouse', 'fishMarket'], huge: ['containerStack'], vehicle: ['van', 'forklift'], prop: ['buoy', 'crate'],
    lots: { yard: 7, parking: 3, plaza: 2, mixed: 2 }, sky: ['#4a9ae8', '#e8f0f8'],
  },
  neon: {
    ground: '#2a2f48', lot: '#363c5a', road: '#16182a', roadStyle: 'asphalt', edge: '#1f2238', field: '#2a2f48',
    tiny: ['neonSign', 'vending', 'neonLamp'], small: ['sportsCar', 'neonTree', 'arcadeCab'], medium: ['limo', 'foodTruck'],
    large: ['club', 'arcade'], huge: ['neonTower'], vehicle: ['sportsCar', 'limo'], prop: ['neonLamp', 'neonSign'],
    lots: { towers: 8, plaza: 3, parking: 3 }, sky: ['#1a1446', '#ff7ac8'], night: true,
  },
  volcano: {
    ground: '#4a3a3a', lot: '#5a4646', road: '#2a2020', roadStyle: 'path', edge: '#2a1f1f', field: '#ff6a1e',
    tiny: ['lavaRock', 'obsidian', 'ashBush'], small: ['charredTree', 'mineCart', 'fireStatue'], medium: ['drill', 'magmaHut'],
    large: ['forge', 'stoneHouse'], huge: ['obsidianTower'], vehicle: ['mineCart', 'drill'], prop: ['lavaRock', 'torch'],
    lots: { houses: 5, field: 3, yard: 3, forest: 2 }, sky: ['#5a1f2a', '#ffa860'], night: true,
  },
  crystal: {
    ground: '#5a4a7a', lot: '#6a5a8a', road: '#3a2f5a', roadStyle: 'path', edge: '#3a2f4a', field: '#8a7aaa',
    tiny: ['gem', 'geode', 'glowShroom'], small: ['crystalTree', 'gemCart', 'crystalStatue'], medium: ['crystalHut', 'drillCart'],
    large: ['gemHouse', 'gemShop'], huge: ['crystalSpire'], vehicle: ['gemCart', 'drillCart'], prop: ['glowShroom', 'gem'],
    lots: { houses: 5, forest: 4, plaza: 3 }, sky: ['#3a1f6a', '#e0b8ff'], night: true,
  },
  sky: {
    ground: '#ffffff', lot: '#eef6ff', road: '#bfe0ff', roadStyle: 'path', edge: '#d8e6f8', field: '#ffe8f8',
    tiny: ['cloudPuff', 'kite', 'skyBalloon'], small: ['cloudTree', 'airBalloon', 'propCar'], medium: ['blimp', 'skyHut'],
    large: ['skyHouse', 'windmill'], huge: ['skyTower'], vehicle: ['propCar', 'blimp'], prop: ['skyBalloon', 'cloudPuff'],
    lots: { houses: 6, park: 4, plaza: 3 }, sky: ['#6ac8ff', '#fff6ff'],
  },
  moon: {
    ground: '#c4c8d2', lot: '#d4d8e0', road: '#8a8e9a', roadStyle: 'path', edge: '#7a7e8a', field: '#b0b4be',
    tiny: ['moonRock', 'flag', 'antenna'], small: ['rover', 'satellite', 'solarPanel'], medium: ['lander', 'habitat'],
    large: ['lab', 'moonDome'], huge: ['commsTower'], vehicle: ['rover', 'lander'], prop: ['antenna', 'moonRock'],
    lots: { houses: 6, yard: 4, plaza: 3 }, sky: ['#05061a', '#3a4a7a'], night: true,
  },
  jungle: {
    ground: '#3f9a3a', lot: '#4fae46', road: '#9a7a4a', roadStyle: 'path', edge: '#5a4a2a', field: '#6a8a3a',
    tiny: ['fern', 'idol', 'jungleRock'], small: ['jungleTree', 'safariJeep', 'totem'], medium: ['jungleHut', 'raft'],
    large: ['templeHouse', 'junglemarket'], huge: ['ruinTower'], vehicle: ['safariJeep', 'raft'], prop: ['fern', 'torch'],
    lots: { forest: 6, houses: 4, plaza: 3 }, sky: ['#4ab8a8', '#e8ffd8'],
  },
  cyber: {
    ground: '#1f2433', lot: '#2a3044', road: '#10131c', roadStyle: 'asphalt', edge: '#161a26', field: '#2a3044',
    tiny: ['holoSign', 'drone', 'cyberLamp'], small: ['hoverCar', 'robot', 'dataTree'], medium: ['hoverBus', 'pod'],
    large: ['cyberShop', 'cyberHouse'], huge: ['megaTower'], vehicle: ['hoverCar', 'hoverBus'], prop: ['cyberLamp', 'holoSign'],
    lots: { towers: 8, plaza: 3, parking: 3 }, sky: ['#0a1030', '#3fe8ff'], night: true,
  },
  alien: {
    ground: '#6a4a9a', lot: '#7a5aaa', road: '#3a2a5a', roadStyle: 'path', edge: '#3a2a4a', field: '#5aff8a',
    tiny: ['alienEgg', 'glowPlant', 'alienCrystal'], small: ['alienTree', 'alienRover', 'alienStatue'], medium: ['ufo', 'alienPod'],
    large: ['alienHouse', 'alienLab'], huge: ['alienSpire'], vehicle: ['alienRover', 'ufo'], prop: ['glowPlant', 'alienCrystal'],
    lots: { houses: 5, forest: 4, plaza: 4 }, sky: ['#2a0a4a', '#8aff9a'], night: true,
  },
  cosmic: {
    ground: '#1a1440', lot: '#261e58', road: '#0a0820', roadStyle: 'path', edge: '#120e2e', field: '#3a2a7a',
    tiny: ['starShard', 'orb', 'meteor'], small: ['starTree', 'cometCar', 'planetStatue'], medium: ['spaceship', 'portalPod'],
    large: ['starHouse', 'observatory'], huge: ['cosmicSpire'], vehicle: ['cometCar', 'spaceship'], prop: ['orb', 'starShard'],
    lots: { houses: 4, plaza: 5, forest: 4 }, sky: ['#05031a', '#7a5aff'], night: true,
  },
}

/** Every kind a city's theme can hold, for its page of the Index. */
export function themeKinds(theme) {
  const t = THEMES[theme]
  const ids = new Set([...t.tiny, ...t.small, ...t.medium, ...t.large, ...t.huge, ...t.vehicle, ...t.prop])
  return [...ids]
}

// --- The city grid ---------------------------------------------------------------------

/**
 * Every city is the same grid: 4 x 4 lots of LOT metres with ROAD-wide streets between
 * them (at -ROAD_AT, 0 and +ROAD_AT across and along), a walkway round the edge. The
 * Landmark stands in a round plaza at the middle crossing, the four Giant Trophies at
 * the four diagonal crossings. The bridge comes in up the middle street from the south.
 */
export const LOT = 27
export const ROAD = 8
export const ROAD_AT = LOT + ROAD
/** Each lot row's / column's centre: lots span 4-31 m and 39-66 m either side of the middle. */
export const LOT_CENTERS = [-(ROAD_AT + ROAD / 2 + LOT / 2), -(ROAD / 2 + LOT / 2), ROAD / 2 + LOT / 2, ROAD_AT + ROAD / 2 + LOT / 2]
export const PLAZA_RADIUS = 12
const TROPHY_SPOTS = [
  [-ROAD_AT, -ROAD_AT],
  [ROAD_AT, -ROAD_AT],
  [-ROAD_AT, ROAD_AT],
  [ROAD_AT, ROAD_AT],
]
const TROPHY_CLEAR = 6

/** The size of a spatial-grid cell (metres) for "what's near here". */
const CELL = 8
const GRID_HALF = 72
const GRID_COLS = Math.ceil((GRID_HALF * 2) / CELL)

const pick = (rand, list) => list[Math.floor(rand() * list.length)]

function pickWeighted(rand, weights) {
  const entries = Object.entries(weights)
  let r = rand() * entries.reduce((s, [, w]) => s + w, 0)
  for (const [key, w] of entries) {
    r -= w
    if (r < 0) return key
  }
  return entries[entries.length - 1][0]
}

/** The road a lot faces: the angle (yaw) something in it turns to face the nearest street. */
function facingRoad(lx, lz) {
  // Lots in the outer columns face inwards; inner ones face the middle street.
  const ax = Math.abs(lx)
  const az = Math.abs(lz)
  if (ax > az) return lx > 0 ? -Math.PI / 2 : Math.PI / 2
  return lz > 0 ? Math.PI : 0
}

/**
 * Fills one lot. `put(kindId, x, z, rot, scale)` places something (local to the island's
 * centre); it refuses spots in the plaza or by a trophy. Every generator keeps things
 * inside the lot with a little margin.
 */
const LOT_FILLERS = {
  houses(t, rand, put, cx, cz) {
    const face = facingRoad(cx, cz)
    for (const [dx, dz] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) {
      put(pick(rand, t.large), cx + dx, cz + dz, face, 0.9 + rand() * 0.15)
    }
    for (const [dx, dz] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) put(pick(rand, t.small), cx + dx, cz + dz, rand() * 6.28)
    for (let i = 0; i < 6; i += 1) put(pick(rand, t.tiny), cx + (rand() - 0.5) * 24, cz + (rand() - 0.5) * 24, rand() * 6.28)
  },
  towers(t, rand, put, cx, cz) {
    const twin = rand() < 0.6
    if (twin) {
      const along = rand() < 0.5
      for (const s of [-1, 1]) put(pick(rand, t.huge), cx + (along ? s * 6.6 : 0), cz + (along ? 0 : s * 6.6), facingRoad(cx, cz), 0.9 + rand() * 0.2)
    } else {
      put(pick(rand, t.huge), cx, cz, facingRoad(cx, cz), 1.1 + rand() * 0.2)
    }
    for (const [dx, dz] of [[-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5]]) put(pick(rand, t.tiny), cx + dx, cz + dz, rand() * 6.28)
    for (let i = 0; i < 3; i += 1) put(pick(rand, t.small), cx + (rand() < 0.5 ? -1 : 1) * 11.5, cz + (rand() - 0.5) * 18, rand() * 6.28)
    put(pick(rand, t.medium), cx + (rand() - 0.5) * 18, cz + (rand() < 0.5 ? -1 : 1) * 11, facingRoad(cx, cz))
  },
  field(t, rand, put, cx, cz) {
    // Rows of small stuff in the dirt, a couple of bigger things standing in it.
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        if (rand() < 0.2) continue
        put(t.tiny[(r + c) % 2], cx - 10 + c * 5 + (rand() - 0.5), cz - 10 + r * 5 + (rand() - 0.5), rand() * 6.28)
      }
    }
    put(t.small[1] ?? t.small[0], cx + (rand() - 0.5) * 8, cz + (rand() - 0.5) * 8, rand() * 6.28)
    put(pick(rand, t.medium), cx + 9 * (rand() < 0.5 ? -1 : 1), cz + 9 * (rand() < 0.5 ? -1 : 1), rand() * 6.28)
  },
  yard(t, rand, put, cx, cz) {
    const face = facingRoad(cx, cz)
    put(pick(rand, t.large), cx - 6, cz - 5, face, 1.05)
    put(pick(rand, t.huge), cx + 6.5, cz - 5.5, face, 0.95)
    put(pick(rand, t.medium), cx - 6, cz + 7, rand() * 6.28)
    put(pick(rand, t.medium), cx + 5, cz + 7, rand() * 6.28)
    for (let i = 0; i < 7; i += 1) put(pick(rand, t.tiny), cx + (rand() - 0.5) * 24, cz + (rand() - 0.5) * 24, rand() * 6.28)
    put(pick(rand, t.small), cx + 11, cz + 11, rand() * 6.28)
  },
  park(t, rand, put, cx, cz) {
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (r === 1 && c === 1) continue
        put(t.small[r === 0 ? 0 : t.small.length - 1 - (c % t.small.length)] ?? t.small[0], cx - 8 + c * 8 + (rand() - 0.5) * 2, cz - 8 + r * 8 + (rand() - 0.5) * 2, rand() * 6.28)
      }
    }
    put(pick(rand, t.medium), cx, cz, rand() * 6.28)
    for (let i = 0; i < 6; i += 1) put(pick(rand, t.tiny), cx + (rand() - 0.5) * 22, cz + (rand() - 0.5) * 22, rand() * 6.28)
  },
  parking(t, rand, put, cx, cz) {
    const along = Math.abs(cx) > Math.abs(cz)
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 5; i += 1) {
        if (rand() < 0.15) continue
        const a = -9.6 + i * 4.8
        const b = row === 0 ? -5 : 5
        put(pick(rand, t.vehicle.filter((id) => KINDS[id].size === 'small').concat(t.small[0])), cx + (along ? b : a), cz + (along ? a : b), (along ? Math.PI / 2 : 0) + (row ? Math.PI : 0))
      }
    }
    for (let i = 0; i < 5; i += 1) put(pick(rand, t.tiny), cx + (rand() - 0.5) * 24, cz + (rand() < 0.5 ? -1 : 1) * 11.5, rand() * 6.28)
    put(pick(rand, t.medium), cx + (along ? 0 : 11), cz + (along ? 11 : 0), along ? 0 : Math.PI / 2)
  },
  plaza(t, rand, put, cx, cz) {
    put(pick(rand, t.medium), cx, cz, rand() * 6.28)
    for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) put(pick(rand, t.small), cx + dx, cz + dz, rand() * 6.28)
    put(pick(rand, t.large), cx + (rand() < 0.5 ? -1 : 1) * 8.5, cz, facingRoad(cx, cz), 0.85)
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      put(pick(rand, t.tiny), cx + Math.cos(a) * 11.5, cz + Math.sin(a) * 11.5, a)
    }
  },
  forest(t, rand, put, cx, cz) {
    const tree = t.small[0]
    for (let i = 0; i < 12; i += 1) put(tree, cx + (rand() - 0.5) * 23, cz + (rand() - 0.5) * 23, rand() * 6.28, 0.85 + rand() * 0.4)
    for (let i = 0; i < 6; i += 1) put(pick(rand, t.tiny), cx + (rand() - 0.5) * 24, cz + (rand() - 0.5) * 24, rand() * 6.28)
    put(pick(rand, t.medium), cx + (rand() - 0.5) * 10, cz + (rand() - 0.5) * 10, rand() * 6.28)
  },
  pasture(t, rand, put, cx, cz) {
    // A fence round the edge, animals inside, a shed in one corner.
    const fence = t.tiny[t.tiny.length - 1]
    for (let i = 0; i < 6; i += 1) {
      const a = -11 + i * 4.4
      put(fence, cx + a, cz - 12, 0)
      put(fence, cx + a, cz + 12, 0)
      put(fence, cx - 12, cz + a, Math.PI / 2)
      put(fence, cx + 12, cz + a, Math.PI / 2)
    }
    for (let i = 0; i < 5; i += 1) put(t.small[t.small.length - 1], cx + (rand() - 0.5) * 16, cz + (rand() - 0.5) * 16, rand() * 6.28)
    put(pick(rand, t.medium), cx + 6, cz + 6, rand() * 6.28)
  },
  mixed(t, rand, put, cx, cz) {
    const face = facingRoad(cx, cz)
    put(pick(rand, t.large), cx - 6.5, cz - 6.5, face)
    put(pick(rand, t.large), cx + 6.5, cz + 6.5, face)
    put(pick(rand, t.medium), cx + 6.5, cz - 6.5, rand() * 6.28)
    put(pick(rand, t.medium), cx - 6.5, cz + 6.5, rand() * 6.28)
    for (let i = 0; i < 4; i += 1) put(pick(rand, t.small), cx + (rand() - 0.5) * 22, cz + (rand() - 0.5) * 22, rand() * 6.28)
    for (let i = 0; i < 6; i += 1) put(pick(rand, t.tiny), cx + (rand() - 0.5) * 24, cz + (rand() - 0.5) * 24, rand() * 6.28)
  },
}

/** Ids: city index * 1000 + its object number. */
export const ID_STRIDE = 1000
export const stageOfId = (id) => Math.floor(id / ID_STRIDE)

/**
 * Builds city `index`'s layout. Pure and deterministic (seeded by the index), so it's
 * cached: `stageLayout(i)` is the same object every time it's asked for.
 *
 * Returns `{ index, theme, cz, objects, big, trophies, landmark, lots, grid }`: `objects`
 * `[{ id, n, kind, size, x, z, rot, s, level, power, r, hp, respawn }]` (world x/z),
 * `big` the numbers of the ones with hp, `lots` `[{ type, x, z }]` (world centres, each
 * LOT square) for the client's ground decor.
 */
function buildLayout(index) {
  const stage = STAGES[index]
  const theme = THEMES[stage.theme]
  const rand = mulberry32(1000 + index * 7919)
  const cz = stageCenterZ(index)
  const objects = []

  const blocked = (lx, lz, r) => {
    if (Math.hypot(lx, lz) < PLAZA_RADIUS + r) return true
    for (const [tx, tz] of TROPHY_SPOTS) if (Math.hypot(lx - tx, lz - tz) < TROPHY_CLEAR + r) return true
    return Math.abs(lx) > 67 - r || Math.abs(lz) > 67 - r
  }

  /** What's been placed in the current lot (or street), so nothing lands inside anything else. */
  let nearby = []
  const add = (kindId, lx, lz, rot = 0, s = 1, extra = null) => {
    const kind = KINDS[kindId]
    if (!kind) return null
    const size = kind.size
    const scale = s * kind.s
    const r = SIZES[size].r * Math.min(1.4, scale)
    if (!extra && blocked(lx, lz, r * 0.6)) return null
    if (!extra && nearby.some((o) => Math.hypot(o.lx - lx, o.lz - lz) < (o.r + r) * 0.72)) return null
    if (objects.length >= ID_STRIDE - 1) return null
    nearby.push({ lx, lz, r })
    const o = {
      id: index * ID_STRIDE + objects.length,
      n: objects.length,
      kind: kindId,
      size,
      x: Math.round(lx * 100) / 100,
      z: Math.round((cz + lz) * 100) / 100,
      rot: Math.round(rot * 1000) / 1000,
      s: Math.round(scale * 1000) / 1000,
      level: objectLevel(index, size),
      power: objectPower(index, size),
      r,
      hp: SIZES[size].hp ?? 0,
      respawn: SIZES[size].respawn,
      wins: 0,
      ...extra,
    }
    objects.push(o)
    return o
  }

  // The Landmark, and the four Giant Trophies.
  const landmark = add('trophy', 0, 0, 0, 1, {
    kind: `landmark:${stage.theme}`,
    size: 'landmark',
    level: objectLevel(index, 'landmark'),
    power: objectPower(index, 'landmark'),
    r: SIZES.landmark.r,
    hp: SIZES.landmark.hp,
    respawn: SIZES.landmark.respawn,
  })
  // (`extra` places them however crowded the spot: they always stand.)
  const trophies = TROPHY_SPOTS.map(([tx, tz]) => add('trophy', tx, tz, Math.PI, 1, {}))

  // The lots.
  const lots = []
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lx = LOT_CENTERS[col]
      const lz = LOT_CENTERS[row]
      const type = pickWeighted(rand, theme.lots)
      lots.push({ type, x: lx, z: cz + lz })
      nearby = []
      LOT_FILLERS[type](theme, rand, (kindId, x, z, rot, s) => add(kindId, x, z, rot, s), lx, lz)
    }
  }

  // Traffic on the streets, and street furniture along their edges.
  const roads = [-ROAD_AT, 0, ROAD_AT]
  for (const at of roads) {
    for (let seg = 0; seg < 4; seg += 1) {
      const mid = LOT_CENTERS[seg]
      for (const vertical of [true, false]) {
        nearby = []
        const n = 1 + (rand() < 0.5 ? 1 : 0)
        for (let i = 0; i < n; i += 1) {
          const along = mid + (rand() - 0.5) * 16
          const lane = rand() < 0.5 ? -2 : 2
          const vehicle = pick(rand, theme.vehicle)
          const rot = vertical ? (lane > 0 ? 0 : Math.PI) : lane > 0 ? Math.PI / 2 : -Math.PI / 2
          if (vertical) add(vehicle, at + lane, along, rot)
          else add(vehicle, along, at + lane, rot)
        }
        for (const side of [-1, 1]) {
          if (rand() < 0.35) continue
          const prop = pick(rand, theme.prop)
          const along = mid + (rand() - 0.5) * 18
          if (vertical) add(prop, at + side * 4.6, along, 0)
          else add(prop, along, at + side * 4.6, Math.PI / 2)
        }
      }
    }
  }

  // The spatial grid: object numbers by CELL-square cell over the island.
  const cells = Array.from({ length: GRID_COLS * GRID_COLS }, () => [])
  const big = []
  for (const o of objects) {
    const c = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((o.x + GRID_HALF) / CELL)))
    const r = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((o.z - cz + GRID_HALF) / CELL)))
    cells[r * GRID_COLS + c].push(o.n)
    if (o.hp > 0) big.push(o.n)
  }

  return {
    index,
    theme: stage.theme,
    cz,
    objects,
    big,
    trophies: trophies.filter(Boolean).map((o) => o.n),
    landmark: landmark.n,
    lots,
    grid: { cells, cz },
  }
}

/** How many things you destroy in city `index` for each pay of its Wins (PAY_SHARE of all of them). */
export const payStep = (index) => Math.ceil(stageLayout(index).objects.length * PAY_SHARE)

const cache = new Map()
export function stageLayout(index) {
  if (index < 0 || index >= STAGE_COUNT) return null
  let layout = cache.get(index)
  if (!layout) {
    layout = buildLayout(index)
    cache.set(index, layout)
  }
  return layout
}

/** The object with world id `id`, or null. */
export function objectById(id) {
  const layout = stageLayout(stageOfId(id))
  return layout?.objects[id % ID_STRIDE] ?? null
}

/**
 * Calls `visit(object)` for every object of `layout` that might be within `reach` of the
 * segment from (x0, z0) to (x1, z1) (cells overlapping its box, padded by `reach` and the
 * biggest footprint). The caller does the exact distance test.
 */
export function forObjectsNear(layout, x0, z0, x1, z1, reach, visit) {
  const pad = reach + SIZES.landmark.r
  const cz = layout.cz
  const c0 = Math.max(0, Math.floor((Math.min(x0, x1) - pad + GRID_HALF) / CELL))
  const c1 = Math.min(GRID_COLS - 1, Math.floor((Math.max(x0, x1) + pad + GRID_HALF) / CELL))
  const r0 = Math.max(0, Math.floor((Math.min(z0, z1) - cz - pad + GRID_HALF) / CELL))
  const r1 = Math.min(GRID_COLS - 1, Math.floor((Math.max(z0, z1) - cz + pad + GRID_HALF) / CELL))
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      for (const n of layout.grid.cells[r * GRID_COLS + c]) visit(layout.objects[n])
    }
  }
}

/** Distance from (px, pz) to the segment (x0, z0)-(x1, z1). */
export function segmentDistance(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0
  const dz = z1 - z0
  const len2 = dx * dx + dz * dz
  const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / len2)) : 0
  return Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t))
}

/**
 * How close (centre to centre) your funnel must come to swallow `o`: your radius plus
 * most of its footprint. The server allows `slack` more for where it thinks you are.
 */
export const reachFor = (radius, o, slack = 0) => radius + o.r * 0.6 + slack
