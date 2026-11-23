"use strict";
/* VOVA: RUN RUN RUN — data (facts, phases, challenges, formatting) */
const VERSION = "1.4";
const SAVE_KEY = "vova_run_save_v1", SAVE_BAK = "vova_run_save_v1_bak", PID_KEY = "vova_run_pid";
const C_LIGHT = 2.998e8, LY = 9.461e15, AU = 1.496e11;
const EDGE = 4.4e26, EDGE_LG = Math.log10(EDGE), UNI_D = 8.8e26;
const V0 = 0.2, XPS = 10;
const needXP = n => Math.round(XPS * (24 + 0.98 * n));          // levels never end
const R = (() => { // per-level speed multiplier, tuned so ~2h of running reaches the edge
  const d = r => { let s = 0; for (let n = 1; n < 100; n++) s += V0 * Math.pow(r, n - 1) * needXP(n) / XPS; return s; };
  let lo = 1.1, hi = 3; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (d(m) < 3e26) lo = m; else hi = m; } return lo;
})();
const speedOf = L => V0 * Math.pow(R, Math.min(L, 1150) - 1);
const lgOf = d => Math.log10(Math.max(1, d));

/* ---------- Phases (hidden until reached) ---------- */
const PHASES = [
  {n:"Earth", ic:"🌏", lg:-99},
  {n:"Earth & Moon", ic:"🌙", lg:4.9},
  {n:"The Solar System", ic:"☀️", lg:9.6},
  {n:"The Stars", ic:"✨", lg:13.3},
  {n:"The Milky Way", ic:"🌌", lg:19.0},
  {n:"The Galaxies", ic:"🌀", lg:21.2},
  {n:"The Universe", ic:"🕸️", lg:23.3},
  {n:"The Multiverse", ic:"🌈", lg:EDGE_LG}
];
function phaseOf(lg, mv) { if (mv) return 7; let p = 0; for (let i = 0; i < 7; i++) if (lg >= PHASES[i].lg) p = i; return p; }
function placeName(lg, mv) {
  if (mv) return "The Multiverse";
  if (lg < 2) return "Earth — village road";
  if (lg < 3.3) return "Earth — rice fields";
  if (lg < 4.0) return "Earth — mountain trail";
  if (lg < 4.9) return "Earth — above the clouds";
  if (lg < 7.3) return "Earth & Moon — low orbit";
  if (lg < 9.6) return "Earth & Moon — the long way to the Moon";
  return PHASES[phaseOf(lg)].n;
}

