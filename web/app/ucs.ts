export type UcsCategory = {
  category: string;
  subcategory: string;
  catid: string;
  catShort: string;
  explanations: string;
  synonyms: string[];
};

export type MatchReason = {
  label: string;
  value: string;
};

export type UcsMatch = {
  entry: UcsCategory;
  score: number;
  reasons: MatchReason[];
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "sound",
  "sounds",
  "the",
  "this",
  "to",
  "with",
]);

type SearchDoc = {
  entry: UcsCategory;
  fields: {
    category: string[];
    subcategory: string[];
    catShort: string[];
    explanations: string[];
    synonyms: string[];
  };
  synonymPhrases: string[];
};

const FIELD_WEIGHTS = {
  category: 5.5,
  subcategory: 8,
  catShort: 4,
  explanations: 2.2,
  synonyms: 6.5,
} as const;

export function parseUcsCsv(csv: string): UcsCategory[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) return [];
  const column = Object.fromEntries(header.map((name, index) => [name, index]));

  return body
    .filter((cells) => cells[column.CatID]?.trim())
    .map((cells) => ({
      category: cells[column.Category]?.trim() ?? "",
      subcategory: cells[column.SubCategory]?.trim() ?? "",
      catid: cells[column.CatID]?.trim() ?? "",
      catShort: cells[column.CatShort]?.trim() ?? "",
      explanations: cells[column.Explanations]?.trim() ?? "",
      synonyms: (cells[column.Synonyms] ?? "")
        .split(",")
        .map((term) => term.trim())
        .filter(Boolean),
    }));
}

export function matchUcs(query: string, entries: UcsCategory[], limit = 5): UcsMatch[] {
  const cleanQuery = normalize(query);
  const queryTerms = uniqueTerms(query);
  if (!cleanQuery || queryTerms.length === 0) return [];

  const docs = entries.map(toSearchDoc);
  const documentFrequency = new Map<string, number>();
  for (const doc of docs) {
    const terms = new Set(Object.values(doc.fields).flat());
    for (const term of terms) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const matches = docs.map((doc) => {
    let score = 0;
    const matchedQueryTerms = new Set<string>();
    const reasonCandidates: Array<MatchReason & { weight: number }> = [];
    const exactCatId = normalize(doc.entry.catid) === cleanQuery;

    if (exactCatId) {
      score += 500;
      reasonCandidates.push({ label: "Exact CatID", value: doc.entry.catid, weight: 500 });
    }

    for (const [fieldName, fieldTerms] of Object.entries(doc.fields) as Array<
      [keyof SearchDoc["fields"], string[]]
    >) {
      for (const queryTerm of queryTerms) {
        const direct = fieldTerms.includes(queryTerm);
        const near = !direct && fieldTerms.some((term) => isNearTerm(queryTerm, term));
        if (!direct && !near) continue;

        const idf =
          Math.log((docs.length + 1) / ((documentFrequency.get(queryTerm) ?? 0) + 1)) + 1;
        const fieldWeight = FIELD_WEIGHTS[fieldName] * (direct ? 1 : 0.38);
        score += fieldWeight * idf;
        matchedQueryTerms.add(queryTerm);

        const reason = reasonFor(fieldName, queryTerm, doc.entry);
        if (reason) {
          reasonCandidates.push({ ...reason, weight: fieldWeight * idf });
        }
      }
    }

    const subcategoryPhrase = normalize(doc.entry.subcategory);
    const categoryPhrase = normalize(doc.entry.category);
    if (
      subcategoryPhrase &&
      (containsPhrase(cleanQuery, subcategoryPhrase) ||
        fieldTermsAppearInQuery(doc.entry.subcategory, queryTerms))
    ) {
      score += 34;
      reasonCandidates.push({
        label: "Subcategory",
        value: doc.entry.subcategory,
        weight: 34,
      });
    }
    if (
      categoryPhrase &&
      (containsPhrase(cleanQuery, categoryPhrase) ||
        fieldTermsAppearInQuery(doc.entry.category, queryTerms))
    ) {
      score += 22;
      reasonCandidates.push({
        label: "Category",
        value: doc.entry.category,
        weight: 22,
      });
    }

    for (const synonymPhrase of doc.synonymPhrases) {
      if (synonymPhrase.length > 2 && containsPhrase(cleanQuery, synonymPhrase)) {
        const phraseWeight = 20 + synonymPhrase.split(" ").length * 3;
        score += phraseWeight;
        reasonCandidates.push({
          label: "Related term",
          value: displaySynonym(synonymPhrase, doc.entry.synonyms),
          weight: phraseWeight,
        });
      }
    }

    const coverage = matchedQueryTerms.size / queryTerms.length;
    score *= 0.68 + coverage * 0.32;
    if (doc.entry.subcategory === "MISC") score *= 0.88;

    const reasons = dedupeReasons(reasonCandidates)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 4)
      .map(({ label, value }) => ({ label, value }));

    return { entry: doc.entry, score, reasons };
  });

  return matches
    .filter((match) => match.score > 1)
    .sort(
      (left, right) =>
        right.score - left.score || left.entry.catid.localeCompare(right.entry.catid),
    )
    .slice(0, limit);
}

