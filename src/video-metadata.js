const CHANNEL_FOOTER =
  "Follow iShow Arasiyal for Tamil Nadu politics and current affairs.\n#Shorts #TamilPolitics";
const DEFAULT_TAGS = ["Shorts", "Tamil politics", "Tamil Nadu politics", "iShow Arasiyal"];
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS_LENGTH = 500;

function buildVideoMetadata(source = {}) {
  const sourceTitle = typeof source.title === "string" ? source.title.trim() : "";
  const titleBase = (sourceTitle || "Tamil Nadu Politics Update")
    .replace(/\s*#shorts\b/gi, "")
    .trim();
  const titleSuffix = " #Shorts";
  const title = `${titleBase.slice(0, MAX_TITLE_LENGTH - titleSuffix.length).trimEnd()}${titleSuffix}`;

  const sourceDescription =
    typeof source.description === "string" ? source.description.trim() : "";
  const descriptionLimit = MAX_DESCRIPTION_LENGTH - CHANNEL_FOOTER.length - 2;
  const description = [
    sourceDescription.slice(0, descriptionLimit),
    CHANNEL_FOOTER,
  ]
    .filter(Boolean)
    .join("\n\n");

  const inputTags = Array.isArray(source.tags) ? source.tags : [];
  const tags = [];
  let tagLength = 0;
  for (const candidate of [...inputTags, ...DEFAULT_TAGS]) {
    if (typeof candidate !== "string") {
      continue;
    }
    const tag = candidate.trim();
    if (!tag || tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      continue;
    }
    const nextLength = tagLength + tag.length + (tags.length ? 1 : 0);
    if (nextLength > MAX_TAGS_LENGTH) {
      continue;
    }
    tags.push(tag);
    tagLength = nextLength;
  }

  return {
    snippet: {
      title,
      description,
      tags,
      categoryId: "25",
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };
}

module.exports = { buildVideoMetadata };