/* ---------- Distance milestones ---------- */
const LANDMARKS = [
  {id:"l_bus",d:12,ic:"🚌",t:"A school bus",x:"12 metres — about one school bus."},
  {id:"l_pool",d:50,ic:"🏊",t:"Olympic pool",x:"50 m — the length of an Olympic swimming pool."},
  {id:"l_pitch",d:105,ic:"⚽",t:"Football pitch",x:"About 105 m — the length of a full-size football pitch."},
  {id:"l_eiffel",d:330,ic:"🗼",t:"Eiffel Tower",x:"330 m — the height of the Eiffel Tower, laid on its side."},
  {id:"l_burj",d:828,ic:"🏙️",t:"Burj Khalifa",x:"828 m — the world's tallest building, in Dubai."},
  {id:"l_everest",d:8849,ic:"🏔️",t:"Mount Everest",x:"8,849 m — Earth's highest mountain above sea level. Passenger jets cruise at about 10–12 km."},
  {id:"l_trench",d:10935,ic:"🌊",t:"Mariana Trench",x:"About 10,900 m — the deepest point of the ocean. Everest would fit inside with 2 km of water to spare."},
  {id:"l_marathon",d:42195,ic:"🏅",t:"A marathon",x:"42.195 km — the official marathon distance."},
  {id:"l_karman",d:1e5,ic:"🎈",t:"Edge of space",x:"100 km — the Kármán line, a common boundary between Earth's atmosphere and outer space."},
  {id:"l_iss",d:4.08e5,ic:"🛰️",t:"Space Station altitude",x:"About 400 km — the height of the International Space Station, which circles Earth every ~90 minutes."},
  {id:"l_vietnam",d:1.65e6,ic:"🇻🇳",t:"The length of Vietnam",x:"About 1,650 km — roughly Vietnam's length from north to south."},
  {id:"l_earthd",d:1.2742e7,ic:"🌍",t:"Earth's diameter",x:"12,742 km — straight through the middle of the Earth."},
  {id:"l_geo",d:3.5786e7,ic:"📡",t:"Geostationary orbit",x:"35,786 km up — where TV and weather satellites stay above one spot on Earth."},
  {id:"l_equator",d:4.0075e7,ic:"🌐",t:"Around the Earth",x:"40,075 km — once around Earth's equator. Light does this about 7.5 times every second."},
  {id:"l_moon",d:3.844e8,ic:"🌙",t:"The Moon",x:"384,400 km on average. All the other planets of the Solar System could just about fit in the gap between Earth and Moon."},
  {id:"l_jwst",d:1.5e9,ic:"🔭",t:"James Webb Space Telescope",x:"About 1.5 million km — the Sun–Earth L2 point, where JWST orbits."},
  {id:"l_venus",d:3.8e10,ic:"🟡",t:"Venus (closest)",x:"About 38 million km — Venus at its closest. It's the planet that comes nearest to Earth."},
  {id:"l_mars",d:5.5e10,ic:"🔴",t:"Mars (closest)",x:"About 55 million km at a close approach. Usually it's much farther — up to ~400 million km."},
  {id:"l_sun",d:AU,ic:"☀️",t:"The Sun — 1 AU",x:"150 million km = 1 astronomical unit (AU). Sunlight takes about 8 minutes 20 seconds to get here."},
  {id:"l_jupiter",d:6.3e11,ic:"🟠",t:"Jupiter",x:"About 630 million km at its closest. Jupiter is so big that all the other planets could fit inside it."},
  {id:"l_saturn",d:1.27e12,ic:"🪐",t:"Saturn",x:"About 1.3 billion km. Its rings are ~280,000 km wide but often only about 10 metres thick."},
  {id:"l_neptune",d:4.3e12,ic:"🔵",t:"Neptune",x:"About 4.3 billion km (~29 AU). One Neptune year lasts 165 Earth years."},
  {id:"l_pluto",d:5.9e12,ic:"⚪",t:"Pluto",x:"About 5.9 billion km on average (~39 AU). Sunlight takes around 5.5 hours to reach it."},
  {id:"l_helio",d:1.8e13,ic:"🫧",t:"The heliopause",x:"About 120 AU — where the Sun's wind gives way to interstellar space. Voyager 1 crossed it in 2012."},
  {id:"l_lday",d:2.59e13,ic:"📡",t:"One light-day — Voyager 1",x:"About 26 billion km = 1 light-day. Voyager 1, humanity's farthest spacecraft (launched 1977), is reaching about this distance around late 2026."},
  {id:"l_oort",d:3e14,ic:"☄️",t:"Oort Cloud",x:"About 2,000 AU — roughly where the Oort Cloud, a huge shell of icy comets, is thought to begin."},
  {id:"l_ly",d:LY,ic:"✨",t:"One light-year",x:"9.46 trillion km — the distance light travels in one year."},
  {id:"l_proxima",d:4.0e16,ic:"⭐",t:"Proxima Centauri",x:"4.24 light-years — the nearest star to the Sun. Voyager 1 would need over 70,000 years to get this far."},
  {id:"l_sirius",d:8.1e16,ic:"💎",t:"Sirius",x:"8.6 light-years — the brightest star in our night sky."},
  {id:"l_pleiades",d:4.2e18,ic:"🌟",t:"The Pleiades",x:"About 440 light-years — the Seven Sisters star cluster. The light you see left them around the 1580s."},
  {id:"l_betel",d:5.2e18,ic:"🔴",t:"Betelgeuse",x:"Roughly 550 light-years — a red supergiant in Orion. In the Sun's place it would swallow the orbit of Mars, maybe Jupiter."},
  {id:"l_orion",d:1.27e19,ic:"🌫️",t:"Orion Nebula",x:"About 1,340 light-years — a star nursery you can see with your naked eye as a fuzzy patch."},
  {id:"l_gc",d:2.46e20,ic:"🕳️",t:"Center of the Milky Way",x:"About 26,000 light-years. A black hole of ~4 million Suns — Sagittarius A* — sits here."},
  {id:"l_mw",d:9.46e20,ic:"🌌",t:"Across the Milky Way",x:"About 100,000 light-years — the width of our galaxy, home to 100–400 billion stars."},
  {id:"l_lmc",d:1.5e21,ic:"☁️",t:"Large Magellanic Cloud",x:"About 160,000 light-years — a small galaxy orbiting the Milky Way, visible from the Southern Hemisphere."},
  {id:"l_andro",d:2.4e22,ic:"🌀",t:"Andromeda Galaxy",x:"About 2.5 million light-years — the farthest thing most people can see with the naked eye."},
  {id:"l_lg",d:9.5e22,ic:"🏘️",t:"The Local Group",x:"About 10 million light-years across — our galaxy's neighbourhood of 80+ galaxies."},
  {id:"l_virgo",d:5.1e23,ic:"🐝",t:"Virgo Cluster",x:"About 54 million light-years — a giant cluster of over 1,000 galaxies."},
  {id:"l_coma",d:3.0e24,ic:"🧲",t:"Coma Cluster",x:"About 320 million light-years. Studying it in the 1930s, Fritz Zwicky found the first hint of dark matter."},
  {id:"l_lani",d:4.9e24,ic:"🌊",t:"Laniakea Supercluster",x:"About 520 million light-years across — our home supercluster of ~100,000 galaxies. Its name means 'immense heaven' in Hawaiian."},
  {id:"l_138",d:1.3e26,ic:"⏳",t:"13.8 billion light-years",x:"The universe is 13.8 billion years old — but the edge is farther than 13.8 billion light-years, because space kept expanding while the light travelled."},
  {id:"l_jades",d:3.0e26,ic:"🔭",t:"The farthest galaxies seen",x:"JWST has seen galaxies whose light left them over 13.4 billion years ago. Thanks to expansion, they're now more than 30 billion light-years away."},
  {id:"l_edge",d:EDGE,ic:"🌐",t:"Edge of the observable universe",x:"About 46.5 billion light-years in every direction — about 93 billion across. Beyond here, light hasn't had time to reach us."}
];
/* ---------- Speed milestones ---------- */
const SPEEDS = [
  {id:"s_tortoise",v:0.2,ic:"🐢",t:"Tortoise pace",x:"0.7 km/h. A giant tortoise walks at about this speed. Everyone starts somewhere!"},
  {id:"s_walk",v:1.4,ic:"🚶",t:"Walking speed",x:"About 5 km/h — a normal human walk."},
  {id:"s_jog",v:3,ic:"🏃",t:"Jogging",x:"About 11 km/h — a steady jog."},
  {id:"s_bolt",v:12.4,ic:"⚡",t:"Usain Bolt's top speed",x:"About 44.7 km/h — the fastest a human has ever been measured running (2009)."},
  {id:"s_cheetah",v:29,ic:"🐆",t:"Cheetah sprint",x:"About 100–110 km/h — the fastest land animal, but only for short bursts."},
  {id:"s_f1",v:103,ic:"🏎️",t:"Formula 1 top speed",x:"About 370 km/h — F1 cars on the fastest tracks."},
  {id:"s_falcon",v:108,ic:"🦅",t:"Peregrine falcon dive",x:"About 390 km/h — the fastest animal on Earth, diving for prey."},
  {id:"s_jet",v:250,ic:"✈️",t:"Passenger jet",x:"About 900 km/h — cruising speed of an airliner."},
  {id:"s_sound",v:343,ic:"💥",t:"Speed of sound",x:"343 m/s (1,235 km/h) in air at 20 °C. SONIC BOOM!"},
  {id:"s_spin",v:465,ic:"🌍",t:"Earth's spin",x:"465 m/s — how fast the ground at the equator moves as Earth rotates. You're always moving this fast and never feel it."},
  {id:"s_sr71",v:983,ic:"🛩️",t:"SR-71 Blackbird",x:"About 3,540 km/h — the fastest crewed air-breathing jet ever flown."},
  {id:"s_iss",v:7660,ic:"🛰️",t:"Orbital speed",x:"7.66 km/s — the ISS's speed. Astronauts see about 16 sunrises a day."},
  {id:"s_escape",v:11186,ic:"🚀",t:"Escape velocity",x:"11.2 km/s — fast enough to escape Earth's gravity without more engine thrust."},
  {id:"s_voyager",v:17000,ic:"📡",t:"Voyager 1",x:"About 17 km/s — the speed of humanity's farthest probe, leaving the Solar System."},
  {id:"s_orbit",v:29780,ic:"☀️",t:"Earth around the Sun",x:"29.8 km/s — Earth's speed around the Sun. One lap is about 940 million km per year."},
  {id:"s_parker",v:191700,ic:"🔥",t:"Parker Solar Probe",x:"About 192 km/s — the fastest object humans have ever built, swinging past the Sun."},
  {id:"s_galaxy",v:230000,ic:"🌌",t:"The Sun around the galaxy",x:"About 230 km/s. Even so, one lap around the Milky Way takes about 230 million years."},
  {id:"s_cmb",v:6.0e5,ic:"🏁",t:"Milky Way through the cosmos",x:"About 600 km/s — our whole galaxy's motion relative to the cosmic microwave background."},
  {id:"s_10c",v:3.0e7,ic:"💫",t:"10% of light speed",x:"30,000 km/s. Earth to Moon in about 13 seconds."},
  {id:"s_c",v:C_LIGHT,ic:"💡",t:"THE SPEED OF LIGHT",x:"299,792 km/s — the cosmic speed limit. Real things with mass can never reach it… but Vova runs on cartoon physics. 😎"},
  {id:"s_aus",v:AU,ic:"☀️",t:"1 AU per second",x:"Earth to Sun every second — light needs 8 min 20 s for that. You're 500× faster than light."},
  {id:"s_lys",v:LY,ic:"✨",t:"1 light-year per second",x:"About 31.5 million times the speed of light."},
  {id:"s_mws",v:9.46e20,ic:"🌌",t:"1 Milky Way per second",x:"Crossing our entire galaxy — 100,000 light-years — every second."},
  {id:"s_and",v:2.4e22,ic:"🌀",t:"Andromeda per second",x:"2.5 million light-years every second. A light beam would need 2.5 million years."},
  {id:"s_100m",v:9.5e23,ic:"🕸️",t:"100 million light-years per second",x:"Superclusters fly past like streetlights."},
  {id:"s_uni",v:UNI_D,ic:"🌐",t:"One universe per second",x:"The whole observable universe — 93 billion light-years — every second."}
];
const MULTI_FACTS = [
  {id:"m_0",ic:"🌈",t:"Welcome to the Multiverse",x:"From here on it's imagination: no one has found evidence of other universes. But many physicists take the idea seriously."},
  {id:"m_1",ic:"🫧",t:"Bubble universes",x:"Eternal inflation suggests space may keep inflating forever, with 'bubble' universes like ours forming inside it."},
  {id:"m_2",ic:"🔀",t:"Many-Worlds",x:"Hugh Everett's 1957 Many-Worlds interpretation of quantum mechanics says every quantum outcome happens — each in its own branch of reality."},
  {id:"m_3",ic:"🎻",t:"The string landscape",x:"String theory may allow around 10^500 different possible vacuums — each could give a universe with different laws of physics."},
  {id:"m_4",ic:"🪜",t:"Tegmark's four levels",x:"Physicist Max Tegmark sorted multiverse ideas into four levels: beyond our horizon, bubble universes, quantum branches, and other mathematical structures."},
  {id:"m_5",ic:"👯",t:"Your distant twin",x:"If space is infinite, Tegmark estimated an identical copy of you might exist around 10^(10^29) metres away. Keep running!"},
  {id:"m_6",ic:"♾️",t:"Cyclic universes",x:"Some ideas, like Roger Penrose's conformal cyclic cosmology, picture universes following one another in an endless chain of 'aeons'."},
  {id:"m_7",ic:"📄",t:"Brane worlds",x:"In some string-inspired models, our universe is a 3D 'brane' floating in higher-dimensional space, maybe next to other branes."}
];