function toSearchDoc(entry: UcsCategory): SearchDoc {
  return {
    entry,
    fields: {
      category: uniqueTerms(entry.category),
      subcategory: uniqueTerms(entry.subcategory),
      catShort: uniqueTerms(entry.catShort),
      explanations: uniqueTerms(entry.explanations),
      synonyms: uniqueTerms(entry.synonyms.join(" ")),
    },
    synonymPhrases: entry.synonyms.map(normalize).filter(Boolean),
  };
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueTerms(value: string): string[] {
  const terms = normalize(value)
    .split(" ")
    .map(stem)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
  return [...new Set(terms)];
}

function stem(term: string): string {
  const irregular: Record<string, string> = {
    wooden: "wood",
    metallic: "metal",
    machinery: "machine",
  };
  if (irregular[term]) return irregular[term];
  if (term.length > 5 && term.endsWith("ies")) return `${term.slice(0, -3)}y`;
  if (term.length > 5 && term.endsWith("ing")) return term.slice(0, -3);
  if (term.length > 4 && term.endsWith("ed")) return term.slice(0, -2);
  if (term.length > 4 && term.endsWith("es")) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith("s")) return term.slice(0, -1);
  return term;
}

function isNearTerm(queryTerm: string, fieldTerm: string): boolean {
  if (queryTerm.length < 4 || fieldTerm.length < 4) return false;
  if (queryTerm.startsWith(fieldTerm) || fieldTerm.startsWith(queryTerm)) return true;
  return queryTerm.length >= 5 && fieldTerm.length >= 5 && editDistanceAtMostOne(queryTerm, fieldTerm);
}

function editDistanceAtMostOne(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return true;
}

function containsPhrase(query: string, phrase: string): boolean {
  return ` ${query} `.includes(` ${phrase} `);
}

function fieldTermsAppearInQuery(field: string, queryTerms: string[]): boolean {
  const terms = uniqueTerms(field);
  return terms.length > 0 && terms.every((term) => queryTerms.includes(term));
}

function reasonFor(
  field: keyof SearchDoc["fields"],
  term: string,
  entry: UcsCategory,
): MatchReason | null {
  if (field === "subcategory") return { label: "Subcategory", value: entry.subcategory };
  if (field === "category") return { label: "Category", value: entry.category };
  if (field === "synonyms") {
    const synonym = entry.synonyms.find((candidate) =>
      uniqueTerms(candidate).some((candidateTerm) => isNearTerm(term, candidateTerm)),
    );
    return synonym ? { label: "Related term", value: synonym } : null;
  }
  if (field === "explanations") return { label: "Description match", value: term };
  return null;
}

function displaySynonym(normalized: string, synonyms: string[]): string {
  return synonyms.find((term) => normalize(term) === normalized) ?? normalized;
}

function dedupeReasons(
  reasons: Array<MatchReason & { weight: number }>,
): Array<MatchReason & { weight: number }> {
  const seen = new Set<string>();
  return reasons.filter((reason) => {
    const key = `${reason.label}:${reason.value.toLocaleLowerCase("en-US")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
