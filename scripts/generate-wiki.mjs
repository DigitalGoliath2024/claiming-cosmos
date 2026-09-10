import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wiki = path.join(root, "resources", "wiki");
const site = "https://claimingcosmos.com";
const brand = "Claiming Cosmos";
const themeColor = "#0c1830";

function mapExt(m) {
  return m.ext ?? "jpg";
}

function mapImg(m) {
  return `${m.slug}.${mapExt(m)}`;
}

function copyFromRepo(srcRel, destRel) {
  const src = path.join(root, srcRel);
  const dest = path.join(wiki, destRel);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing wiki source image ${srcRel}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function keepBuildingImage(slug, ext) {
  const destRel = `images/buildings/${slug}.${ext}`;
  const dest = path.join(wiki, destRel);
  if (!fs.existsSync(dest)) {
    throw new Error(`Missing wiki building image ${destRel}`);
  }
}

const maps = [
  {
    slug: "collision",
    name: "Collision",
    localSrc: "map-generator/assets/maps/_collision-color.jpg",
    ext: "jpg",
    alt: "Collision map: two planets smashing together with space visible through crust cracks",
    title: "Collision map — Claiming Cosmos wiki",
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
    alt: "Comet's Pass map: shattered worlds and a comet trail through the void",
    title: "Comet's Pass map — Claiming Cosmos wiki",
    desc: "Comet's Pass in Claiming Cosmos: a shattered system with a bright trail ships can run between worlds.",
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
    alt: "Verners System map: a cluster of planets and moons in one system",
    title: "Verners System map — Claiming Cosmos wiki",
    desc: "Verners System in Claiming Cosmos: named worlds in one system, lakes on planets, void between them.",
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
    alt: "Shatterwake map: broken planetary crust and void channels",
    title: "Shatterwake map — Claiming Cosmos wiki",
    desc: "Shatterwake in Claiming Cosmos: a cracked world with void channels cut through the crust.",
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
    alt: "The Hollow World map: a shattered planetary shell around a molten core, with nearby moons",
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
    alt: "Sol System map: the Sun and planets in a line across black space",
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
    alt: "Shattered map: dozens of broken planets and moons packed into one field of debris",
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
    alt: "Four for War map: four Earth-like worlds in the corners around a dense asteroid belt",
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
    alt: "Event Horizon map: a dark textured stone ring around a black void",
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
    alt: "One Big World map: a single circular world with a central sea, islands, and a ring of continents",
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
];

const buildings = [
  {
    slug: "city",
    name: "City",
    ext: "jpg",
    alt: "City building art for Claiming Cosmos: a fortified settlement with a market square",
    title: "City building — Claiming Cosmos wiki",
    desc: "Cities in Claiming Cosmos raise max population. Cost, upgrades, ship damage, and how they fit planetary warfare.",
    folklore:
      "Every crew wants a square with a fountain and a flag that is not someone else's. Cities are where gold turns into people, and people turn into the next beach.",
    play: "Increases max population. Costs scale with how many you already have (power-of-two, cap $1,000,000). Upgradable. Ships can damage them; they die at zero hit points. Fast to raise (about 2 seconds).",
  },
  {
    slug: "defense-post",
    name: "Defense Post",
    ext: "jpg",
    alt: "Defense Post art for Claiming Cosmos: coastal and inland watchtowers",
    title: "Defense Post — Claiming Cosmos wiki",
    desc: "Defense Posts in Claiming Cosmos slow enemy attacks on nearby borders. Cost, placement, and folklore.",
    folklore:
      "A post is a promise: someone is watching this road or this cliff. Paint them like lighthouses so friends can find the line, and enemies can dread it.",
    play: "Buffs nearby borders (checkered ground). Enemy attacks are slower and take more casualties. Cheap scaling cost, cap $250,000. About 5 seconds to build.",
  },
  {
    slug: "port",
    name: "Harbor",
    ext: "jpg",
    alt: "Harbor building art for Claiming Cosmos: docks on planet water with cranes and hulls",
    title: "Harbor — Claiming Cosmos wiki",
    desc: "Harbors in Claiming Cosmos spawn Warships, Marauders, and Tenders on planet lakes and run trade ships for gold.",
    folklore:
      "A Harbor is a mouth on wet ground. Feed it and it spits hulls into the lakes. Starports own the void; Harbors own the blue.",
    play: "Build near lake or ocean water on a planet. Spawns Warships, Marauders, and Tenders. Auto trade between harbors for gold unless trade is stopped. Ships can destroy a Harbor; it does not heal. Cost shares a scaling bucket with Factories.",
  },
  {
    slug: "port-gun",
    name: "Anti-ship Battery",
    ext: "jpg",
    alt: "Anti-ship Battery art: a coastal cannon on stone battlements",
    title: "Anti-ship Battery — Claiming Cosmos wiki",
    desc: "Anti-ship batteries fire on ships. Place on a lake shore or the planet rim. Range, levels, and Repairman.",
    folklore:
      "If it is a hull, it is in range. The battery does not care if the water is a lake or the black between worlds.",
    play: "Place on owned land at a lake shore or the planet edge. Shells enemy ships. Upgrade to level 10. Range grows from 80 toward 113 tiles. Repairman starts healing at level 4. Volley size steps up with level. About 8 seconds to build. Cost scales, cap $400,000.",
  },
  {
    slug: "inland-battery",
    name: "Planetary Battery",
    ext: "jpg",
    alt: "Planetary Battery art for Claiming Cosmos: hilltop cannons overlooking a valley",
    title: "Planetary Battery — Claiming Cosmos wiki",
    desc: "Planetary Battery in Claiming Cosmos: $1.5M land cannon, 15s reload, auto or manual aim, 80/20 landing ring.",
    folklore:
      "Not every fight is at the shore. Some captains haul guns inland so the valley itself becomes a barrel.",
    play: "Place on owned land. $1,500,000 to place or upgrade, levels 1–10 (shells per volley). 15 second reload. Auto-fire on by default; manual lets you pick the impact circle. Shells scatter in a landing ring: about 80% toward a target, 20% toward troops. Hits over water, but a water landing is a dud. Land hits scorch a small patch of enemy ground — not yours. Range 100–210 tiles.",
  },
  {
    slug: "factory",
    name: "Factory",
    ext: "jpg",
    alt: "Factory building art for Claiming Cosmos: a foundry linking cities and harbors",
    title: "Factory — Claiming Cosmos wiki",
    desc: "Factories in Claiming Cosmos lay railroads to cities and harbors. Trains, gold, and how they share cost with harbors.",
    folklore:
      "When fleets stay long enough, they stop pretending they are only sailors. Factories are the clank behind the flag — rails, bars, and a wheel in the river.",
    play: "Auto-builds railroads to nearby Cities, Harbors, and other Factories (and can link allies). Trains pay gold per visit, more for neighbors' buildings. Ships can damage them. Cost shares scaling with Harbors.",
  },
  {
    slug: "armory",
    name: "Armory",
    ext: "jpg",
    alt: "Armory building art for Claiming Cosmos: a fortress courtyard of weapons and a forge",
    title: "Armory — Claiming Cosmos wiki",
    desc: "The Armory in Claiming Cosmos is unique: one per player. Each upgrade is a stronger weapon age, then mines at level 4.",
    folklore:
      "One shed per captain. That is the rule. Every time you advance the Armory, you get stronger — ballistic, electromagnetic, nuclear, energy, then plasma.",
    facts: [
      [
        "Level 0 — Ballistic",
        "Gunpowder firearms, cannons, conventional explosives. No Armory yet.",
      ],
      [
        "Level 1 — Electromagnetic",
        "Railguns, coilguns, mass-driver style weapons.",
      ],
      ["Level 2 — Nuclear", "Fission and fusion-scale ordnance."],
      [
        "Level 3 — Energy",
        "Lasers, particle beams, directed-energy weapons.",
      ],
      [
        "Level 4 — Plasma",
        "Advanced plasma weapons. Unlocks naval mines.",
      ],
    ],
    play: "One per player. Unique. Each upgrade is a stronger weapon age. Level 4 unlocks Naval Mines. Costs $500k / $1.5M / $3M then $2M. Upgradable. About 8 seconds to build.",
  },
  {
    slug: "naval-mine",
    name: "Naval Mine",
    ext: "jpg",
    alt: "Naval Mine art for Claiming Cosmos: a horned mine in a channel",
    title: "Naval Mine — Claiming Cosmos wiki",
    desc: "Naval Mines in Claiming Cosmos: hidden mines unlocked at Armory 4. Placement, arming, and who they hit.",
    folklore:
      "The honest weapon of a dishonest harbor. You do not see it until the hull does.",
    play: "Place from water, not the land menu. Unlock at Armory 4. Arms after 10 seconds. Hits enemy Warships, Marauders, Tenders, and transports. You and teammates see them; enemies do not. Max 3. Trade ships ignore them. First $250,000, then $500,000.",
  },
  {
    slug: "warship",
    name: "Warship",
    ext: "jpg",
    alt: "Warship art for Claiming Cosmos: a heavy Harbor fleet combat hull",
    title: "Warship — Claiming Cosmos wiki",
    desc: "Warships in Claiming Cosmos: 1,000 HP Harbor hulls that patrol, capture trade, fight ships, and bombard coasts.",
    folklore:
      "The heavy argument on planet water. If a Harbor is a mouth, a Warship is the teeth.",
    facts: [
      [
        "Hit points",
        "1,000 at launch. Each gold stripe adds 20%, so rank 3 sits at 1,600 HP.",
      ],
      [
        "Guns",
        "85-tile targeting. Shells home until the fuse ends. Base shell is 250 damage.",
      ],
      [
        "Ranks",
        "0–3 gold stripes from killing transports and capturing trader ships. Rank 1+: +50% shell damage. Volley is 1 / 1 / 2 / 3 shots. Rank 3 slowly repairs the hull.",
      ],
      ["Speed", "1 tile per tick on patrol. Hunts at 2 steps per tick."],
      [
        "Cost",
        "First hull $250,000, then $500,000, $750,000, cap $1,000,000. Spawns from the nearest Harbor.",
      ],
    ],
    play: "Click water to set a patrol box. It captures enemy <a href=\"trader-ship.html\">trader ships</a>, fights <a href=\"marauder.html\">Marauders</a> and <a href=\"transport.html\">Transports</a>, and can bombard coastal buildings. Near a friendly Harbor it heals faster.",
  },
  {
    slug: "marauder",
    name: "Marauder",
    ext: "jpg",
    alt: "Marauder art for Claiming Cosmos: a faster Harbor raider hull",
    title: "Marauder — Claiming Cosmos wiki",
    desc: "Marauders in Claiming Cosmos: 500 HP raiders with the same 85-tile guns as a Warship, at half the cost and 1.5× speed.",
    folklore:
      "A Marauder is the cutter you send when a Warship would be late — faster, thinner, and still packing the same reach.",
    facts: [
      [
        "Hit points",
        "500 — half a Warship. One good volley from a ranked Warship will open her.",
      ],
      [
        "Guns",
        "Same 85-tile reach as a Warship, but one shot per volley. Ranked Marauders keep a stacked +20% damage per stripe.",
      ],
      [
        "Speed",
        "1.5× a Warship (about 1.5 tiles per tick; 3 steps when hunting).",
      ],
      [
        "Cost",
        "First hull $125,000, then scaling to a $500,000 cap. Spawns from the nearest Harbor.",
      ],
    ],
    play: "Select and move them like <a href=\"warship.html\">Warships</a>. Use them to run down <a href=\"trader-ship.html\">trader ships</a> and cut <a href=\"transport.html\">Transports</a>. Park a <a href=\"tender.html\">Tender</a> nearby if you are far from a Harbor.",
  },
  {
    slug: "tender",
    name: "Tender",
    ext: "jpg",
    alt: "Tender ship art for Claiming Cosmos: a thick unarmed repair hull",
    title: "Tender — Claiming Cosmos wiki",
    desc: "Tenders in Claiming Cosmos: unarmed 1,200 HP repair ships that heal friendly Warships and Marauders in a 30-tile bubble.",
    folklore:
      "No guns on the rail. The Tender is a floating repair shop — thick hull, and a crew that patches other people's fights.",
    facts: [
      [
        "Hit points",
        "1,200. Heavier than a Warship. Mines take 70% of max HP — she does not one-shot.",
      ],
      [
        "Guns",
        "None. Enemy Warships, Marauders, batteries, and mines can still sink her.",
      ],
      [
        "Heal",
        "1 HP per tick to friendly Warships and Marauders within 30 tiles. Does not stack with Harbor heal; the Harbor wins if both apply.",
      ],
      ["Speed", "Warship patrol speed: 1 tile per tick. No hunt sprint."],
      ["Cost", "$1,000,000 each. Unlimited. Spawns from the nearest Harbor."],
    ],
    play: "Click water to place, same as a <a href=\"warship.html\">Warship</a>. Keep her with the fighting hulls. If your ships are hugging a <a href=\"port.html\">Harbor</a>, she is wasted gold.",
  },
  {
    slug: "transport",
    name: "Transport",
    ext: "jpg",
    alt: "Transport ship art for Claiming Cosmos: a troop ship packed for landing",
    title: "Transport ship — Claiming Cosmos wiki",
    desc: "Transports in Claiming Cosmos carry troops across water. Max 3 boats, light deck guns, thin hulls.",
    folklore:
      "Not every hull is hunting. Some are a beach in motion — crates, barrels, and a company packed rail to rail.",
    facts: [
      [
        "Hit points",
        "A thin hull. One shell, mine, or ranked volley typically sends her down with the troops still aboard.",
      ],
      [
        "Guns",
        "Light deck guns at half a Warship's grab: about 42 tiles.",
      ],
      [
        "Capacity",
        "Carries the troops you send. Max 3 Transports at once. No gold cost — you pay in people.",
      ],
      [
        "Retreat",
        "Calling her back costs 25% of the troops on board.",
      ],
    ],
    play: "Send a Transport at a coast. Escort her — <a href=\"naval-mine.html\">Naval Mines</a>, <a href=\"port-gun.html\">Anti-ship Batteries</a>, <a href=\"warship.html\">Warships</a>, and <a href=\"marauder.html\">Marauders</a> all love a loaded boat.",
  },
  {
    slug: "trader-ship",
    name: "Trader Ship",
    ext: "jpg",
    alt: "Trader Ship art for Claiming Cosmos: a merchant hull carrying barrels and crates",
    title: "Trader Ship — Claiming Cosmos wiki",
    desc: "Trader ships in Claiming Cosmos sail between harbors for gold. Capture them with Warships; mines ignore them.",
    folklore:
      "A Trader Ship is not a prize until a Warship makes her one. Harbors keep sending them because gold does not swim by itself.",
    facts: [
      [
        "Hit points",
        "Not a fighting hull. Warships usually capture her. Mines skip her on purpose.",
      ],
      [
        "Gold",
        "Spawned automatically from Harbors. Completing a run pays both harbors; longer trips pay more.",
      ],
      [
        "Trade stops",
        "Attacking pauses trade for 5 minutes, unless you become allies. You can also Stop / Start trading by hand.",
      ],
      [
        "Piracy",
        "Capture with a Warship or Marauder and the gold walks to the captor.",
      ],
    ],
    play: "Build more <a href=\"port.html\">Harbors</a> if you want more trade. Guard your lanes with <a href=\"warship.html\">Warships</a>, or hunt the other captain's convoy. <a href=\"naval-mine.html\">Naval mines</a> ignore traders on purpose.",
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
  const rootRel = "../".repeat(depth);
  const css = `${rootRel}css/wiki.css`;
  const favicon = `${rootRel}../images/Favicon.svg`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: canonical,
    image: ogImage ? [`${site}${ogImage}`] : undefined,
    isPartOf: { "@type": "WebSite", name: brand, url: `${site}/` },
    about: { "@type": "VideoGame", name: brand, url: `${site}/` },
  };
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/svg+xml" href="${favicon}" />
    <link rel="apple-touch-icon" href="${site}/images/GameLogo.png" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="${themeColor}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${brand}" />
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
        <a class="brand" href="${site}/">${brand}</a>
        <a class="play" href="${site}/">Play this free space strategy game</a>
      </div>
      <nav class="crumbs">${crumbs}</nav>
      ${body}
      <footer class="site">
        <p>
          <a href="${site}/wiki/">${brand} wiki</a>
          ·
          <a href="${site}/">Play ${brand} free</a>
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

copyFromRepo("resources/images/GameLogo.png", "images/brand/logo.png");
for (const m of maps) {
  copyFromRepo(m.localSrc, `images/maps/${mapImg(m)}`);
}
for (const b of buildings) {
  keepBuildingImage(b.slug, b.ext);
}

const hubBody = `
      <h1>${brand} wiki</h1>
      <p class="lede">
        Maps, buildings, and system folklore for
        <a href="${site}/">${brand}</a> —
        a free space territorial strategy game in the browser. Harbor fleets
        on planet water, Starport fleets in the void.
      </p>
      <p>
        Start with the
        <a href="maps/">map guides</a>
        or the
        <a href="buildings/">building roster</a>.
        Then
        <a href="${site}/">play Claiming Cosmos</a>
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
    title: `${brand} wiki — maps and buildings`,
    description: `Wiki for ${brand}, a free space strategy game in the browser. Cosmic maps, Harbors, Starports, fleets, and how to play.`,
    canonical: `${site}/wiki/`,
    ogImage: "/wiki/images/maps/sol-system.png",
    ogAlt: `Sol System map from ${brand}`,
    depth: 0,
    crumbs: `<a href="${site}/">Home</a> / Wiki`,
    body: hubBody,
  }),
);

write(
  "maps/index.html",
  shell({
    title: `Maps — ${brand} wiki`,
    description: `All featured maps in ${brand}: Collision, Sol System, Shattered, Event Horizon, One Big World, and more.`,
    canonical: `${site}/wiki/maps/`,
    ogImage: "/wiki/images/maps/collision.jpg",
    ogAlt: `Collision map from ${brand}`,
    depth: 1,
    crumbs: `<a href="${site}/">Home</a> / <a href="../">Wiki</a> / Maps`,
    body: `
      <h1>Maps</h1>
      <p class="lede">
        Chart the systems of this
        <a href="${site}/">free space strategy game</a>.
        Each page has original map art, folklore, and a play hint.
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
    title: `Buildings — ${brand} wiki`,
    description: `Buildings and ships in ${brand}: City, Harbor, Anti-ship Battery, Planetary Battery, Factory, Armory, Warship, Marauder, Tender, Transport, Trader Ship, and Naval Mine.`,
    canonical: `${site}/wiki/buildings/`,
    ogImage: "/wiki/images/buildings/port.jpg",
    ogAlt: `Harbor building art from ${brand}`,
    depth: 1,
    crumbs: `<a href="${site}/">Home</a> / <a href="../">Wiki</a> / Buildings`,
    body: `
      <h1>Buildings and ships</h1>
      <p class="lede">
        The roster for this
        <a href="${site}/">browser space strategy game</a>.
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
      <p>See also: ${related} · <a href="${site}/">play ${brand} free</a></p>
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
        <figcaption>${b.name} — labeled art for ${brand}.</figcaption>
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
        <a href="../maps/sol-system.html">Sol System</a>
        and
        <a href="${site}/">play ${brand}</a>
        in the browser.
      </p>
    `,
    }),
  );
}