/* ---------- Challenges ----------
 type race:   beat a rival over distance D (rival speed `need`). Hold → to run, ↑↓ to dodge.
 type escape: climb out of a gravity well; need speed ≥ escape velocity. Stop and you fall back.
 type hold:   keep up for a while; need speed ≥ `need`.
 obs = obstacle level 0–3, ph = phase that reveals it (0-based)                                 */
const CHALLENGES = [
  // Earth
  {id:"c_snail",ph:0,type:"race",ic:"🐌",need:0.013,D:1,t:"Race a garden snail",i:"One metre. How hard can it be?",w:"Snails glide on a thin layer of slime. Even a quick one only covers about a metre a minute."},
  {id:"c_walk",ph:0,type:"race",ic:"🚶",need:1.4,D:100,t:"Race a person walking",i:"100 m against an ordinary walk.",w:"A normal walk is about 5 km/h. Walking 100 m takes about 70 seconds."},
  {id:"c_bolt",ph:0,type:"race",ic:"⚡",need:10.44,D:100,obs:1,t:"Race Usain Bolt",i:"100 m against the world record holder.",w:"Bolt's world record is 9.58 s (Berlin, 2009) — an average of 37.6 km/h, peaking around 44.7 km/h."},
  {id:"c_cat",ph:0,type:"race",ic:"🐈",need:13.4,D:50,t:"Race a house cat",i:"The cat saw a bird. 50 m sprint.",w:"Pet cats can sprint at roughly 48 km/h in short bursts — faster than Usain Bolt."},
  {id:"c_horse",ph:0,type:"race",ic:"🐎",need:19.4,D:400,obs:1,t:"Race a racehorse",i:"400 m against a galloping thoroughbred.",w:"Racehorses gallop at about 60–70 km/h, carrying a rider the whole way."},
  {id:"c_cheetah",ph:0,type:"race",ic:"🐆",need:29,D:200,obs:2,t:"Run with a cheetah",i:"200 m across the savanna. Dodge the bushes!",w:"Cheetahs reach about 100–110 km/h and accelerate faster than most sports cars — but they can only sprint a few hundred metres before resting."},
  {id:"c_train",ph:0,type:"race",ic:"🚄",need:88.9,D:5000,t:"Race a bullet train",i:"5 km against a Shinkansen.",w:"Japan's Shinkansen trains run at up to 320 km/h in regular service."},
  {id:"c_falcon",ph:0,type:"race",ic:"🦅",need:108,D:1000,obs:1,t:"Race a diving falcon",i:"A peregrine falcon is diving. Keep up!",w:"Peregrines tuck their wings and dive at around 390 km/h. Little bony cones in their nostrils help them breathe at that speed."},
  {id:"c_thunder",ph:0,type:"race",ic:"⛈️",need:343,D:3430,t:"Outrun the thunder",i:"Lightning struck 3.4 km away. Beat its sound!",w:"Sound travels about 1 km every 3 seconds. Count seconds between lightning and thunder, divide by 3 — that's the distance in km."},
  {id:"c_sunset",ph:0,type:"hold",ic:"🌇",need:465,body:"sunset",t:"Chase the sunset",i:"At the equator, run west fast enough that the Sun never sets.",w:"The equator spins east at 465 m/s. Run west faster and the Sun stops setting. Flying west, Concorde could land in New York 'before' it left London by the clock."},
  {id:"c_bullet",ph:0,type:"race",ic:"🔫",need:900,D:1000,obs:2,t:"Race a rifle bullet",i:"1 km downrange. Don't get hit by anything!",w:"Many rifle bullets fly at roughly 800–1,000 m/s — faster than sound, so the bullet arrives before the bang."},
  {id:"c_earth",ph:0,type:"escape",ic:"🌍",need:11186,body:"earth",obs:2,t:"Escape Earth's gravity",i:"No rockets. Just legs. Dodge the space junk!",w:"From the ground you need 11.2 km/s to escape Earth for good (ignoring air). Rockets reach it gradually, burning fuel as they climb."},
  // Earth & Moon
  {id:"c_iss",ph:1,type:"race",ic:"🛰️",need:7660,D:4.0075e7,t:"Race the ISS around the world",i:"Once around the planet against the Space Station.",w:"The ISS laps Earth in about 90 minutes. The crew sees around 16 sunrises and sunsets every day."},
  {id:"c_apollo",ph:1,type:"race",ic:"🚀",need:1480,D:3.844e8,t:"Race Apollo 11 to the Moon",i:"July 1969. Armstrong, Aldrin and Collins are on their way.",w:"Apollo 11 launched on 16 July 1969 and reached lunar orbit about 3 days later. The landing came on 20 July."},
  {id:"c_moon",ph:1,type:"escape",ic:"🌙",need:2380,body:"moon",obs:1,t:"Escape the Moon",i:"Run off the Moon without a rocket.",w:"The Moon's escape velocity is only 2.4 km/s — about a fifth of Earth's. That's why Apollo's small ascent stage could get back to orbit."},
  {id:"c_laser",ph:1,type:"race",ic:"🔦",need:C_LIGHT,D:3.844e8,t:"Beat a laser to the Moon",i:"Someone just fired a laser at the Moon.",w:"Light takes about 1.3 seconds to reach the Moon. Scientists bounce lasers off mirrors left by Apollo astronauts to measure the distance to within centimetres."},
  // Solar System
  {id:"c_photon",ph:2,type:"race",ic:"💡",need:2.2e-4,D:6.96e8,t:"Beat a photon out of the Sun",i:"A photon is born in the Sun's core. Race it to the surface.",w:"Light in the Sun's core is absorbed and re-emitted countless times. Estimates say it takes thousands to over 100,000 years to reach the surface — then just 8 minutes to Earth."},
  {id:"c_neptune",ph:2,type:"hold",ic:"🌪️",need:580,body:"wind",obs:1,t:"Run into Neptune's winds",i:"The fastest winds in the Solar System. Don't get blown back!",w:"Neptune's winds reach about 2,000 km/h — the fastest of any planet, even though it's so far from the Sun."},
  {id:"c_belt",ph:2,type:"hold",ic:"☄️",need:20000,body:"rocks",obs:3,t:"Dash through the asteroid belt",i:"Rocks everywhere! (Or are there?)",w:"Movies lie! The real asteroid belt is mostly empty — big asteroids are usually hundreds of thousands of km apart. Spacecraft fly through without dodging."},
  {id:"c_jupiter",ph:2,type:"escape",ic:"🟠",need:59500,body:"jupiter",obs:1,t:"Escape Jupiter",i:"The king of planets wants to keep you.",w:"Jupiter's escape velocity is about 59.5 km/s — over 5 times Earth's. Spacecraft use its gravity as a slingshot to speed up."},
  {id:"c_sun",ph:2,type:"escape",ic:"☀️",need:617700,body:"sun",obs:2,t:"Escape the Sun",i:"From the surface. Dodge the solar flares!",w:"The Sun's surface escape velocity is about 618 km/s. The Sun holds 99.8% of all the mass in the Solar System."},
  {id:"c_parker",ph:2,type:"race",ic:"🔥",need:191700,D:AU,t:"Race the Parker Solar Probe",i:"The fastest machine ever built. 1 AU race.",w:"Parker hit about 192 km/s in December 2024, passing just 6.1 million km above the Sun's surface."},
  {id:"c_sunlight",ph:2,type:"race",ic:"🌞",need:C_LIGHT,D:AU,t:"Beat sunlight to Earth",i:"A ray of sunlight just left the Sun.",w:"Sunlight takes about 8 min 20 s to arrive. If the Sun vanished, we wouldn't notice for 8 minutes — even its gravity travels at light speed."},
  // Stars
  {id:"c_voyager",ph:3,type:"race",ic:"📡",need:17000,D:4.0e16,t:"Race Voyager 1 to the nearest star",i:"4.24 light-years. Voyager has a head start of 49 years.",w:"At 17 km/s Voyager 1 would need over 70,000 years to cover the distance to Proxima Centauri — and it isn't even aimed that way."},
  {id:"c_proxima",ph:3,type:"race",ic:"⭐",need:C_LIGHT,D:4.0e16,t:"Race light to Proxima Centauri",i:"The nearest star. Light versus Vova.",w:"Light needs 4.24 years. When you look at Proxima, you see it as it was over four years ago."},
  {id:"c_doppler",ph:3,type:"hold",ic:"🚦",need:8.1e7,body:"doppler",t:"Turn a red light green",i:"Run at a red traffic light so fast it looks green.",w:"At ~27% of light speed, the Doppler effect squeezes red light (700 nm) into green (~530 nm). The police would fine you for speeding instead!"},
  {id:"c_supernova",ph:3,type:"race",ic:"💥",need:1e7,D:1e13,obs:2,t:"Outrun a supernova",i:"A star just exploded behind you. RUN!",w:"Supernova debris flies out at 10,000 km/s or more. One exploding star can briefly outshine its entire galaxy."},
  {id:"c_wd",ph:3,type:"escape",ic:"⚪",need:6.7e6,body:"wd",obs:1,t:"Escape a white dwarf",i:"Sirius B: a Sun's worth of mass squeezed to Earth size.",w:"A teaspoon of white dwarf matter would weigh tonnes. Escaping one takes thousands of km per second."},
  {id:"c_pulsar",ph:3,type:"hold",ic:"🌀",need:7.2e7,body:"pulsar",obs:1,t:"Keep up with a pulsar",i:"Run as fast as the surface of the fastest-spinning pulsar.",w:"Pulsar PSR J1748−2446ad spins 716 times per second. Its equator moves at roughly a quarter of light speed."},
  {id:"c_ns",ph:3,type:"escape",ic:"🧲",need:1.8e8,body:"ns",obs:2,t:"Escape a neutron star",i:"More than the Sun's mass in a ball ~20 km wide.",w:"A neutron star's escape speed is around half the speed of light or more. A sugar-cube of it would weigh about as much as all humans combined."},
  // Milky Way
  {id:"c_galaxy",ph:4,type:"escape",ic:"🌌",need:5.5e5,body:"galaxy",t:"Escape the Milky Way",i:"Leave our galaxy from the Sun's neighbourhood.",w:"You'd need roughly 550 km/s to leave the Milky Way from here. Most of the pull comes from invisible dark matter."},
  {id:"c_lap",ph:4,type:"race",ic:"☀️",need:2.3e5,D:1.546e21,t:"Lap the galaxy before the Sun",i:"One orbit around the Milky Way's center.",w:"The Sun takes about 230 million years per lap. Last time it was here, the first dinosaurs were just appearing."},
  {id:"c_lightmw",ph:4,type:"race",ic:"💡",need:C_LIGHT,D:9.46e20,t:"Race light across the Milky Way",i:"100,000 light-years, edge to edge.",w:"Light needs about 100,000 years. Starlight from the far side of our galaxy left long before humans built the first cities."},
  {id:"c_photonsphere",ph:4,type:"escape",ic:"🕳️",need:2.448e8,body:"bh",obs:2,t:"Escape Sagittarius A*",i:"Start at the photon sphere, where light itself orbits.",w:"At 1.5× the event-horizon radius, light can circle the black hole. Escaping from there takes about 82% of light speed."},
  {id:"c_horizon",ph:4,type:"escape",ic:"⚫",need:4.24e8,body:"bh",obs:3,t:"Escape from INSIDE a black hole",i:"You fell past the event horizon. Good luck.",w:"In real physics this is impossible: inside the horizon every path leads inward, even for light. Vova's cartoon physics just broke the universe. 😎"},
  // Galaxies
  {id:"c_andro",ph:5,type:"race",ic:"🌀",need:1.1e5,D:2.4e22,t:"Reach Andromeda before it reaches us",i:"Andromeda is coming. Meet it halfway — no, all the way.",w:"Andromeda approaches at about 110 km/s. In ~4–5 billion years the two galaxies will merge — but stars are so far apart they'll almost never collide."},
  {id:"c_andlight",ph:5,type:"race",ic:"✨",need:C_LIGHT,D:2.4e22,t:"Race Andromeda's light",i:"Beat its light to Earth.",w:"The Andromeda light you see tonight left 2.5 million years ago, before modern humans existed."},
  {id:"c_attractor",ph:5,type:"hold",ic:"🧲",need:6e5,body:"galaxy",obs:1,t:"Resist the Great Attractor",i:"Something huge is pulling our whole neighbourhood.",w:"Our Local Group drifts at ~600 km/s through the cosmos, partly toward the 'Great Attractor', a mass hidden behind the Milky Way's dusty disk."},
  // Universe
  {id:"c_hubble",ph:6,type:"hold",ic:"🎈",need:4.3e8,body:"universe",obs:1,t:"Outrun the expansion of space",i:"Catch a galaxy 20 billion light-years away.",w:"Space grows about 70 km/s for every 3.26 million light-years. Galaxies beyond ~14 billion light-years recede faster than light — allowed, because space itself stretches."},
  {id:"c_icecream",ph:6,type:"race",ic:"🍦",need:1.47e24,D:UNI_D,t:"Cross the universe before your ice cream melts",i:"93 billion light-years. 10 minutes. Go!",w:"93 billion light-years in under 10 minutes. The ice cream is still cold. Physics is not."},
  // Multiverse
  {id:"c_uni1",ph:7,type:"race",ic:"🌐",need:UNI_D,D:UNI_D,t:"Cross a whole universe in 1 second",i:"One universe. One second.",w:"You crossed 93 billion light-years in a heartbeat. Light would need 93 billion years."},
  {id:"c_inflation",ph:7,type:"hold",ic:"🎆",need:1e28,body:"universe",obs:2,t:"Keep up with cosmic inflation",i:"Go back to the first instant of time and race the inflating universe.",w:"In about 10⁻³² of a second, inflation may have stretched space by a factor of at least 10²⁶. It explains why our universe looks so smooth and flat."},
  {id:"c_uni10",ph:7,type:"race",ic:"♾️",need:8.8e27,D:8.8e27,obs:3,t:"Cross 10 universes in 1 second",i:"Ten universes. One second. Dodge the bubbles!",w:"Tegmark's Level II multiverse imagines endless bubble universes — and you just ran through ten of them in a second."}
];

