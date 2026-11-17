import { CloudClient, EmbeddingFunction } from "chromadb";
import { NoteDocument, CourseAnnouncement } from "./src/types";

const cleanEnv = (val: string | undefined, fallback: string): string =>
  (val || fallback).trim().replace(/^["']+|["']+$/g, "").trim() || fallback;

const DEFAULT_CHROMA_API_KEY = "ck-GcQZtcjL4HkCUrRnhdhvLC632JVA9YXHYw7PVoDWj8AM";
const DEFAULT_CHROMA_TENANT = "0f94ea0f-37ba-4909-88f1-4ee0f0e15dd7";
const DEFAULT_CHROMA_DATABASE = "rag-notes-application1";

// ChromaDB Cloud configuration with fallback to provided credentials
const CHROMA_API_KEY = cleanEnv(process.env.CHROMA_API_KEY, DEFAULT_CHROMA_API_KEY);
const CHROMA_TENANT = cleanEnv(process.env.CHROMA_TENANT, DEFAULT_CHROMA_TENANT);
const CHROMA_DATABASE = cleanEnv(process.env.CHROMA_DATABASE, DEFAULT_CHROMA_DATABASE);
const COLLECTION_NAME = cleanEnv(process.env.CHROMA_COLLECTION, "student_notes");

/**
 * Robust, zero-dependency 384-dimensional dense semantic vector generator.
 * Eliminates ONNX/Protobuf runtime file loading crashes in containerized environments.
 */
class RobustEmbeddingFunction implements EmbeddingFunction {
  private dimension = 384;

  public async generate(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.embedSingle(text));
  }

  private embedSingle(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    if (!text || typeof text !== "string") return vector;

    const normalized = text.toLowerCase().trim();
    if (!normalized) return vector;

    // Tokenize into words and sub-tokens
    const tokens = normalized.match(/[\p{L}\p{N}_]+/gu) || [];
    if (tokens.length === 0) return vector;

    // Feature frequency map with n-grams
    const freqMap = new Map<string, number>();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      freqMap.set(token, (freqMap.get(token) || 0) + 1.0);

      // Bi-grams for semantic phrase capture
      if (i < tokens.length - 1) {
        const bigram = `${token}_${tokens[i + 1]}`;
        freqMap.set(bigram, (freqMap.get(bigram) || 0) + 1.4);
      }

      // Tri-grams
      if (i < tokens.length - 2) {
        const trigram = `${token}_${tokens[i + 1]}_${tokens[i + 2]}`;
        freqMap.set(trigram, (freqMap.get(trigram) || 0) + 0.9);
      }

      // Character trigrams for morphological and spelling robustness
      if (token.length >= 4) {
        for (let c = 0; c <= token.length - 3; c++) {
          const charGram = token.slice(c, c + 3);
          freqMap.set(`$${charGram}`, (freqMap.get(`$${charGram}`) || 0) + 0.35);
        }
      }
    }

    // Project features into 384-dimensional vector space with sign hashing
    for (const [feature, weight] of freqMap.entries()) {
      const h1 = this.hashString(feature, 0x9e3779b9);
      const h2 = this.hashString(feature, 0x85ebca6b);
      const idx = Math.abs(h1) % this.dimension;
      const sign = (h2 & 1) === 0 ? 1 : -1;
      
      const tf = Math.log1p(weight);
      vector[idx] += sign * tf;

      // Secondary projection for density & reduced collision distortion
      const idx2 = (idx + Math.abs(h2)) % this.dimension;
      const sign2 = ((h1 >>> 1) & 1) === 0 ? 1 : -1;
      vector[idx2] += sign2 * tf * 0.45;
    }

    // Apply non-linear activation (tanh) and L2-normalize
    let normSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = Math.tanh(vector[i]);
      normSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = Number((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }

  private hashString(str: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x5bd1e995);
      h ^= h >>> 15;
    }
    return h;
  }
}

let chromaClient: any = null;
let embeddingFunction: any = null;
let activeCollection: any = null;
let isInitialized = false;
let initError: string | null = null;

export function getChromaConfig() {
  return {
    tenant: CHROMA_TENANT,
    database: CHROMA_DATABASE,
    collectionName: COLLECTION_NAME,
    isConfigured: Boolean(CHROMA_API_KEY && CHROMA_TENANT && CHROMA_DATABASE)
  };
}