const marauderMapPages = [
  "twin-isles",
  "foot-island",
  "caldera-island",
  "skull-island",
  "x-marks-the-spot",
  "dragons-fall-island",
  "hollows-isles",
  "hexacephalic-archipelago",
  "ember-isles",
  "tarryn-fjords",
  "vernon",
  "k-island",
  "crackamack-isles",
  "central-south-florida",
  "old-world-miami",
];
for (const slug of marauderMapPages) {
  const file = path.join(wiki, "maps", `${slug}.html`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function sitemapUrl(loc, priority = "0.7") {
  return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const sitemapUrls = [
  sitemapUrl(`${site}/`, "1.0"),
  sitemapUrl(`${site}/wiki/`, "0.9"),
  sitemapUrl(`${site}/wiki/maps/`, "0.8"),
  sitemapUrl(`${site}/wiki/buildings/`, "0.8"),
  ...maps.map((m) => sitemapUrl(`${site}/wiki/maps/${m.slug}.html`)),
  ...buildings.map((b) =>
    sitemapUrl(`${site}/wiki/buildings/${b.slug}.html`),
  ),
  sitemapUrl(`${site}/terms-of-service.html`, "0.3"),
  sitemapUrl(`${site}/privacy-policy.html`, "0.3"),
];

fs.writeFileSync(
  path.join(root, "resources", "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join("\n")}
</urlset>
`,
);

console.log(
  `Wrote wiki: ${maps.length} maps, ${buildings.length} buildings → ${site}`,
);