const ALL_FACTS = {};
LANDMARKS.forEach(f => ALL_FACTS[f.id] = {...f, k:"place", ph:phaseOf(lgOf(f.d))});
SPEEDS.forEach(f => ALL_FACTS[f.id] = {...f, k:"speed"});
MULTI_FACTS.forEach(f => ALL_FACTS[f.id] = {...f, k:"multi", ph:7});

/* ---------- Formatting ---------- */
const SUP = {"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻"};
function sci(x, dp = 2) { if (x === 0) return "0"; const e = Math.floor(Math.log10(x)); const m = x / Math.pow(10, e); return m.toFixed(dp) + "×10" + String(e).split("").map(c => SUP[c]).join(""); }
function num(x, dp = 0) { return x.toLocaleString("en-US", {maximumFractionDigits: dp, minimumFractionDigits: 0}); }
function big(x, unit) {
  if (x < 1e3) return num(x, x < 10 ? 2 : x < 100 ? 1 : 0) + " " + unit;
  if (x < 1e6) return num(x, 0) + " " + unit;
  if (x < 1e9) return num(x / 1e6, 2) + " million " + unit;
  if (x < 1e12) return num(x / 1e9, 2) + " billion " + unit;
  if (x < 1e15) return num(x / 1e12, 2) + " trillion " + unit;
  return sci(x) + " " + unit;
}
function fmtDist(m) {
  if (m < 0.01) return num(m * 1000, 1) + " mm";
  if (m < 1000) return num(m, m < 10 ? 2 : 1) + " m";
  if (m < 0.1 * AU) return big(m / 1000, "km");
  if (m < 0.05 * LY) return num(m / AU, m < 10 * AU ? 2 : 1) + " AU";
  return big(m / LY, "light-years");
}
function fmtSpeed(v) {
  if (v < 0.01) return num(v * 1000, 2) + " mm/s";
  if (v < 278) return num(v * 3.6, v < 3 ? 2 : 1) + " km/h";
  if (v < 0.01 * C_LIGHT) return big(v / 1000, "km/s");
  return big(v / C_LIGHT, "× light speed");
}
function fmtTime(s) {
  if (!isFinite(s)) return "∞";
  if (s < 0.001) return "an instant";
  if (s < 1) return num(s * 1000, 0) + " ms";
  if (s < 60) return num(s, s < 10 ? 1 : 0) + " s";
  if (s < 3600) return Math.floor(s / 60) + "m " + Math.floor(s % 60) + "s";
  if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
  const d = s / 86400;
  if (d < 365.25) return num(d, d < 10 ? 1 : 0) + " days";
  return big(d / 365.25, "years");
}
// "you'd ... in X" — only things the player has already discovered
const COMPARE = [
  {d:105, n:"cross a football pitch", id:"l_pitch"}, {d:42195, n:"run a marathon", id:"l_marathon"}, {d:4.0075e7, n:"lap the Earth", id:"l_equator"},
  {d:3.844e8, n:"reach the Moon", id:"l_moon"}, {d:AU, n:"reach the Sun", id:"l_sun"}, {d:5.9e12, n:"reach Pluto", id:"l_pluto"},
  {d:4.0e16, n:"reach the nearest star", id:"l_proxima"}, {d:9.46e20, n:"cross the Milky Way", id:"l_mw"},
  {d:2.4e22, n:"reach Andromeda", id:"l_andro"}, {d:4.9e24, n:"cross Laniakea", id:"l_lani"}, {d:UNI_D, n:"cross the observable universe", id:"l_edge"}
];
function compareLine(v, seen) {
  let best = null;
  for (const c of COMPARE) { if (!seen.includes(c.id)) continue; const t = c.d / v; best = {c, t}; if (t >= 0.5) break; }
  return best ? "→ you'd " + best.c.n + " in " + fmtTime(best.t) : "";
}