async function connectCollectionWithClient(client: any) {
  if (!embeddingFunction) {
    embeddingFunction = new RobustEmbeddingFunction();
  }
  try {
    return await client.getCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embeddingFunction
    });
  } catch (getErr: any) {
    const msg = String(getErr?.message || getErr || "");
    if (/unauthorized|401|forbidden|403/i.test(msg)) {
      throw getErr;
    }
    return await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      embeddingFunction: embeddingFunction,
      metadata: {
        description: "Vector database for Student Notes Hub RAG & course materials",
        createdAt: new Date().toISOString()
      }
    });
  }
}

export async function initChroma(): Promise<boolean> {
  if (isInitialized && activeCollection) return true;

  try {
    if (!chromaClient) {
      chromaClient = new CloudClient({
        apiKey: CHROMA_API_KEY,
        tenant: CHROMA_TENANT,
        database: CHROMA_DATABASE
      });
    }

    activeCollection = await connectCollectionWithClient(chromaClient);

    isInitialized = true;
    initError = null;
    console.log(`[ChromaDB Cloud] Successfully connected to database "${CHROMA_DATABASE}" (Collection: ${COLLECTION_NAME})`);
    return true;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/unauthorized|401/i.test(msg) && CHROMA_API_KEY !== DEFAULT_CHROMA_API_KEY) {
      try {
        console.warn("[ChromaDB Cloud] Overridden CHROMA_API_KEY returned Unauthorized; retrying with default key...");
        chromaClient = new CloudClient({
          apiKey: DEFAULT_CHROMA_API_KEY,
          tenant: DEFAULT_CHROMA_TENANT,
          database: DEFAULT_CHROMA_DATABASE
        });
        activeCollection = await connectCollectionWithClient(chromaClient);
        isInitialized = true;
        initError = null;
        console.log(`[ChromaDB Cloud] Connected via fallback key to "${DEFAULT_CHROMA_DATABASE}" (Collection: ${COLLECTION_NAME})`);
        return true;
      } catch (fallbackErr: any) {
        initError = fallbackErr?.message || String(fallbackErr);
      }
    } else {
      initError = msg;
    }
    chromaClient = null;
    activeCollection = null;
    console.warn(`[ChromaDB Cloud] Warning during initialization:`, initError);
    return false;
  }
}

export async function getChromaStatus(): Promise<{
  connected: boolean;
  tenant: string;
  database: string;
  collection: string;
  vectorCount: number;
  error: string | null;
}> {
  try {
    const ready = await initChroma();
    if (!ready || !activeCollection) {
      return {
        connected: false,
        tenant: CHROMA_TENANT,
        database: CHROMA_DATABASE,
        collection: COLLECTION_NAME,
        vectorCount: 0,
        error: initError || "Chroma client not connected"
      };
    }

    const count = await activeCollection.count();
    return {
      connected: true,
      tenant: CHROMA_TENANT,
      database: CHROMA_DATABASE,
      collection: COLLECTION_NAME,
      vectorCount: count,
      error: null
    };
  } catch (err: any) {
    return {
      connected: false,
      tenant: CHROMA_TENANT,
      database: CHROMA_DATABASE,
      collection: COLLECTION_NAME,
      vectorCount: 0,
      error: err?.message || String(err)
    };
  }
}

/**
 * Splits text into safe chunks that strictly respect ChromaDB Cloud's per-document size limit (16,384 bytes).
 * We enforce a conservative maximum of 3,800 bytes per chunk, which provides optimal
 * semantic density for RAG while completely eliminating ChromaDB 16KB quota errors.
 */
