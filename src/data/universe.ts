export type WorldId = "archive" | "elsewhere" | "unsolved" | "natural";
export type Localized = { en: string; es: string };
export interface Discovery {
  id: string;
  slug: string;
  title: Localized;
  summary: Localized;
  body: Localized[];
  category: Localized;
  worldId: WorldId;
  position: [number, number, number];
  relatedIds: string[];
  sourceUrls: string[];
  contentType: "article" | "question";
  fictionLabel: false;
  shareImage: string;
  createdAt: string;
}
export const worlds: {
  id: WorldId;
  name: Localized;
  description: Localized;
  color: string;
  symbol: string;
}[] = [
  {
    id: "archive",
    name: { en: "The Archive", es: "El Archivo" },
    description: {
      en: "Ideas that change the way you see.",
      es: "Ideas que cambian tu forma de ver.",
    },
    color: "#E6C58B",
    symbol: "01",
  },
  {
    id: "elsewhere",
    name: { en: "The Elsewhere", es: "Otros Lugares" },
    description: {
      en: "Earth, stranger than fiction.",
      es: "La Tierra supera la ficción.",
    },
    color: "#c99de8",
    symbol: "02",
  },
  {
    id: "unsolved",
    name: { en: "The Unsolved", es: "Lo Inexplorado" },
    description: {
      en: "Good questions. Open horizons.",
      es: "Buenas preguntas. Horizontes abiertos.",
    },
    color: "#8eafff",
    symbol: "03",
  },
  {
    id: "natural",
    name: { en: "The Natural World", es: "El Mundo Natural" },
    description: {
      en: "Extraordinary things, already here.",
      es: "Lo extraordinario ya está aquí.",
    },
    color: "#78D9CC",
    symbol: "04",
  },
];
const d = (
  id: string,
  worldId: WorldId,
  title: Localized,
  summary: Localized,
  body: Localized[],
  relatedIds: string[],
  source: string,
  index: number,
  contentType: "article" | "question" = "article",
): Discovery => ({
  id,
  slug: id,
  title,
  summary,
  body,
  worldId,
  category: worlds.find((w) => w.id === worldId)!.name,
  position: [index === 0 ? -7 : 7, index === 0 ? 0 : 1, -12 - index * 6],
  relatedIds,
  sourceUrls: [source],
  contentType,
  fictionLabel: false,
  shareImage: "/og.svg",
  createdAt: "2026-10-27",
});
export const discoveries: Discovery[] = [
  d(
    "a-day-longer-than-a-year",
    "archive",
    { en: "A day longer than a year", es: "Un día más largo que un año" },
    {
      en: "On Venus, the clock has a different idea.",
      es: "En Venus, el reloj sigue otras reglas.",
    },
    [
      {
        en: "Venus takes about 243 Earth days to rotate once, but about 225 to orbit the Sun. Its sidereal day is longer than its year. A solar day, measured from one sunrise to the next, is different: about 117 Earth days.",
        es: "Venus tarda unos 243 días terrestres en girar una vez y unos 225 en dar la vuelta al Sol. Su día sideral dura más que su año. El día solar, de un amanecer al siguiente, es distinto: unos 117 días terrestres.",
      },
      {
        en: "The distinction is a small reminder that even a familiar word like “day” depends on where—and how—you measure it.",
        es: "Esta distinción nos recuerda que incluso una palabra tan familiar como «día» depende de dónde y cómo se mida.",
      },
    ],
    ["worlds-around-other-suns", "light-written-in-the-sky"],
    "https://science.nasa.gov/venus/venus-facts/",
    0,
  ),
  d(
    "worlds-around-other-suns",
    "archive",
    { en: "Worlds around other suns", es: "Mundos alrededor de otros soles" },
    {
      en: "Our solar system is one chapter, not the whole book.",
      es: "Nuestro sistema solar es un capítulo, no todo el libro.",
    },
    [
      {
        en: "An exoplanet is a planet outside our solar system. Many orbit other stars; some travel without a host star. Astronomers can detect planets by the slight dimming when one passes in front of its star, or by the star’s motion under a planet’s gravitational pull.",
        es: "Un exoplaneta es un planeta fuera de nuestro sistema solar. Muchos orbitan otras estrellas; algunos viajan sin una estrella anfitriona. Se pueden detectar por la leve disminución de luz al pasar frente a su estrella o por el movimiento de esta debido a la gravedad del planeta.",
      },
      {
        en: "A detection does not tell us that a world is inhabited. It opens a new set of questions about its atmosphere, history and conditions.",
        es: "Detectar un mundo no significa que esté habitado. Abre preguntas sobre su atmósfera, su historia y sus condiciones.",
      },
    ],
    ["a-day-longer-than-a-year", "an-ocean-under-ice"],
    "https://science.nasa.gov/exoplanets/what-is-an-exoplanet/",
    1,
  ),
  d(
    "an-island-of-its-own",
    "elsewhere",
    { en: "An island of its own", es: "Una isla con mundo propio" },
    {
      en: "Socotra makes the familiar shape of a tree feel unfamiliar.",
      es: "Socotra transforma nuestra idea de un árbol.",
    },
    [
      {
        en: "The Socotra Archipelago lies in the northwest Indian Ocean. UNESCO describes an exceptional concentration of species found nowhere else, including more than a third of its plant species. Isolation can make an island a remarkable setting for evolution.",
        es: "El archipiélago de Socotra está en el noroeste del océano Índico. La UNESCO destaca su concentración excepcional de especies exclusivas, entre ellas más de un tercio de sus especies vegetales. El aislamiento convierte a una isla en un escenario extraordinario para la evolución.",
      },
      {
        en: "Think of an island as a living archive: its inhabitants preserve histories of separation, adaptation and connection. The imaginary islands in BEYOND borrow this metaphor; they are not models of Socotra.",
        es: "Una isla puede ser un archivo vivo de separación, adaptación y conexión. Las islas imaginarias de BEYOND retoman esa metáfora; no son modelos de Socotra.",
      },
    ],
    ["cities-inside-stone", "the-animals-that-build-reefs"],
    "https://whc.unesco.org/en/list/1263",
    0,
  ),
  d(
    "cities-inside-stone",
    "elsewhere",
    { en: "Cities inside stone", es: "Ciudades dentro de la piedra" },
    {
      en: "In Cappadocia, landscape and architecture share a material.",
      es: "En Capadocia, paisaje y arquitectura comparten material.",
    },
    [
      {
        en: "Göreme and the rock sites of Cappadocia combine an erosion-shaped landscape with dwellings, underground towns and rock-cut sanctuaries. UNESCO recognizes both the remarkable setting and the cultural record preserved within it.",
        es: "Göreme y los sitios rupestres de Capadocia combinan un paisaje modelado por la erosión con viviendas, ciudades subterráneas y santuarios excavados en roca. La UNESCO reconoce tanto su entorno como su legado cultural.",
      },
      {
        en: "Here, a building does not always begin by adding material. Sometimes a space is made by taking material away. What other familiar assumptions about cities could be reversed?",
        es: "Aquí, construir no siempre comienza por añadir material. A veces, un espacio nace al retirarlo. ¿Qué otras ideas sobre las ciudades podríamos invertir?",
      },
    ],
    ["an-island-of-its-own", "a-day-longer-than-a-year"],
    "https://whc.unesco.org/en/list/357/",
    1,
  ),
  d(
    "the-invisible-scaffolding",
    "unsolved",
    { en: "The invisible scaffolding", es: "La estructura invisible" },
    {
      en: "We can observe its gravity. Its identity remains unknown.",
      es: "Observamos su gravedad. Su identidad sigue sin conocerse.",
    },
    [
      {
        en: "Dark matter is the name given to matter inferred from gravitational effects that ordinary visible matter cannot fully explain. It does not emit, absorb or reflect light in the way ordinary matter does. Its fundamental nature remains an open scientific question.",
        es: "La materia oscura se infiere a partir de efectos gravitacionales que la materia visible no explica por completo. No emite, absorbe ni refleja luz como la materia ordinaria. Su naturaleza fundamental sigue siendo una pregunta científica abierta.",
      },
      {
        en: "Evidence for an effect and knowledge of its cause are different things. This destination has no final reveal: uncertainty is part of the discovery.",
        es: "La evidencia de un efecto y el conocimiento de su causa son cosas distintas. Este destino no tiene una respuesta final: la incertidumbre forma parte del descubrimiento.",
      },
    ],
    ["worlds-around-other-suns", "an-ocean-under-ice"],
    "https://science.nasa.gov/dark-matter/",
    0,
    "question",
  ),
  d(
    "an-ocean-under-ice",
    "unsolved",
    { en: "An ocean under ice", es: "Un océano bajo el hielo" },
    {
      en: "Enceladus asks a question through its frozen surface.",
      es: "Encélado plantea una pregunta desde su superficie helada.",
    },
    [
      {
        en: "Saturn’s moon Enceladus has a global ocean beneath its icy crust. Plumes release material from beneath the surface into space. NASA’s Cassini mission studied these plumes, providing clues to the ocean’s chemistry.",
        es: "Encélado, una luna de Saturno, tiene un océano global bajo su corteza de hielo. Sus penachos expulsan material al espacio. La misión Cassini de la NASA los estudió y obtuvo pistas sobre la química del océano.",
      },
      {
        en: "Conditions potentially relevant to life are not evidence of life itself. Whether anything lives there remains unknown. A frozen world can still hold a very liquid question.",
        es: "Las condiciones potencialmente favorables para la vida no demuestran que exista. Aún no sabemos si hay seres vivos allí. Un mundo helado puede guardar una pregunta muy líquida.",
      },
    ],
    ["the-animals-that-build-reefs", "the-invisible-scaffolding"],
    "https://science.nasa.gov/saturn/moons/enceladus/",
    1,
    "question",
  ),
  d(
    "the-animals-that-build-reefs",
    "natural",
    {
      en: "The animals that build reefs",
      es: "Los animales que construyen arrecifes",
    },
    {
      en: "What looks like a rock can be a living collaboration.",
      es: "Lo que parece una roca puede ser una colaboración viva.",
    },
    [
      {
        en: "Corals are animals. Many reef-building corals live in colonies of small polyps that produce hard calcium carbonate skeletons. Many also host microscopic algae, exchanging shelter and nutrients in a close biological partnership.",
        es: "Los corales son animales. Muchos corales constructores de arrecifes viven en colonias de pequeños pólipos que producen esqueletos de carbonato de calcio. Muchos albergan algas microscópicas e intercambian refugio y nutrientes en una estrecha relación biológica.",
      },
      {
        en: "A reef is architecture made through generations of life. Follow the connection to Socotra to see how geography can hold an extraordinary variety of living forms.",
        es: "Un arrecife es arquitectura creada por generaciones de seres vivos. Sigue la conexión con Socotra para descubrir cómo un lugar reúne una diversidad extraordinaria.",
      },
    ],
    ["an-island-of-its-own", "an-ocean-under-ice"],
    "https://oceanservice.noaa.gov/facts/coral.html",
    0,
  ),
  d(
    "light-written-in-the-sky",
    "natural",
    { en: "Light written in the sky", es: "Luz escrita en el cielo" },
    {
      en: "An aurora makes an invisible interaction visible.",
      es: "La aurora vuelve visible una interacción invisible.",
    },
    [
      {
        en: "Auroras occur when energetic particles interact with gases in a planet’s atmosphere. Earth’s magnetic environment guides these interactions toward polar regions. Different atmospheric gases and altitudes contribute different colors.",
        es: "Las auroras aparecen cuando partículas energéticas interactúan con gases de la atmósfera. El entorno magnético de la Tierra guía estas interacciones hacia las regiones polares. Los distintos gases y altitudes contribuyen a sus colores.",
      },
      {
        en: "The glow connects the Sun, a magnetic field and the air above us. A distant star can leave a visible signature in the night sky.",
        es: "El resplandor conecta al Sol, un campo magnético y el aire sobre nosotros. Una estrella distante puede dejar una firma visible en el cielo nocturno.",
      },
    ],
    ["a-day-longer-than-a-year", "the-invisible-scaffolding"],
    "https://science.nasa.gov/sun/auroras/",
    1,
  ),
];
export const getDiscovery = (id: string) =>
  discoveries.find((d) => d.slug === id);