/* ---------- Unit converter (tap ⇄ in the HUD) ---------- */
const SPEED_UNITS = [
  {n:"auto"}, {n:"km/h", f:3.6}, {n:"mph", f:2.236936}, {n:"m/s", f:1}, {n:"km/s", f:1e-3}, {n:"miles/s", f:1 / 1609.344},
  {n:"× speed of sound", f:1 / 343}, {n:"× light speed", f:1 / C_LIGHT}, {n:"AU per second", f:1 / AU}, {n:"light-years per hour", f:3600 / LY}
];
const DIST_UNITS = [
  {n:"auto"}, {n:"m", f:1}, {n:"km", f:1e-3}, {n:"miles", f:1 / 1609.344}, {n:"× around the Earth", f:1 / 4.0075e7},
  {n:"AU", f:1 / AU}, {n:"light-years", f:1 / LY}, {n:"parsecs", f:1 / 3.0857e16}
];
// full digits so players see how BIG the numbers really are (up to 10^36, then scientific)
function fullNum(x) {
  if (x === 0) return "0";
  if (x < 0.001) return sci(x, 2);
  if (x < 10) return num(x, 3);
  if (x < 1000) return num(x, 1);
  if (x < 1e36) return Math.round(x).toLocaleString("en-US");
  return sci(x, 3);
}
function fmtSpeedU(v, i) { return !i ? fmtSpeed(v) : fullNum(v * SPEED_UNITS[i].f) + " " + SPEED_UNITS[i].n; }
function fmtDistU(m, i) { return !i ? fmtDist(m) : fullNum(m * DIST_UNITS[i].f) + " " + DIST_UNITS[i].n; }