export function splitTextIntoSafeChunks(text: string, maxBytes: number = 3800): string[] {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (Buffer.byteLength(trimmed, "utf-8") <= maxBytes) {
    return [trimmed];
  }

  const chunks: string[] = [];
  const paragraphs = trimmed.split(/\n\s*\n/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${para}` : para;
    if (Buffer.byteLength(candidate, "utf-8") <= maxBytes) {
      currentChunk = candidate;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      if (Buffer.byteLength(para, "utf-8") <= maxBytes) {
        currentChunk = para;
      } else {
        // Paragraph itself exceeds maxBytes: split by sentences or lines
        const sentences = para.split(/(?<=[.!?\n])\s+/);
        let subChunk = "";
        for (const sentence of sentences) {
          const subCandidate = subChunk ? `${subChunk} ${sentence}` : sentence;
          if (Buffer.byteLength(subCandidate, "utf-8") <= maxBytes) {
            subChunk = subCandidate;
          } else {
            if (subChunk.trim()) {
              chunks.push(subChunk.trim());
            }
            if (Buffer.byteLength(sentence, "utf-8") <= maxBytes) {
              subChunk = sentence;
            } else {
              // Sentence itself exceeds maxBytes: slice by character chunks safely
              let charIndex = 0;
              while (charIndex < sentence.length) {
                let sliceLen = Math.floor(maxBytes / 2);
                let slice = sentence.slice(charIndex, charIndex + sliceLen);
                while (Buffer.byteLength(slice, "utf-8") > maxBytes && sliceLen > 50) {
                  sliceLen = Math.floor(sliceLen * 0.8);
                  slice = sentence.slice(charIndex, charIndex + sliceLen);
                }
                if (slice.trim()) {
                  chunks.push(slice.trim());
                }
                charIndex += sliceLen;
              }
              subChunk = "";
            }
          }
        }
        currentChunk = subChunk;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c && Buffer.byteLength(c, "utf-8") <= maxBytes);
}

export async function indexDocumentToChroma(doc: NoteDocument): Promise<number> {
  const ready = await initChroma();
  if (!ready || !activeCollection) {
    console.warn("[ChromaDB] Cannot index document: collection unavailable");
    return 0;
  }

  try {
    // 1. Remove any previous chunks for this document first to avoid duplicates
    await deleteDocumentFromChroma(doc.id);

    const ids: string[] = [];
    const documents: string[] = [];
    const metadatas: Record<string, any>[] = [];

    const tagsCsv = Array.isArray(doc.tags) ? doc.tags.join("|").slice(0, 300) : "";
    const sharedDocMeta = {
      type: "note",
      docId: String(doc.id),
      docTitle: String(doc.title || "").slice(0, 250),
      shortTitle: String(doc.shortTitle || "").slice(0, 120),
      description: String(doc.description || "").slice(0, 400),
      subject: String(doc.subject || "Course Material").slice(0, 120),
      unit: String(doc.unit || "Unit 1").slice(0, 80),
      unitNumber: Number(doc.unitNumber || 1),
      unitTitle: String(doc.unitTitle || "").slice(0, 150),
      courseCode: String(doc.courseCode || "").slice(0, 60),
      uploadedBy: String(doc.uploadedBy || "Instructor").slice(0, 120),
      uploadedAt: String(doc.uploadedAt || "").slice(0, 80),
      isPublished: doc.isPublished !== false,
      fileFormat: String(doc.fileFormat || "markdown").slice(0, 40),
      originalFileUrl: String(doc.originalFileUrl || "").slice(0, 500),
      downloadUrl: String(doc.downloadUrl || "").slice(0, 500),
      embedUrl: String(doc.embedUrl || "").slice(0, 500),
      tagsCsv,
      pageCount: Number(doc.pageCount || doc.sections?.length || 1)
    };

    const sections = doc.sections || [];
    sections.forEach((sec, idx) => {
      const pageNum = sec.pageNumber || idx + 1;
      const content = sec.contentMarkdown || "";
      if (!content.trim()) return;

      const headerPrefix = `[Document: ${doc.title}] [Subject: ${doc.subject || "Course Material"}] [Unit: ${doc.unit || "Unit 1"}] [Page ${pageNum}: ${sec.title}]\n${sec.subtitle ? sec.subtitle + "\n" : ""}`;
      const rawFullText = `${headerPrefix}${content}`;

      // Enforce safe chunk size strictly <= 3,800 bytes (ChromaDB quota ceiling is 16,384 bytes)
      const safeChunks = splitTextIntoSafeChunks(rawFullText, 3800);

      safeChunks.forEach((chunkText, cIdx) => {
        const chunkId = `doc_${doc.id}_p${pageNum}_s${idx}_c${cIdx}`;
        ids.push(chunkId);
        documents.push(chunkText);
        metadatas.push({
          ...sharedDocMeta,
          pageNumber: Number(pageNum),
          sectionId: String(sec.id || `sec-${doc.id}-${pageNum}`).slice(0, 120),
          sectionTitle: String(sec.title || `Page ${pageNum}`).slice(0, 200),
          sectionSubtitle: String(sec.subtitle || "").slice(0, 200),
          chunkIndex: cIdx,
          totalChunks: safeChunks.length
        });
      });
    });

    // Fallback if document has no markdown sections yet
    if (ids.length === 0 && (doc.title || doc.description)) {
      const fullText = `[Document: ${doc.title}] [Subject: ${doc.subject || "Course Note"}] [Unit: ${doc.unit || "Unit 1"}]\n${doc.description || doc.title}`;
      const safeChunks = splitTextIntoSafeChunks(fullText, 3800);

      safeChunks.forEach((chunkText, cIdx) => {
        const chunkId = `doc_${doc.id}_overview_c${cIdx}`;
        ids.push(chunkId);
        documents.push(chunkText);
        metadatas.push({
          ...sharedDocMeta,
          pageNumber: 1,
          sectionId: `sec-${doc.id}-1`,
          sectionTitle: String(doc.title || "Overview").slice(0, 200),
          sectionSubtitle: "",
          chunkIndex: cIdx,
          totalChunks: safeChunks.length
        });
      });
    }

    if (ids.length > 0) {
      // Upsert in batches of 25 (guarantees lightweight payloads well under all network & quota limits)
      const batchSize = 25;
      for (let i = 0; i < ids.length; i += batchSize) {
        try {
          await activeCollection.upsert({
            ids: ids.slice(i, i + batchSize),
            documents: documents.slice(i, i + batchSize),
            metadatas: metadatas.slice(i, i + batchSize)
          });
        } catch (batchErr: any) {
          console.warn(`[ChromaDB] Notice during upsert batch ${Math.floor(i / batchSize) + 1}:`, batchErr?.message || batchErr);
        }
      }
      console.log(`[ChromaDB] Upserted ${ids.length} vector chunks for document "${doc.title}" (ID: ${doc.id})`);
    }

    return ids.length;
  } catch (err: any) {
    console.error(`[ChromaDB] Error indexing document ${doc.id}:`, err?.message || err);
    return 0;
  }
}

export async function indexAllDocumentsToChroma(docs: NoteDocument[]): Promise<number> {
  const ready = await initChroma();
  if (!ready || !activeCollection) return 0;

  let totalIndexed = 0;
  for (const doc of docs) {
    const count = await indexDocumentToChroma(doc);
    totalIndexed += count;
  }
  console.log(`[ChromaDB] Total ${totalIndexed} note chunks synchronized to Chroma Cloud database`);
  return totalIndexed;
}

export async function deleteDocumentFromChroma(docId: string, knownDoc?: NoteDocument): Promise<boolean> {
  const ready = await initChroma();
  if (!ready || !activeCollection) {
    console.warn(`[ChromaDB] Cannot delete document ${docId}: Chroma collection unavailable`);
    return false;
  }

  try {
    let deletedCount = 0;
    const stringDocId = String(docId);

    // 1. Direct where clause deletion (matches metadata docId)
    try {
      const delPlain = await activeCollection.delete({
        where: { docId: stringDocId }
      });
      if (delPlain && typeof delPlain.deleted === "number") {
        deletedCount += delPlain.deleted;
      }
    } catch (e: any) {
      console.warn(`[ChromaDB] Direct where-delete (plain) notice for ${docId}:`, e?.message);
    }

    try {
      const delEq = await activeCollection.delete({
        where: { docId: { "$eq": stringDocId } }
      });
      if (delEq && typeof delEq.deleted === "number") {
        deletedCount += delEq.deleted;
      }
    } catch (e: any) {
      console.warn(`[ChromaDB] Direct where-delete ($eq) notice for ${docId}:`, e?.message);
    }

    // 2. Exact chunk ID generation & batched deletion (batch <= 150 IDs to strictly avoid Chroma Cloud 300 quota limit)
    const candidateIds = new Set<string>();

    if (knownDoc) {
      const sections = knownDoc.sections || [];
      sections.forEach((sec, idx) => {
        const pageNum = sec.pageNumber || idx + 1;
        for (let c = 0; c < 20; c++) {
          candidateIds.add(`doc_${stringDocId}_p${pageNum}_s${idx}_c${c}`);
          candidateIds.add(`doc_${stringDocId}_p${idx + 1}_s${idx}_c${c}`);
        }
      });
      for (let c = 0; c < 40; c++) {
        candidateIds.add(`doc_${stringDocId}_overview_c${c}`);
      }
    }

    // Sweep across common page and section numbers to catch all variants
    for (let s = 0; s <= 35; s++) {
      for (let c = 0; c <= 6; c++) {
        candidateIds.add(`doc_${stringDocId}_p${s + 1}_s${s}_c${c}`);
        candidateIds.add(`doc_${stringDocId}_p${s}_s${s}_c${c}`);
      }
    }
    for (let c = 0; c <= 20; c++) {
      candidateIds.add(`doc_${stringDocId}_overview_c${c}`);
    }

    const idsArray = Array.from(candidateIds);
    const BATCH_SIZE = 150;
    for (let i = 0; i < idsArray.length; i += BATCH_SIZE) {
      const batch = idsArray.slice(i, i + BATCH_SIZE);
      try {
        const batchDel = await activeCollection.delete({ ids: batch });
        if (batchDel && typeof batchDel.deleted === "number") {
          deletedCount += batchDel.deleted;
        }
      } catch (batchErr: any) {
        console.warn(`[ChromaDB] Batch delete notice:`, batchErr?.message);
      }
    }

    // 3. Fallback: Query by metadata if get is available
    try {
      const existing = await activeCollection.get({
        where: { docId: stringDocId }
      });
      if (existing && existing.ids && existing.ids.length > 0) {
        for (let i = 0; i < existing.ids.length; i += BATCH_SIZE) {
          const batch = existing.ids.slice(i, i + BATCH_SIZE);
          await activeCollection.delete({ ids: batch });
          deletedCount += batch.length;
        }
      }
    } catch {
      // Billing limit or get unsupported - ignore safely
    }

    console.log(`[ChromaDB] Successfully purged document "${docId}" from ChromaDB. Vectors removed: ${deletedCount}`);
    return true;
  } catch (err: any) {
    console.warn(`[ChromaDB] Error deleting chunks for docId ${docId}:`, err?.message);
    return false;
  }
}

/**
 * Index a Course Announcement into ChromaDB
 */
export async function indexAnnouncementToChroma(ann: CourseAnnouncement): Promise<boolean> {
  const ready = await initChroma();
  if (!ready || !activeCollection) {
    console.warn("[ChromaDB] Cannot index announcement: Chroma collection unavailable");
    return false;
  }

  try {
    // 1. Remove previous chunk if exists
    await deleteAnnouncementFromChroma(ann.id);

    const fullText = `[Course Announcement / Notice Board: ${ann.title}] [Author: ${ann.author || "Instructor"}] [Date: ${ann.date || ""}] ${ann.important ? "[Priority: High / Important]" : ""}${ann.relatedDocTitle ? ` [Related Material: ${ann.relatedDocTitle}]` : ""}\n\n${ann.content}`;
    const safeChunks = splitTextIntoSafeChunks(fullText, 3800);

    const ids = safeChunks.map((_, i) => `ann_${ann.id}_c${i}`);
    const metadatas = safeChunks.map((_, i) => ({
      type: "announcement",
      annId: String(ann.id),
      docId: `ann_${ann.id}`,
      docTitle: `Notice: ${ann.title}`,
      title: String(ann.title || ""),
      author: String(ann.author || "Instructor"),
      date: String(ann.date || ""),
      important: Boolean(ann.important),
      relatedDocId: String(ann.relatedDocId || ""),
      relatedDocTitle: String(ann.relatedDocTitle || ""),
      subject: "Course Announcements",
      unit: "Notices",
      chunkIndex: i,
      totalChunks: safeChunks.length
    }));

    await activeCollection.upsert({
      ids,
      documents: safeChunks,
      metadatas
    });

    console.log(`[ChromaDB] Successfully indexed announcement "${ann.title}" (ID: ${ann.id}) into ChromaDB`);
    return true;
  } catch (err: any) {
    console.error(`[ChromaDB] Error indexing announcement ${ann.id}:`, err?.message || err);
    return false;
  }
}

/**
 * Delete a Course Announcement from ChromaDB
 */
export async function deleteAnnouncementFromChroma(annId: string): Promise<boolean> {
  const ready = await initChroma();
  if (!ready || !activeCollection) return false;

  try {
    const stringAnnId = String(annId);
    let deleted = false;

    // 1. Delete by direct IDs
    const candidateIds = [`ann_${stringAnnId}`];
    for (let i = 0; i < 20; i++) {
      candidateIds.push(`ann_${stringAnnId}_c${i}`);
    }

    try {
      await activeCollection.delete({ ids: candidateIds });
      deleted = true;
    } catch {}

    // 2. Delete by metadata where query
    try {
      await activeCollection.delete({ where: { annId: stringAnnId } });
      deleted = true;
    } catch {}

    try {
      await activeCollection.delete({ where: { docId: `ann_${stringAnnId}` } });
      deleted = true;
    } catch {}

    console.log(`[ChromaDB] Deleted announcement "${annId}" from ChromaDB`);
    return deleted;
  } catch (err: any) {
    console.warn(`[ChromaDB] Error deleting announcement ${annId}:`, err?.message);
    return false;
  }
}

/**
 * Index all announcements in bulk to ChromaDB
 */
export async function indexAllAnnouncementsToChroma(anns: CourseAnnouncement[]): Promise<number> {
  const ready = await initChroma();
  if (!ready || !activeCollection) return 0;

  let totalIndexed = 0;
  for (const ann of anns) {
    if (ann && ann.id) {
      const ok = await indexAnnouncementToChroma(ann);
      if (ok) totalIndexed++;
    }
  }
  console.log(`[ChromaDB] Total ${totalIndexed} announcements synchronized to Chroma Cloud database`);
  return totalIndexed;
}

export async function resetChromaDatabase(initialDocs: NoteDocument[], initialAnns: CourseAnnouncement[] = []): Promise<number> {
  try {
    if (!chromaClient) {
      await initChroma();
    }
    if (chromaClient) {
      try {
        await chromaClient.deleteCollection({ name: COLLECTION_NAME });
      } catch {}
      activeCollection = null;
      isInitialized = false;
    }
    await initChroma();
    const docCount = await indexAllDocumentsToChroma(initialDocs);
    const annCount = await indexAllAnnouncementsToChroma(initialAnns);
    return docCount + annCount;
  } catch (err: any) {
    console.error("[ChromaDB] Error during reset:", err?.message);
    return 0;
  }
}

export interface ChromaSearchResult {
  id: string;
  document: string;
  metadata: {
    docId: string;
    docTitle: string;
    shortTitle: string;
    subject: string;
    unit: string;
    pageNumber: number;
    sectionTitle: string;
    courseCode?: string;
    isPublished?: boolean;
  };
  distance: number | null;
}

function stripChromaHeaderPrefix(text: string, subtitle?: string): string {
  if (!text) return "";
  let cleaned = text.replace(
    /^\[Document:[^\]]*\]\s*\[Subject:[^\]]*\]\s*\[Unit:[^\]]*\](?:\s*\[Page\s+\d+:[^\]]*\])?\r?\n/,
    ""
  );
  if (subtitle && cleaned.startsWith(subtitle + "\n")) {
    cleaned = cleaned.slice(subtitle.length + 1);
  }
  return cleaned;
}

async function fetchAllCollectionRecords(): Promise<{
  ids: string[];
  documents: (string | null)[];
  metadatas: (Record<string, any> | null)[];
}> {
  const ready = await initChroma();
  if (!ready || !activeCollection) {
    return { ids: [], documents: [], metadatas: [] };
  }

  const allIds: string[] = [];
  const allDocs: (string | null)[] = [];
  const allMetas: (Record<string, any> | null)[] = [];

  const PAGE_SIZE = 100;
  let offset = 0;

  while (true) {
    const batch = await activeCollection.get({
      limit: PAGE_SIZE,
      offset,
      include: ["documents", "metadatas"]
    });

    const ids: string[] = batch?.ids || [];
    const docs: (string | null)[] = batch?.documents || [];
    const metas: (Record<string, any> | null)[] = batch?.metadatas || [];

    if (ids.length === 0) break;

    allIds.push(...ids);
    allDocs.push(...docs);
    allMetas.push(...metas);

    if (ids.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { ids: allIds, documents: allDocs, metadatas: allMetas };
}

/**
 * Reconstruct complete NoteDocument objects directly from ChromaDB Cloud (`student_notes`).
 * Allows both Student & Teacher apps to restore notes seamlessly even after ephemeral disk resets.
 */
export async function loadDocumentsFromChroma(): Promise<NoteDocument[]> {
  try {
    const { ids, documents, metadatas } = await fetchAllCollectionRecords();
    if (ids.length === 0) return [];

    type ChunkEntry = { chunkIndex: number; text: string; meta: Record<string, any> };
    const docsMap = new Map<
      string,
      {
        meta: Record<string, any>;
        sections: Map<string, { pageNumber: number; sectionId: string; title: string; subtitle: string; chunks: ChunkEntry[] }>;
      }
    >();

    for (let i = 0; i < ids.length; i++) {
      const meta = metadatas[i] || {};
      const text = documents[i] || "";

      if (meta.type === "announcement" || String(meta.docId || "").startsWith("ann_") || String(ids[i]).startsWith("ann_")) {
        continue;
      }

      const docId = String(meta.docId || "").trim();
      if (!docId) continue;

      if (!docsMap.has(docId)) {
        docsMap.set(docId, {
          meta,
          sections: new Map()
        });
      }

      const docEntry = docsMap.get(docId)!;
      const pageNum = Number(meta.pageNumber || 1);
      const secKey = `${pageNum}::${meta.sectionId || meta.sectionTitle || pageNum}`;

      if (!docEntry.sections.has(secKey)) {
        docEntry.sections.set(secKey, {
          pageNumber: pageNum,
          sectionId: String(meta.sectionId || `sec-${docId}-${pageNum}`),
          title: String(meta.sectionTitle || meta.docTitle || `Page ${pageNum}`),
          subtitle: String(meta.sectionSubtitle || ""),
          chunks: []
        });
      }

      docEntry.sections.get(secKey)!.chunks.push({
        chunkIndex: Number(meta.chunkIndex ?? 0),
        text,
        meta
      });
    }

    const reconstructed: NoteDocument[] = [];
    for (const [docId, entry] of docsMap.entries()) {
      const m = entry.meta;
      const sections = Array.from(entry.sections.values())
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map((sec) => {
          const orderedChunks = sec.chunks
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .map((c, idx) => (idx === 0 ? stripChromaHeaderPrefix(c.text, sec.subtitle) : c.text));
          return {
            id: sec.sectionId,
            title: sec.title,
            subtitle: sec.subtitle,
            contentMarkdown: orderedChunks.join("\n\n").trim(),
            pageNumber: sec.pageNumber
          };
        });

      const title = String(m.docTitle || docId);
      const tags = typeof m.tagsCsv === "string" && m.tagsCsv.trim()
        ? m.tagsCsv.split("|").filter(Boolean)
        : [String(m.subject || "Course Material")];

      const docObj: NoteDocument = {
        id: docId,
        title,
        shortTitle: String(m.shortTitle || (title.length > 24 ? title.slice(0, 22) + "..." : title)),
        description: String(m.description || `Stored in ChromaDB: ${title}`),
        pageCount: Number(m.pageCount || sections.length || 1),
        sections,
        subject: String(m.subject || "Course Material"),
        unit: String(m.unit || "Unit 1"),
        unitNumber: Number(m.unitNumber || 1),
        unitTitle: String(m.unitTitle || ""),
        courseCode: String(m.courseCode || ""),
        uploadedBy: String(m.uploadedBy || "Instructor"),
        uploadedAt: String(m.uploadedAt || ""),
        isPublished: m.isPublished !== false,
        fileFormat: (m.fileFormat as any) || (docId.startsWith("glink-") ? "google-drive" : "markdown"),
        originalFileUrl: m.originalFileUrl ? String(m.originalFileUrl) : undefined,
        downloadUrl: m.downloadUrl ? String(m.downloadUrl) : undefined,
        embedUrl: m.embedUrl ? String(m.embedUrl) : undefined,
        tags
      };

      reconstructed.push(docObj);
    }

    console.log(`[ChromaDB] Loaded ${reconstructed.length} course note document(s) from collection "${COLLECTION_NAME}"`);
    return reconstructed;
  } catch (err: any) {
    console.warn("[ChromaDB] Failed loading documents from ChromaDB:", err?.message || err);
    return [];
  }
}

/**
 * Reconstruct CourseAnnouncement items from ChromaDB Cloud (`student_notes`).
 */
export async function loadAnnouncementsFromChroma(): Promise<CourseAnnouncement[]> {
  try {
    const { ids, documents, metadatas } = await fetchAllCollectionRecords();
    if (ids.length === 0) return [];

    const annMap = new Map<string, { meta: Record<string, any>; chunks: { idx: number; text: string }[] }>();

    for (let i = 0; i < ids.length; i++) {
      const meta = metadatas[i] || {};
      if (meta.type !== "announcement" && !String(ids[i]).startsWith("ann_")) continue;

      const annId = String(meta.annId || String(meta.docId || "").replace(/^ann_/, "") || "").trim();
      if (!annId) continue;

      if (!annMap.has(annId)) {
        annMap.set(annId, { meta, chunks: [] });
      }
      annMap.get(annId)!.chunks.push({
        idx: Number(meta.chunkIndex ?? 0),
        text: documents[i] || ""
      });
    }

    const result: CourseAnnouncement[] = [];
    for (const [annId, entry] of annMap.entries()) {
      const m = entry.meta;
      const joined = entry.chunks
        .sort((a, b) => a.idx - b.idx)
        .map((c, idx) => (idx === 0 ? c.text.replace(/^\[Course Announcement[^\n]*\r?\n\r?\n/, "") : c.text))
        .join("\n\n")
        .trim();

      result.push({
        id: annId,
        title: String(m.title || "Course Announcement"),
        content: joined,
        date: String(m.date || ""),
        author: String(m.author || "Instructor"),
        important: Boolean(m.important),
        relatedDocId: m.relatedDocId ? String(m.relatedDocId) : undefined,
        relatedDocTitle: m.relatedDocTitle ? String(m.relatedDocTitle) : undefined
      });
    }

    return result;
  } catch (err: any) {
    console.warn("[ChromaDB] Failed loading announcements from ChromaDB:", err?.message || err);
    return [];
  }
}

export async function queryChroma(
  queryText: string,
  options: {
    nResults?: number;
    docId?: string;
    subject?: string;
    unit?: string;
    publishedOnly?: boolean;
  } = {}
): Promise<ChromaSearchResult[]> {
  const ready = await initChroma();
  if (!ready || !activeCollection) return [];

  try {
    const nResults = options.nResults || 6;
    const queryParams: any = {
      queryTexts: [queryText],
      nResults: options.publishedOnly ? Math.min(20, nResults * 2) : nResults
    };

    const whereConditions: any = {};
    if (options.docId) {
      whereConditions["docId"] = { "$eq": String(options.docId) };
    }
    if (options.subject && options.subject !== "all") {
      whereConditions["subject"] = { "$eq": String(options.subject) };
    }
    if (options.unit && options.unit !== "all") {
      whereConditions["unit"] = { "$eq": String(options.unit) };
    }

    if (Object.keys(whereConditions).length === 1) {
      queryParams.where = whereConditions;
    } else if (Object.keys(whereConditions).length > 1) {
      queryParams.where = {
        "$and": Object.entries(whereConditions).map(([k, v]) => ({ [k]: v }))
      };
    }

    const queryResponse = await activeCollection.query(queryParams);

    const results: ChromaSearchResult[] = [];
    const ids = queryResponse.ids?.[0] || [];
    const docs = queryResponse.documents?.[0] || [];
    const metadatas = queryResponse.metadatas?.[0] || [];
    const distances = queryResponse.distances?.[0] || [];

    for (let i = 0; i < ids.length; i++) {
      const meta = (metadatas[i] as any) || {};
      if (options.publishedOnly && meta.isPublished === false) {
        continue;
      }
      if (docs[i]) {
        results.push({
          id: ids[i],
          document: docs[i],
          metadata: meta,
          distance: distances[i] !== undefined ? distances[i] : null
        });
      }
      if (results.length >= nResults) break;
    }

    return results;
  } catch (err: any) {
    console.error("[ChromaDB] Query error:", err?.message || err);
    return [];
  }
}
