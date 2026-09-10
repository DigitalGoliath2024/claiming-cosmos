import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wiki = path.join(root, "resources", "wiki");
const assets =
  "C:/Users/tvern/.cursor/projects/c-Users-tvern-Downloads-Ancientfront/assets";
const prefix =
  "c__Users_tvern_AppData_Roaming_Cursor_User_workspaceStorage_8f9779be3b654f52ed8bbea2ebf0e8de_images_";
const site = "https://maraudersea.com";

function copyAsset(name, destRel) {
  const src = path.join(assets, prefix + name);
  const dest = path.join(wiki, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyLocalAsset(name, destRel) {
  const dest = path.join(wiki, destRel);
  const candidates = [
    path.join(assets, name),
    path.join(root, "assets", name),
    dest,
  ];
  const src = candidates.find((p) => fs.existsSync(p));
  if (!src) {
    throw new Error(`Missing wiki image ${name}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (path.resolve(src) !== path.resolve(dest)) {
    fs.copyFileSync(src, dest);
  }
}

function mapExt(m) {
  return m.ext ?? "jpg";
}

function mapImg(m) {
  return `${m.slug}.${mapExt(m)}`;
}

const maps = [
  {
    slug: "collision",
    name: "Collision",
    localSrc: "map-generator/assets/maps/_collision-color.jpg",
    ext: "jpg",
    alt: "Collision map original art: two planets smashing together with space visible through crust cracks",
    title: "Collision map — Marauder's Sea wiki",
    desc: "Collision in Claiming Cosmos: two planets in mid-impact, rifts you can fly through, and a debris field between worlds.",
    folklore:
      "Two worlds missed the miss. The green one still has lakes that spill into black; the brown one is magma and dust. Through the big cracks you can see stars — and a hull can follow that light into the interior.",
    play: "Voidships and Landers use the rifts as highways from open space into each planet. Enclosed lakes that never open stay Harbor water. Fight the debris field for the crossing, then hold a rim Starport or a lakeside Harbor.",
    seeAlso: [
      ["Comet's Pass", "../maps/cometspass.html"],
      ["Verners System", "../maps/verners-system.html"],
    ],
  },
  {
    slug: "cometspass",
    name: "Comet's Pass",
    localSrc: "map-generator/assets/maps/_cometspass-color.png",
    ext: "png",
    alt: "Comet's Pass original map art: shattered worlds and a comet trail through the void",
    title: "Comet's Pass map — Marauder's Sea wiki",
    desc: "Comet's Pass original art: a shattered system with a bright trail ships can run between worlds.",
    folklore:
      "A comet did not politely pass. It cut a road. The glowing wake is still the fastest line between the broken globes, and every captain who uses it pretends they were first.",
    play: "The trail is the prize. Starports on the rims feed Voidships into the pass. Lakes on the green shards still want Harbors. Do not empty a world to hold the wake — someone will land behind you.",
    seeAlso: [
      ["Collision", "../maps/collision.html"],
      ["Shatterwake", "../maps/shatterwake.html"],
    ],
  },
  {
    slug: "verners-system",
    name: "Verners System",
    localSrc: "map-generator/assets/maps/_vernerssystem-color.png",
    ext: "png",
    alt: "Verners System original map art: a cluster of planets and moons in one system",
    title: "Verners System map — Marauder's Sea wiki",
    desc: "Verners System original art: named worlds in one system, lakes on planets, void between them.",
    folklore:
      "Verner charted the family of globes and refused to pick a favorite. Each world still wears its own water and dust. The black between them is the real sea now.",
    play: "Island-hop with Landers. Harbor fleets own a planet's lakes; Starport fleets own the lanes. Take one world fully before you scatter hulls across three.",
    seeAlso: [
      ["Collision", "../maps/collision.html"],
      ["Comet's Pass", "../maps/cometspass.html"],
    ],
  },
  {
    slug: "shatterwake",
    name: "Shatterwake",
    localSrc: "map-generator/assets/maps/_shatterwake-color.png",
    ext: "png",
    alt: "Shatterwake original map art: broken planetary crust and void channels",
    title: "Shatterwake map — Marauder's Sea wiki",
    desc: "Shatterwake original art: a cracked world with void channels cut through the crust.",
    folklore:
      "The wake is what was left after the crust failed. Water still pools in the green bowls. The black cuts are streets now.",
    play: "Use the channels. A Starport on the rim can send hulls into the interior if the rift stays open. Hold high crust for Cities while the void fight happens in the cuts.",
    seeAlso: [
      ["The Hollow World", "../maps/hollow-world.html"],
      ["Collision", "../maps/collision.html"],
    ],
  },
  {
    slug: "hollow-world",
    name: "The Hollow World",
    localSrc: "map-generator/assets/maps/_hollowworld-color.jpg",
    ext: "jpg",
    alt: "The Hollow World original map art: a shattered planetary shell around a molten core, with nearby moons",
    title: "The Hollow World map — Claiming Cosmos wiki",
    desc: "The Hollow World in Claiming Cosmos: a broken shell around a burning core, lakes on the shards, and void through the gaps.",
    folklore:
      "The world did not explode. It emptied. The core still burns in the hollow, and the shell rides around it in pieces. Captains who dive the gap say the inner glow is a lighthouse and a furnace at once.",
    play: "Voidships use the gaps as doors into the interior. The core is volcanic land — take it for a Starport that looks every shard in the face. Lakes on the green crust still want Harbors. Do not ignore the moons; they are the cheap spawn that flanks the shell.",
    seeAlso: [
      ["Sol System", "../maps/sol-system.html"],
      ["Collision", "../maps/collision.html"],
    ],
  },
  {
    slug: "sol-system",
    name: "Sol System",
    localSrc: "map-generator/assets/maps/_solsystem-color.png",
    ext: "png",
    alt: "Sol System original map art: the Sun and planets in a line across black space",
    title: "Sol System map — Claiming Cosmos wiki",
    desc: "Sol System in Claiming Cosmos: the Sun and the planets as islands in the void, Earth's seas as lakes.",
    folklore:
      "Someone laid the family out on a table and forgot to put it back. Helios sits in the middle and will not share the heat. The ice giants keep to the far end of the cloth and pretend they cannot hear the shouting.",
    play: "This is a lane, not a scrum. Starports on Helios look both ways. Earth's lakes still take Harbors. Jump with Landers — the void between worlds is the real sea. Saturn's rings are land; do not park a navy where a city belongs.",
    seeAlso: [
      ["Shattered", "../maps/shattered.html"],
      ["Verners System", "../maps/verners-system.html"],
    ],
  },
  {
    slug: "shattered",
    name: "Shattered",
    localSrc: "map-generator/assets/maps/_shattered-color.jpg",
    ext: "jpg",
    alt: "Shattered original map art: dozens of broken planets and moons packed into one field of debris",
    title: "Shattered map — Claiming Cosmos wiki",
    desc: "Shattered in Claiming Cosmos: a packed field of cracked worlds, magma cores, and void between every shell.",
    folklore:
      "They all broke on the same night. Nobody agrees who swung first. The cores still glow as if they expect to be put back together, and the captains who live here have stopped waiting.",
    play: "This is island-hopping at system scale. Starports on a rim send Voidships through the gaps; Harbors own the green lakes. Take one world completely before you scatter. Magma interiors are land — a core Starport looks every neighbor in the face.",
    seeAlso: [
      ["The Hollow World", "../maps/hollow-world.html"],
      ["Shatterwake", "../maps/shatterwake.html"],
    ],
  },
  {
    slug: "four-for-war",
    name: "Four for War",
    localSrc: "map-generator/assets/maps/_fourforwar-color.jpg",
    ext: "jpg",
    alt: "Four for War original map art: four Earth-like worlds in the corners around a dense asteroid belt",
    title: "Four for War map — Claiming Cosmos wiki",
    desc: "Four for War in Claiming Cosmos: four worlds in the corners and a rock belt in the middle. Lakes on the planets, void between them.",
    folklore:
      "They agreed to fight in the middle so the homes would still be there in the morning. The belt did not agree. Now four globes stare at a graveyard of stone, and every captain who crosses it claims the war was named for them.",
    play: "Four planets, four corners. Harbor fleets own the green lakes. Starports on a rim send Voidships through the belt. The rocks are land — use them as stepping stones, or someone else will. Take your world before you try to take all four.",
    seeAlso: [
      ["Shattered", "../maps/shattered.html"],
      ["Collision", "../maps/collision.html"],
    ],
  },
  {
    slug: "event-horizon",
    name: "Event Horizon",
    localSrc: "map-generator/assets/maps/_eventhorizon-color.jpg",
    ext: "jpg",
    alt: "Event Horizon original map art: a dark textured stone ring around a black void",
    title: "Event Horizon map — Claiming Cosmos wiki",
    desc: "Event Horizon in Claiming Cosmos: one stone ring with void through the hole and around the rim.",
    folklore:
      "They say nothing comes back from the center. Captains still build on the rim, because the ring is the only shore left and the hole is the only road.",
    play: "The ring is the whole world. Starports on the inner or outer rim send Voidships through the hole or around the outside. There are no planet lakes — this is void and rock only. Split the circle, or someone will walk both ways around you.",
    seeAlso: [
      ["The Hollow World", "../maps/hollow-world.html"],
      ["Shatterwake", "../maps/shatterwake.html"],
    ],
  },
  {
    slug: "one-big-world",
    name: "One Big World",
    localSrc: "map-generator/assets/maps/_onebigworld-color.jpg",
    ext: "jpg",
    alt: "One Big World original map art: a single circular world with a central sea, islands, and a ring of continents",
    title: "One Big World map — Claiming Cosmos wiki",
    desc: "One Big World in Claiming Cosmos: one round world in the void. Harbor fleets own the central sea; Starports face the black outside.",
    folklore:
      "They built a whole sky on one plate and left the rest of the night empty. Captains who sail the inner sea say the mountains walk in a circle. Captains who leave the rim say there is nothing to come back for.",
    play: "The blue middle is lake water — Harbors, boats, and wet navy. The black outside is void — Starports and Voidships. Hold a stretch of the ring, then contest the islands. Rivers cut the continents; do not let someone walk your coast from the inside while you stare at the stars.",
    seeAlso: [
      ["Event Horizon", "../maps/event-horizon.html"],
      ["Four for War", "../maps/four-for-war.html"],
    ],
  },
  {
    slug: "twin-isles",
    name: "Twin Isles",
    file: "Twin_Isles_1-907d98c9-374e-4467-a580-53167b357828.jpg",
    alt: "Twin Isles map in Marauder's Sea: two large forested islands split by a central strait",
    title: "Twin Isles map — Marauder's Sea wiki",
    desc: "Twin Isles is a two-island map in Marauder's Sea, the free pirate strategy game. Folklore, layout, and how to play the strait.",
    folklore:
      "Chart-makers say the twins were once one mountain that a jealous current split overnight. Each isle still faces the other like a rival captain across a tavern table. Crews who take both shores in the same night are said to sail with doubled luck — and doubled grudges.",
    play: "Treat the central channel as the prize. Spawn on one bulk, push a Port on the inner beach, and contest the stepping-stone islets before the other side walls the strait with Port Guns. Rivers that dump at beach deltas are boat highways into the interior.",
    seeAlso: [
      ["Dragon's Fall Island", "../maps/dragons-fall-island.html"],
      ["Port", "../buildings/port.html"],
    ],
  },
  {
    slug: "foot-island",
    name: "Foot Island",
    file: "foot_island_1-15e2a453-9ec3-4832-9c51-07b9edf7d7b1.jpg",
    alt: "Foot Island map in Marauder's Sea: an elongated tropical island with a central lake and radiating rivers",
    title: "Foot Island map — Marauder's Sea wiki",
    desc: "Foot Island in Marauder's Sea: a long tropical landmass with a central lake, river arms, and beach deltas. How to play this island warfare map.",
    folklore:
      "Old salts claim a giant walked off the edge of the chart and left one last print. The central lake is the hollow of the heel; the rivers are the toes spreading into the surf. If you hear drums inland, it is only the tide knocking in the lakes — or so the sober ones insist.",
    play: "The island is a march, not a scrum. Expand along the rivers toward the deltas, then rotate a navy around the long coast to pinch anyone stuck in the interior. Cities near the central lake keep population flowing while you fight for the beaches.",
    seeAlso: [
      ["X Marks the Spot", "../maps/x-marks-the-spot.html"],
      ["City", "../buildings/city.html"],
    ],
  },
  {
    slug: "caldera-island",
    name: "Caldera Island",
    file: "Ancient_Caldera_Island-034e961f-fc68-435f-a6bc-e5c1f236238d.jpg",
    alt: "Caldera Island map in Marauder's Sea: a crescent landmass around a central bay with river deltas",
    title: "Caldera Island map — Marauder's Sea wiki",
    desc: "Caldera Island (Ancient Caldera) in Marauder's Sea: a crescent harbor, inner beaches, and outer cliffs. Folklore and play tips.",
    folklore:
      "The crescent is the lip of a dead fire-mountain. Pirates once used the inner bay as a nursery for prizes — quiet water, many river mouths, and cliffs that hide masts from the open sea. The outer rock is still called the Widow's Wall: landings there are rare, and so are the people who try them.",
    play: "The inner curve is the highway. Claim a river-delta beach, raise a Port, then walk Inland Batteries up the spine so they look down into the bay. The eastern island is a second theater — useful if the crescent gets crowded.",
    seeAlso: [
      ["Inland Battery", "../buildings/inland-battery.html"],
      ["Anti-ship Battery", "../buildings/port-gun.html"],
    ],
  },
  {
    slug: "skull-island",
    name: "Skull Island",
    file: "Skull-8cd1b30a-232b-45cf-879a-40ee458d440f.jpg",
    alt: "Skull Island map in Marauder's Sea: an archipelago laid out like a human skull with lagoon eye sockets",
    title: "Skull Island map — Marauder's Sea wiki",
    desc: "Skull Island in Marauder's Sea is the death's-head archipelago. Eye-socket lagoons, jaw islands, folklore, and how to play.",
    folklore:
      "Sailors swear the sea carved a warning. The two round bays are the eyes; the islets between them are the nose; the crescent to the south is a grin that never closes. Superstition says you toss a coin into the left lagoon before you beach a boat. The right lagoon is for debts you do not want paid.",
    play: "Fight for the eye sockets — they are sheltered water with beaches. Rivers that spill into those lagoons let you sneak inland. The jaw island is a flank: ignore it and someone will wrap your navy from the south.",
    seeAlso: [
      ["Hollow's Isles", "../maps/hollows-isles.html"],
      ["Naval Mine", "../buildings/naval-mine.html"],
    ],
  },
  {
    slug: "x-marks-the-spot",
    name: "X Marks the Spot",
    file: "X_MARKS_THE_SPOT_IMAGE-953a8daf-780d-4a2e-a788-cd1692c57849.jpg",
    alt: "X Marks the Spot map in Marauder's Sea: four peninsulas around a central lagoon with rivers to beach deltas",
    title: "X Marks the Spot map — Marauder's Sea wiki",
    desc: "X Marks the Spot in Marauder's Sea: four arms, a central lagoon, and rivers that dump at beach deltas. Folklore and strategy.",
    folklore:
      "Legend says the lagoon was not born — it was dug. Four pirate houses cut channels toward the corners of the sea so every chart would show an X over the same water. Treasure stories still start in the middle islet cluster. Whether anything sits on the bottom, the rivers are real, and they still dump out at the beach deltas.",
    play: "The center is a chokepoint. Use the four rivers as inland roads for boats, then hold the outer deltas so enemies cannot climb the arms. Bay islets between the arms are staging grounds for a flanking navy.",
    seeAlso: [
      ["The Hexacephalic Archipelago", "../maps/hexacephalic-archipelago.html"],
      ["Port", "../buildings/port.html"],
    ],
  },
  {
    slug: "dragons-fall-island",
    name: "Dragon's Fall Island",
    file: "Dragons_Fall_Island-012d0252-88f5-43b1-baea-c8292b624177.jpg",
    alt: "Dragon's Fall Island map in Marauder's Sea: two mirrored dragon-shaped landmasses and a trail of islets",
    title: "Dragon's Fall Island map — Marauder's Sea wiki",
    desc: "Dragon's Fall Island in Marauder's Sea: twin dragon landmasses, a debris trail of islets, folklore, and balanced play.",
    folklore:
      "Two sea-wyrms locked jaws over a prize fleet and turned to stone. Their spines are the mountain ridges; the scatter of islets between them is the wreckage of that fight. Crews still paint dragon heads on sails before they run the corridor — for luck, or to apologize.",
    play: "This map likes even starts. Take a home dragon, fortify the inner beach, then contest the stepping-stone trail. Crossing too early without Port Guns is how navies vanish in the middle.",
    seeAlso: [
      ["Twin Isles", "../maps/twin-isles.html"],
      ["Warship", "../buildings/warship.html"],
    ],
  },
  {
    slug: "hollows-isles",
    name: "Hollow's Isles",
    file: "Hallows_Isle-f4092f24-8ae5-4c24-847e-3f2b0584fd04.jpg",
    alt: "Hollow's Isles map in Marauder's Sea: a skull-shaped island with river exits and surrounding islets",
    title: "Hollow's Isles map — Marauder's Sea wiki",
    desc: "Hollow's Isles in Marauder's Sea: a lantern-grin island with radiating rivers and beach deltas. Folklore and play notes.",
    folklore:
      "The Hollows were a wrecking family who hung a lantern in a carved cliff so lost ships would steer toward the teeth. The grin is still there. Every river that leaves the skull is a story about a cargo that never made the open water. Keep a light on your own mast; the isles like company.",
    play: "Hold the interior high ground and the river mouths. Eight to ten deltas mean many landing ramps — pick two to fortify instead of chasing all of them. Surrounding islets are minefields in more than one sense.",
    seeAlso: [
      ["Skull Island", "../maps/skull-island.html"],
      ["Defense Post", "../buildings/defense-post.html"],
    ],
  },
  {
    slug: "hexacephalic-archipelago",
    name: "The Hexacephalic Archipelago",
    file: "The_Hexacephalic_Archipelago_1-4529b1b0-afee-4aca-82c6-c25d6c096561.jpg",
    alt: "The Hexacephalic Archipelago map in Marauder's Sea: six major islands around a central sea",
    title: "The Hexacephalic Archipelago map — Marauder's Sea wiki",
    desc: "The Hexacephalic Archipelago in Marauder's Sea: six island heads around open water. Folklore and free-for-all tips.",
    folklore:
      "Old maps label the cluster as one beast with six heads. Each island is a skull that learned to grow trees. Captains still pick a 'head' as a house name for the match. The tiny islets in the middle are the tongue — whoever holds them talks loudest.",
    play: "Natural FFA. Secure your island first, then raid across the lanes. Do not empty your home beach for an early center fight; someone else will land behind you. Ports on the inner shores see more trade — and more Warships.",
    seeAlso: [
      ["The Ember Isles", "../maps/ember-isles.html"],
      ["Marauder", "../buildings/marauder.html"],
    ],
  },
  {
    slug: "ember-isles",
    name: "The Ember Isles",
    file: "The_Ember_Isles_1-78180418-fe59-4a12-9364-6a17ca6cbd18.jpg",
    alt: "The Ember Isles map in Marauder's Sea: four large corner islands around a central X of water and islets",
    title: "The Ember Isles map — Marauder's Sea wiki",
    desc: "The Ember Isles in Marauder's Sea: four corner islands, volcano and river labyrinths, and a central crossing. How to play.",
    folklore:
      "Four coals left when the sea put a fire out. One isle still wears a crater; another is all tangled water; a third is sand and delta; the last is ridge and jungle. The crossing in the middle is where the last heat lives. Pirates say if you see steam on a calm morning, do not brag about it in port.",
    play: "Corner starts, mid-map fights. Specialize: volcano high ground, river maze for boats, sandy deltas for wide beaches. The central islets are a raid highway — mine them or lose them.",
    seeAlso: [
      ["The Hexacephalic Archipelago", "../maps/hexacephalic-archipelago.html"],
      ["Factory", "../buildings/factory.html"],
    ],
  },
  {
    slug: "tarryn-fjords",
    name: "Tarryn Fjords",
    file: "Tarryn_Fjord-110acc8a-7470-4be8-8e6a-4181456eec18.jpg",
    alt: "Tarryn Fjords map in Marauder's Sea: snow peaks, two flanking continents, and a three-island gauntlet",
    title: "Tarryn Fjords map — Marauder's Sea wiki",
    desc: "Tarryn Fjords in Marauder's Sea is named after Tarryn, child of a famous pirate. Snow peaks, a channel gauntlet, and how to play.",
    folklore:
      "Tarryn — T-A-R-R-Y-N — was one of a famous pirate's children. While the adult captains argued over rum and ransom, the kid charted the ice channels, named the three middle isles, and came home with a sketch that still matches the water. The fjords keep the name as a dare: if a child could run this gauntlet, so can you.",
    play: "The center channel is the war. Control the three islands and you tax every north-south sail. The continent edges are fractal cover — good for hiding a Port, bad for getting lost. Inland Batteries on high snow ridges punish anyone who parks in the lane.",
    seeAlso: [
      ["Vernon", "../maps/vernon.html"],
      ["Inland Battery", "../buildings/inland-battery.html"],
    ],
  },
  {
    slug: "vernon",
    name: "Vernon",
    file: "Vernon_1-c1e83400-a798-4f76-829d-f7447bf19a75.jpg",
    alt: "Vernon map in Marauder's Sea: a rugged snow-capped landmass with dense rivers, lakes, and flanking islets",
    title: "Vernon map — Marauder's Sea wiki",
    desc: "Vernon in Marauder's Sea is named after a famous pirate. Wild mountains, river deltas, folklore, and inland play.",
    folklore:
      "Vernon was a famous pirate who wintered here when the tropics got too crowded with warrants. He hid prizes in the high lakes and ran the southern swamp-delta when a navy came looking. The name stuck the way a good lie sticks: loud, simple, and still on the chart.",
    play: "This is a land-heavy hunt. Rivers and lakes cut the interior into pockets — Defense Posts and Cities matter as much as ships. Use the flanking islet chains to sneak a navy around players who only stare at the snow peaks.",
    seeAlso: [
      ["Tarryn Fjords", "../maps/tarryn-fjords.html"],
      ["Armory", "../buildings/armory.html"],
    ],
  },
];

const buildings = [
  {
    slug: "city",
    name: "City",
    file: "city-9e8c194e-82c3-4100-b1ba-764f7a48a970.jpg",
    ext: "jpg",
    alt: "City building art for Marauder's Sea: a fortified pirate town with a market square",
    title: "City building — Marauder's Sea wiki",
    desc: "Cities in Marauder's Sea raise max population. Cost, upgrades, ship damage, and how they fit island warfare.",
    folklore:
      "Every crew wants a square with a fountain and a flag that is not someone else's. Cities are where gold turns into people, and people turn into the next beach.",
    play: "Increases max population. Costs scale with how many you already have (power-of-two, cap $1,000,000). Upgradable. Ships can damage them; they die at zero hit points. Fast to raise (about 2 seconds).",
  },
  {
    slug: "defense-post",
    name: "Defense Post",
    file: "defensive_post-719ea711-5a94-40fa-95b6-6e73b8fb3a23.jpg",
    ext: "jpg",
    alt: "Defense Post art for Marauder's Sea: coastal and inland watchtowers",
    title: "Defense Post — Marauder's Sea wiki",
    desc: "Defense Posts in Marauder's Sea slow enemy attacks on nearby borders. Cost, placement, and folklore.",
    folklore:
      "A post is a promise: someone is watching this road or this cliff. Pirates paint them like lighthouses so friends can find the line, and enemies can dread it.",
    play: "Buffs nearby borders (checkered ground). Enemy attacks are slower and take more casualties. Cheap scaling cost, cap $250,000. About 5 seconds to build.",
  },
  {
    slug: "port",
    name: "Port",
    file: "port-346e5e1f-9981-4153-b14f-273504efd2e3.jpg",
    ext: "jpg",
    alt: "Port building art for Marauder's Sea: a pirate harbor with docks, cranes, and a galleon",
    title: "Port building — Marauder's Sea wiki",
    desc: "Ports in Marauder's Sea spawn warships, marauders, and tenders and run trade ships for gold. How to place and protect them.",
    folklore:
      "A port is a mouth. Feed it timber and it spits hulls. Stop feeding it and the harbor goes quiet — which is how rival captains know you are hurting.",
    play: "Build near water. Spawns Warships, Marauders, and Tenders. Auto trade between ports for gold unless trade is stopped (attacks pause it for 5 minutes, or use Stop/Start trading). Ships can destroy a port; it does not heal. Cost shares a scaling bucket with Factories.",
  },
  {
    slug: "port-gun",
    name: "Anti-ship Battery",
    file: "port_gun-168f08c4-2dc3-4a04-8dc4-81a1e5507953.jpg",
    ext: "jpg",
    alt: "Anti-ship Battery art: a coastal cannon on stone battlements",
    title: "Anti-ship Battery — Marauder's Sea wiki",
    desc: "Anti-ship batteries fire on ships. Place on a lake shore or the planet rim. Range, levels, and Repairman.",
    folklore:
      "If it is a hull, it is in range. The battery does not care if the water is a lake or the black between worlds.",
    play: "Place on owned land at a lake shore or the planet edge. Shells enemy ships. Upgrade to level 10. Range grows from 80 toward 113 tiles. Repairman starts healing at level 4. Volley size steps up with level. About 8 seconds to build. Cost scales, cap $400,000.",
  },
  {
    slug: "inland-battery",
    name: "Inland Battery",
    file: "inland_battery-81c2f45d-d389-446b-acc8-f3c57787f42f.jpg",
    ext: "jpg",
    alt: "Inland Battery art for Marauder's Sea: hilltop cannons overlooking a valley",
    title: "Inland Battery — Marauder's Sea wiki",
    desc: "Inland Battery in Marauder's Sea: $1.5M land cannon, 15s reload, auto or manual aim, 80/20 landing ring. How to fire it.",
    folklore:
      "Not every fight is at the beach. Some captains haul guns up the hill so the valley itself becomes a barrel. Inland Batteries are how a pirate empire says the interior is not safe either.",
    play: "Place on owned land. $1,500,000 to place or upgrade, levels 1–10 (shells per volley). 15 second reload. Auto-fire on by default; manual lets you pick the impact circle (green in range, red out). Shells scatter in a landing ring: about 80% toward a target, 20% toward troops. Hits over water, but a water landing is a dud. Land hits scorch a small patch of enemy ground — not yours. Range 100–210 tiles. Destroyed at zero HP, including if captured. Hotkey 8.",
  },
  {
    slug: "factory",
    name: "Factory",
    file: "factory-a9d719e8-d0f9-4a54-99f0-f81b37bdc880.jpg",
    ext: "jpg",
    alt: "Factory building art for Marauder's Sea: a water-powered foundry in a mountain valley",
    title: "Factory — Marauder's Sea wiki",
    desc: "Factories in Marauder's Sea lay railroads to cities and ports. Trains, gold, and how they share cost with ports.",
    folklore:
      "When pirates stay long enough, they stop pretending they are only sailors. Factories are the clank behind the flag — rails, bars, and a wheel in the river.",
    play: "Auto-builds railroads to nearby Cities, Ports, and other Factories (and can link allies). Trains pay gold per visit, more for neighbors' buildings. Ships can damage them. Cost shares scaling with Ports.",
  },
  {
    slug: "armory",
    name: "Armory",
    file: "armory-f02189cd-949c-4a87-9488-416c08a4dd1c.jpg",
    ext: "jpg",
    alt: "Armory building art for Marauder's Sea: a fortress courtyard of muskets, cutlasses, and a forge",
    title: "Armory — Marauder's Sea wiki",
    desc: "The Armory in Marauder's Sea is unique: one per player. Each upgrade is a stronger weapon age, then mines at level 4.",
    folklore:
      "One shed per captain. That is the rule. Every time you advance the Armory, you get stronger — ballistic, electromagnetic, nuclear, energy, then plasma.",
    facts: [
      ["Level 0 — Ballistic", "Gunpowder firearms, cannons, conventional explosives. No Armory yet."],
      ["Level 1 — Electromagnetic", "Railguns, coilguns, mass-driver style weapons."],
      ["Level 2 — Nuclear", "Fission and fusion-scale ordnance."],
      ["Level 3 — Energy", "Lasers, particle beams, directed-energy weapons."],
      ["Level 4 — Plasma", "Advanced plasma weapons. Unlocks naval mines."],
    ],
    play: "One per player. Unique. Each upgrade is a stronger weapon age. Level 4 unlocks Naval Mines. Costs $500k / $1.5M / $3M then $2M. Upgradable. About 8 seconds to build.",
  },
  {
    slug: "naval-mine",
    name: "Naval Mine",
    file: "mine-dee851cf-faf3-486b-ac8b-59a268aeec94.jpg",
    ext: "jpg",
    alt: "Naval Mine art for Marauder's Sea: a horned sea mine in a tropical channel",
    title: "Naval Mine — Marauder's Sea wiki",
    desc: "Naval Mines in Marauder's Sea: hidden sea mines unlocked at Armory 4. Placement, arming, and who they hit.",
    folklore:
      "The honest weapon of a dishonest harbor. You do not see it until the hull does.",
    play: "Place from water, not the land menu. Unlock at Armory 4. Arms after 10 seconds. Hits enemy Warships, Marauders, Tenders, and transports. You and teammates see them; enemies do not. Max 3. Trade ships ignore them. First $250,000, then $500,000.",
  },
  {
    slug: "warship",
    name: "Warship",
    file: "warship-0d6296fa-674b-43c7-b0d4-6778b0053951.jpg",
    ext: "jpg",
    alt: "Warship art for Marauder's Sea: a black-sailed galleon with a skull figurehead",
    title: "Warship — Marauder's Sea wiki",
    desc: "Warships in Marauder's Sea: 1,000 HP hulls that patrol, capture trade, fight ships, and bombard coasts. Ranks, guns, and cost.",
    folklore:
      "The heavy argument. If a Port is a mouth, a Warship is the teeth. Captains paint gold stripes on the stern the way other men paint medals — each stripe is a rumor that came true.",
    facts: [
      ["Hit points", "1,000 at launch. Each gold stripe adds 20%, so rank 3 sits at 1,600 HP."],
      ["Guns", "85-tile targeting. Shells home until the fuse ends — they do not chase forever. Base shell is 250 damage."],
      ["Ranks", "0–3 gold stripes from killing transports (10 per rank) and capturing trader ships (25 per rank). Rank 1+: +50% shell damage. Volley is 1 / 1 / 2 / 3 shots. Rank 3 slowly repairs the hull."],
      ["Speed", "1 tile per tick on patrol. Hunts at 2 steps per tick."],
      ["Cost", "First hull $250,000, then $500,000, $750,000, cap $1,000,000. Spawns from the nearest Port."],
    ],
    play: "Click water to set a patrol box. Attack-click the Warship, then water, to move it. It captures enemy <a href=\"trader-ship.html\">trader ships</a>, fights <a href=\"marauder.html\">Marauders</a> and <a href=\"transport.html\">Transports</a>, and can bombard coastal buildings. Near a friendly Port it heals faster. Park one on a trade lane and the gold starts walking toward you.",
  },
  {
    slug: "marauder",
    name: "Marauder",
    file: "marauder-22ed8d2b-bc97-4dae-9e29-45dbdcbd6159.jpg",
    ext: "jpg",
    alt: "Marauder art for Marauder's Sea: a faster black-sailed raider with a skull prow",
    title: "Marauder — Marauder's Sea wiki",
    desc: "Marauders in Marauder's Sea: 500 HP raiders with the same 85-tile guns as a warship, at half the cost and 1.5× speed.",
    folklore:
      "Named for the sea itself. A Marauder is the cutter you send when a Warship would be late to the rumor — two masts, a skull on the prow, and a crew that does not wait for permission.",
    facts: [
      ["Hit points", "500 — half a Warship. One good volley from a ranked galleon will open her."],
      ["Guns", "Same 85-tile reach as a Warship, but one shot per volley. Ranked Marauders keep a stacked +20% damage per stripe, still a single shell."],
      ["Speed", "1.5× a Warship (about 1.5 tiles per tick; 3 steps when hunting)."],
      ["Cost", "First hull $125,000, then scaling to a $500,000 cap. Half the Warship ledger. Spawns from the nearest Port."],
    ],
    play: "Select and move them like <a href=\"warship.html\">Warships</a>. Use them to run down <a href=\"trader-ship.html\">trader ships</a>, cut <a href=\"transport.html\">Transports</a>, and win races to a strait. They do not get the rank-3 repairman — if the hull is bleeding, send her home or lose her. Park a <a href=\"tender.html\">Tender</a> nearby if you are far from a Port.",
  },
  {
    slug: "tender",
    name: "Tender",
    file: "tender.jpg",
    ext: "jpg",
    localSrc: true,
    alt: "Tender ship art for Marauder's Sea: a thick two-masted hull with black sails and no cannons",
    title: "Tender — Marauder's Sea wiki",
    desc: "Tenders in Marauder's Sea: unarmed 1,200 HP repair ships that heal friendly warships and marauders in a 30-tile bubble.",
    folklore:
      "No guns on the rail. The Tender is a floating carpenter's shop — thick oak, two black sails, and a crew that patches other people's fights. Captains who mock her learn what a leaking galleon is worth when the Port is twenty minutes astern.",
    facts: [
      ["Hit points", "1,200. Heavier than a Warship. Mines take 70% of max HP, same as a Warship — she does not one-shot."],
      ["Guns", "None. No hunt, no capture, no shore bombardment. Enemy Warships, Marauders, Port Guns, and mines can still sink her."],
      ["Heal", "1 HP per tick to friendly Warships and Marauders within 30 tiles. Does not stack with Port heal; the Port wins if both apply."],
      ["Speed", "Warship patrol speed: 1 tile per tick. No hunt sprint."],
      ["Cost", "$1,000,000 each. Unlimited. Spawns from the nearest Port."],
    ],
    play: "Click water to place, same as a <a href=\"warship.html\">Warship</a>. Keep her with the fighting hulls, not on the beach. If your ships are hugging a <a href=\"port.html\">Port</a>, she is wasted gold — Port heal already covers that. Far from harbor, she is the difference between a ranked galleon coming home and a rumor on the bottom.",
  },
  {
    slug: "transport",
    name: "Transport",
    file: "troop_transport-6f5b219c-9230-46f2-94c1-503bf5ef4885.jpg",
    ext: "jpg",
    alt: "Transport ship art for Marauder's Sea: a cargo-packed troop ship with Jolly Roger sails",
    title: "Transport ship — Marauder's Sea wiki",
    desc: "Transports in Marauder's Sea carry troops across water. Max 3 boats, light deck guns, thin hulls. How landings work.",
    folklore:
      "Not every black sail is hunting. Some are a beach in motion — crates, barrels, and a company packed rail to rail. The Transport is how an island learns it has new neighbors.",
    facts: [
      ["Hit points", "A thin hull. There is no armored HP pool like a Warship — one shell, mine, or ranked volley typically sends her down with the troops still aboard."],
      ["Guns", "Light deck guns at half a Warship's grab: about 42 tiles. Enough to annoy a cutter, not enough to duel a galleon."],
      ["Capacity", "Carries the troops you send. Max 3 Transports at once. No gold cost — you pay in people."],
      ["Retreat", "Calling her back costs 25% of the troops on board. If you retrieve a landing and the old beach has flipped, she attacks there instead."],
    ],
    play: "Open the radial menu on water (or use the boat order) to send a Transport at a coast. She must reach a landing tile. <a href=\"naval-mine.html\">Naval Mines</a>, <a href=\"port-gun.html\">Port Guns</a>, <a href=\"warship.html\">Warships</a>, and <a href=\"marauder.html\">Marauders</a> all love a loaded boat. Escort her, or send two and expect to lose one.",
  },
  {
    slug: "trader-ship",
    name: "Trader Ship",
    file: "trader_ship-bc631882-e1fd-419f-971d-06e9884eeb63.jpg",
    ext: "jpg",
    alt: "Trader Ship art for Marauder's Sea: a merchant hull with barrel-and-crate sails",
    title: "Trader Ship — Marauder's Sea wiki",
    desc: "Trader ships in Marauder's Sea sail between ports for gold. Capture them with warships; mines ignore them.",
    folklore:
      "White canvas and a stencil of barrels — the honest lie of the sea. A Trader Ship is not a prize until a Warship makes her one. Ports keep sending them because gold does not swim by itself.",
    facts: [
      ["Hit points", "Not a fighting hull. Warships usually capture her instead of pounding her to splinters. Mines skip her on purpose."],
      ["Gold", "Spawned automatically from Ports (no build cost). Completing a run pays both harbors; longer trips pay more. Short hops are worth less."],
      ["Trade stops", "Attacking (or being attacked) pauses trade for 5 minutes, unless you become allies. You can also Stop / Start trading by hand."],
      ["Piracy", "Capture with a Warship or Marauder and the gold walks to the captor. Twenty-five captures help a Warship earn a rank."],
    ],
    play: "Build more <a href=\"port.html\">Ports</a> if you want more white sails. Guard your lanes with <a href=\"warship.html\">Warships</a>, or hunt the other captain's convoy and live off their ledger. A silent harbor usually means someone is at war — or someone stole the fleet. <a href=\"naval-mine.html\">Naval mines</a> ignore traders on purpose.",
  },
];

function shell({
  title,
  description,
  canonical,
  ogImage,
  ogAlt,
  depth,
  crumbs,
  body,
}) {
  const css = `${"../".repeat(depth)}css/wiki.css`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: canonical,
    image: ogImage ? [`${site}${ogImage}`] : undefined,
    isPartOf: { "@type": "WebSite", name: "Marauder's Sea", url: `${site}/` },
    about: { "@type": "VideoGame", name: "Marauder's Sea", url: `${site}/` },
  };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#0c1830" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Marauder's Sea" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    ${
      ogImage
        ? `<meta property="og:image" content="${site}${ogImage}" />
    <meta property="og:image:alt" content="${ogAlt}" />`
        : ""
    }
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="stylesheet" href="${css}" />
    <script type="application/ld+json">
      ${JSON.stringify(jsonLd)}
    </script>
  </head>
  <body class="wiki">
    <div class="wrap">
      <div class="topbar">
        <a class="brand" href="${site}/">Marauder's Sea</a>
        <a class="play" href="${site}/">Play this free pirate strategy game</a>
      </div>
      <nav class="crumbs">${crumbs}</nav>
      ${body}
      <footer class="site">
        <p>
          <a href="${site}/wiki/">Marauder's Sea wiki</a>
          ·
          <a href="${site}/">Play Marauder's Sea free</a>
          in your browser (desktop or phone).
          Independently based on
          <a href="https://openfront.io/">OpenFront.io</a>.
        </p>
      </footer>
    </div>
  </body>
</html>
`;
}

function write(rel, html) {
  const dest = path.join(wiki, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

copyAsset(
  "marauderssea_logo-8ada1aab-c278-4e38-a9df-12fabef626b5.jpg",
  "images/brand/logo.jpg",
);
for (const m of maps) {
  const destRel = `images/maps/${mapImg(m)}`;
  if (m.localSrc) {
    const dest = path.join(wiki, destRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, m.localSrc), dest);
  } else {
    copyAsset(m.file, destRel);
  }
}
for (const b of buildings) {
  if (b.localSrc) {
    copyLocalAsset(b.file, `images/buildings/${b.slug}.${b.ext}`);
  } else {
    copyAsset(b.file, `images/buildings/${b.slug}.${b.ext}`);
  }
}

const hubBody = `
      <h1>Marauder's Sea wiki</h1>
      <p class="lede">
        Maps, buildings, and island folklore for
        <a href="${site}/">Marauder's Sea</a> —
        a free pirate PC game you can play in the browser, including as a
        mobile strategy game on a phone. Age-of-sail warships, ports, and
        island warfare.
      </p>
      <p>
        Start with the
        <a href="maps/">map guides</a>
        or the
        <a href="buildings/">building roster</a>.
        Then
        <a href="${site}/">play this browser pirate game</a>
        free.
      </p>
      <h2>Maps</h2>
      <div class="grid">
        ${maps
          .map(
            (m) => `<a class="card" href="maps/${m.slug}.html">
          <img src="images/maps/${mapImg(m)}" alt="${m.alt}" />
          <span>${m.name}</span>
        </a>`,
          )
          .join("\n        ")}
      </div>
      <h2>Buildings and ships</h2>
      <div class="grid">
        ${buildings
          .map(
            (b) => `<a class="card" href="buildings/${b.slug}.html">
          <img src="images/buildings/${b.slug}.${b.ext}" alt="${b.alt}" />
          <span>${b.name}</span>
        </a>`,
          )
          .join("\n        ")}
      </div>
`;

write(
  "index.html",
  shell({
    title: "Marauder's Sea wiki — maps and buildings",
    description:
      "Wiki for Marauder's Sea, a free pirate strategy game in the browser. Maps, ports, inland batteries, folklore, and how to play.",
    canonical: `${site}/wiki/`,
    ogImage: "/wiki/images/maps/x-marks-the-spot.jpg",
    ogAlt: "X Marks the Spot map from Marauder's Sea",
    depth: 0,
    crumbs: `<a href="${site}/">Home</a> / Wiki`,
    body: hubBody,
  }),
);

write(
  "maps/index.html",
  shell({
    title: "Maps — Marauder's Sea wiki",
    description:
      "All featured maps in Marauder's Sea, the free browser pirate game: Twin Isles, Skull Island, Tarryn Fjords, Vernon, and more.",
    canonical: `${site}/wiki/maps/`,
    ogImage: "/wiki/images/maps/skull-island.jpg",
    ogAlt: "Skull Island map from Marauder's Sea",
    depth: 1,
    crumbs: `<a href="${site}/">Home</a> / <a href="../">Wiki</a> / Maps`,
    body: `
      <h1>Maps</h1>
      <p class="lede">
        Chart the islands of this
        <a href="${site}/">free pirate strategy game</a>.
        Each page has a labeled map image, folklore, and a play hint.
      </p>
      <div class="grid">
        ${maps
          .map(
            (m) => `<a class="card" href="${m.slug}.html">
          <img src="../images/maps/${mapImg(m)}" alt="${m.alt}" />
          <span>${m.name}</span>
        </a>`,
          )
          .join("\n        ")}
      </div>
    `,
  }),
);

write(
  "buildings/index.html",
  shell({
    title: "Buildings — Marauder's Sea wiki",
    description:
      "Buildings and ships in Marauder's Sea: City, Port, Port Gun, Inland Battery, Factory, Armory, Warship, Marauder, Tender, Transport, Trader Ship, and Naval Mine.",
    canonical: `${site}/wiki/buildings/`,
    ogImage: "/wiki/images/buildings/port.jpg",
    ogAlt: "Port building art from Marauder's Sea",
    depth: 1,
    crumbs: `<a href="${site}/">Home</a> / <a href="../">Wiki</a> / Buildings`,
    body: `
      <h1>Buildings and ships</h1>
      <p class="lede">
        The roster for this
        <a href="${site}/">age-of-sail warship game</a>.
        Costs and rules match the in-game Help table.
      </p>
      <div class="grid">
        ${buildings
          .map(
            (b) => `<a class="card" href="${b.slug}.html">
          <img src="../images/buildings/${b.slug}.${b.ext}" alt="${b.alt}" />
          <span>${b.name}</span>
        </a>`,
          )
          .join("\n        ")}
      </div>
    `,
  }),
);

for (const m of maps) {
  const related = m.seeAlso
    .map(([label, href]) => `<a href="${href}">${label}</a>`)
    .join(" · ");
  write(
    `maps/${m.slug}.html`,
    shell({
      title: m.title,
      description: m.desc,
      canonical: `${site}/wiki/maps/${m.slug}.html`,
      ogImage: `/wiki/images/maps/${mapImg(m)}`,
      ogAlt: m.alt,
      depth: 1,
      crumbs: `<a href="${site}/">Home</a> / <a href="../">Wiki</a> / <a href="./">Maps</a> / ${m.name}`,
      body: `
      <h1>${m.name}</h1>
      <p class="lede">${m.desc}</p>
      <figure class="hero">
        <img src="../images/maps/${mapImg(m)}" alt="${m.alt}" />
        <figcaption>${m.name} — original map art.</figcaption>
      </figure>
      <h2>Folklore</h2>
      <p>${m.folklore}</p>
      <h2>How to play it</h2>
      <p>${m.play}</p>
      <p>See also: ${related} · <a href="${site}/">play Marauder's Sea free</a></p>
    `,
    }),
  );
}

for (const b of buildings) {
  write(
    `buildings/${b.slug}.html`,
    shell({
      title: b.title,
      description: b.desc,
      canonical: `${site}/wiki/buildings/${b.slug}.html`,
      ogImage: `/wiki/images/buildings/${b.slug}.${b.ext}`,
      ogAlt: b.alt,
      depth: 1,
      crumbs: `<a href="${site}/">Home</a> / <a href="../">Wiki</a> / <a href="./">Buildings</a> / ${b.name}`,
      body: `
      <h1>${b.name}</h1>
      <p class="lede">${b.desc}</p>
      <figure class="hero">
        <img src="../images/buildings/${b.slug}.${b.ext}" alt="${b.alt}" />
        <figcaption>${b.name} — labeled art for Marauder's Sea.</figcaption>
      </figure>
      <h2>Folklore</h2>
      <p>${b.folklore}</p>
      ${
        b.facts
          ? `<h2>Ledger</h2>
      <dl class="facts">
        ${b.facts
          .map(([dt, dd]) => `<dt>${dt}</dt>\n        <dd>${dd}</dd>`)
          .join("\n        ")}
      </dl>`
          : ""
      }
      <h2>In the game</h2>
      <p>${b.play}</p>
      <p>
        Back to the
        <a href="./">building list</a>
        or pick a map like
        <a href="../maps/x-marks-the-spot.html">X Marks the Spot</a>
        and
        <a href="${site}/">play this mobile strategy game</a>
        in the browser.
      </p>
    `,
    }),
  );
}

console.log(
  `Wrote wiki: ${maps.length} maps, ${buildings.length} buildings`,
);
