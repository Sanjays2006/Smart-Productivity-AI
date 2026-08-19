package com.tracker.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracker.model.PageChunk;
import com.tracker.model.User;
import com.tracker.repository.PageChunkRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RagService {

    private static final int CHUNK_SIZE = 600;
    private static final int MAX_CHUNKS_PER_PAGE = 10;
    private static final int TOP_K = 5;

    private final PageChunkRepository chunkRepository;
    private final OllamaService ollamaService;
    private final OnlineSearchService onlineSearchService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RagService(PageChunkRepository chunkRepository, 
                      @Lazy OllamaService ollamaService,
                      OnlineSearchService onlineSearchService) {
        this.chunkRepository = chunkRepository;
        this.ollamaService = ollamaService;
        this.onlineSearchService = onlineSearchService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingestPageContent(User user, String url, String title, String bodyText) {
        if (bodyText == null || bodyText.isBlank() || url == null) return;

        chunkRepository.deleteBySourceUrl(url);

        String cleanText = bodyText.replaceAll("\\s+", " ").trim();
        List<String> chunks = splitIntoChunks(cleanText, CHUNK_SIZE);
        int limit = Math.min(chunks.size(), MAX_CHUNKS_PER_PAGE);

        for (int i = 0; i < limit; i++) {
            saveChunk(user, url, title, chunks.get(i));
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingestNote(User user, com.tracker.model.Note note) {
        if (note == null || note.getContent() == null || note.getContent().isBlank()) return;
        
        // Remove old chunks for this note if re-saving
        String sourceId = "note:" + note.getId();
        chunkRepository.deleteBySourceUrl(sourceId);

        String title = "Note: " + (note.getTitle() != null ? note.getTitle() : "Untitled");
        saveChunk(user, sourceId, title, note.getContent());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ingestSession(User user, com.tracker.model.Session session) {
        if (session == null || session.getActivity() == null) return;

        String activityName = session.getActivity().getName();
        String notes = session.getNotes() != null ? session.getNotes() : "";
        String text = String.format("Productivity Session: %s. Duration: %d seconds. Notes: %s", 
                                    activityName, session.getDurationSeconds(), notes);
        
        String sourceId = "session:" + session.getId();
        saveChunk(user, sourceId, "Session: " + activityName, text);
    }

    private void saveChunk(User user, String url, String title, String text) {
        PageChunk chunk = new PageChunk();
        chunk.setUser(user);
        chunk.setSourceUrl(url);
        chunk.setSourceTitle(title);
        chunk.setChunkText(text);
        chunk.setVisitDate(LocalDate.now());

        // Generate semantic embedding
        List<Double> vector = ollamaService.generateEmbedding(text);
        try {
            chunk.setEmbedding(objectMapper.writeValueAsString(vector));
        } catch (Exception e) {
            chunk.setEmbedding("[]");
        }

        chunkRepository.save(chunk);
    }

    public List<PageChunk> retrieveRelevantChunks(User user, String query) {
        List<Double> queryVector = ollamaService.generateEmbedding(query);
        List<PageChunk> userChunks = chunkRepository.findByUserOrderByCreatedAtDesc(user);
        
        if (queryVector.isEmpty()) {
            // Offline TF-IDF Keyword similarity fallback
            return userChunks.stream()
                .map(chunk -> {
                    double similarity = keywordSimilarity(query, chunk.getChunkText());
                    return Map.Entry.copyOf(Map.entry(chunk, similarity));
                })
                .filter(e -> e.getValue() > 0.15)
                .sorted(Map.Entry.<PageChunk, Double>comparingByValue().reversed())
                .limit(TOP_K)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
        }

        return userChunks.stream()
                .filter(chunk -> chunk.getEmbedding() != null && !chunk.getEmbedding().equals("[]"))
                .map(chunk -> {
                    try {
                        List<Double> chunkVector = objectMapper.readValue(chunk.getEmbedding(), new TypeReference<List<Double>>() {});
                        double similarity = cosineSimilarity(queryVector, chunkVector);
                        return Map.Entry.copyOf(Map.entry(chunk, similarity));
                    } catch (Exception e) {
                        return Map.Entry.copyOf(Map.entry(chunk, 0.0));
                    }
                })
                .filter(e -> e.getValue() > 0.5) // Lowered threshold slightly for better recall
                .sorted(Map.Entry.<PageChunk, Double>comparingByValue().reversed())
                .limit(TOP_K)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    private double keywordSimilarity(String query, String chunkText) {
        if (query == null || chunkText == null || query.isBlank() || chunkText.isBlank()) return 0.0;
        
        Set<String> queryTokens = tokenize(query.toLowerCase());
        Set<String> chunkTokens = tokenize(chunkText.toLowerCase());
        
        if (queryTokens.isEmpty() || chunkTokens.isEmpty()) return 0.0;
        
        long intersection = queryTokens.stream().filter(chunkTokens::contains).count();
        double norm1 = Math.sqrt(queryTokens.size());
        double norm2 = Math.sqrt(chunkTokens.size());
        
        if (norm1 == 0 || norm2 == 0) return 0.0;
        
        return (double) intersection / (norm1 * norm2);
    }
    
    private Set<String> tokenize(String text) {
        String[] words = text.replaceAll("[^a-zA-Z0-9\\s]", "").split("\\s+");
        Set<String> tokens = new HashSet<>();
        for (String w : words) {
            if (w.length() > 2 && !isStopWord(w)) {
                tokens.add(w);
            }
        }
        return tokens;
    }
    
    private boolean isStopWord(String word) {
        return Set.of("the", "and", "a", "of", "to", "in", "is", "that", "it", "on", "for", "with", "as", "at", "by", "an", "this", "what", "how", "why", "who", "where").contains(word);
    }

    public String buildRagPrompt(String question, List<PageChunk> chunks) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are FocusAI, a premium productivity and study assistant. ");
        sb.append("Use the following context from the user's browsing history to provide a highly accurate, professional, and personalized answer.\n\n");

        if (!chunks.isEmpty()) {
            sb.append("--- CONTEXTUAL KNOWLEDGE ---\n");
            for (int i = 0; i < chunks.size(); i++) {
                PageChunk c = chunks.get(i);
                sb.append(String.format("[%d] SOURCE: %s\nCONTENT: %s\n\n",
                    i + 1,
                    c.getSourceTitle() != null ? c.getSourceTitle() : c.getSourceUrl(),
                    c.getChunkText()));
            }
            sb.append("--- END OF CONTEXT ---\n\n");
            sb.append("Answer the user's question based on the provided context. If the context doesn't contain the answer, use your general knowledge but mention the context was insufficient.\n\n");
        }

        sb.append("User Question: ").append(question).append("\n\n");
        sb.append("FocusAI Response:");
        return sb.toString();
    }

    private double cosineSimilarity(List<Double> vec1, List<Double> vec2) {
        if (vec1.size() != vec2.size() || vec1.isEmpty()) return 0;
        double dotProduct = 0.0;
        double norm1 = 0.0;
        double norm2 = 0.0;
        for (int i = 0; i < vec1.size(); i++) {
            dotProduct += vec1.get(i) * vec2.get(i);
            norm1 += Math.pow(vec1.get(i), 2);
            norm2 += Math.pow(vec2.get(i), 2);
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    private List<String> splitIntoChunks(String text, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        int len = text.length();
        for (int i = 0; i < len; i += chunkSize) {
            chunks.add(text.substring(i, Math.min(i + chunkSize, len)));
        }
        return chunks;
    }

    public static class RagResult {
        private final String retrievalMode;
        private final boolean internetAvailable;
        private final List<Map<String, String>> sources;
        private final long retrievalTimeMs;

        public RagResult(String retrievalMode, boolean internetAvailable, List<Map<String, String>> sources, long retrievalTimeMs) {
            this.retrievalMode = retrievalMode;
            this.internetAvailable = internetAvailable;
            this.sources = sources;
            this.retrievalTimeMs = retrievalTimeMs;
        }

        public String getRetrievalMode() { return retrievalMode; }
        public boolean isInternetAvailable() { return internetAvailable; }
        public List<Map<String, String>> getSources() { return sources; }
        public long getRetrievalTimeMs() { return retrievalTimeMs; }
    }

    /**
     * Convert a locally-stored PageChunk into a normalized RAG "source" map,
     * scoring it against the query (cosine on the embedding, keyword fallback).
     */
    private Map<String, String> mapLocalChunk(PageChunk chunk, String query, List<Double> queryVector) {
        Map<String, String> s = new HashMap<>();
        String title = chunk.getSourceTitle() != null ? chunk.getSourceTitle() : "Local Document";
        String url   = chunk.getSourceUrl()   != null ? chunk.getSourceUrl()   : "";

        s.put("title", title);
        s.put("sourceTitle", title);
        s.put("url", url);
        s.put("sourceUrl", url);
        s.put("snippet", chunk.getChunkText());
        s.put("chunkText", chunk.getChunkText());
        s.put("type", "local");

        double similarity = 0.0;
        if (queryVector != null && !queryVector.isEmpty()
                && chunk.getEmbedding() != null && !chunk.getEmbedding().equals("[]")) {
            try {
                List<Double> chunkVector =
                    objectMapper.readValue(chunk.getEmbedding(), new TypeReference<List<Double>>() {});
                similarity = cosineSimilarity(queryVector, chunkVector);
            } catch (Exception ignored) {}
        }
        if (similarity <= 0.0) {
            similarity = keywordSimilarity(query, chunk.getChunkText());
        }
        s.put("similarity", String.format(Locale.US, "%.4f", similarity));
        return s;
    }

    public RagResult retrieveHybridRag(User user, String query, String requestMode) {
        long startTime = System.currentTimeMillis();
        boolean internet = onlineSearchService.isInternetAvailable();
        String activeMode = requestMode == null ? "hybrid" : requestMode.toLowerCase().trim();

        List<Map<String, String>> combinedSources = new ArrayList<>();

        // If client requested ONLINE or HYBRID, but internet is down, automatically fallback to OFFLINE
        if ((activeMode.equals("online") || activeMode.equals("hybrid")) && !internet) {
            activeMode = "offline_fallback";
        }

        List<Double> queryVector = null;
        if (activeMode.equals("offline") || activeMode.equals("offline_fallback") || activeMode.equals("hybrid")) {
            queryVector = ollamaService.generateEmbedding(query);
        }

        if (activeMode.equals("offline") || activeMode.equals("offline_fallback")) {
            // Retrieve local chunks
            List<PageChunk> localChunks = retrieveRelevantChunks(user, query);
            for (PageChunk chunk : localChunks) {
                combinedSources.add(mapLocalChunk(chunk, query, queryVector));
            }
        } else if (activeMode.equals("online")) {
            // Retrieve online sources
            List<Map<String, String>> onlineResults = onlineSearchService.searchOnline(query);
            for (int i = 0; i < onlineResults.size(); i++) {
                Map<String, String> res = onlineResults.get(i);
                Map<String, String> s = new HashMap<>();
                String title = res.get("title");
                String url = res.get("url");
                String snippet = res.get("snippet");
                s.put("title", title);
                s.put("sourceTitle", title);
                s.put("url", url);
                s.put("sourceUrl", url);
                s.put("snippet", snippet);
                s.put("chunkText", snippet);
                s.put("type", "online");

                double sim = Math.max(0.0, 0.95 - 0.07 * i);
                s.put("similarity", String.format(Locale.US, "%.4f", sim));

                combinedSources.add(s);
            }
        } else { // hybrid
            // Retrieve local chunks
            List<PageChunk> localChunks = retrieveRelevantChunks(user, query);
            for (PageChunk chunk : localChunks) {
                combinedSources.add(mapLocalChunk(chunk, query, queryVector));
            }
            // Retrieve online sources
            List<Map<String, String>> onlineResults = onlineSearchService.searchOnline(query);
            for (int i = 0; i < onlineResults.size(); i++) {
                Map<String, String> res = onlineResults.get(i);
                Map<String, String> s = new HashMap<>();
                String title = res.get("title");
                String url = res.get("url");
                String snippet = res.get("snippet");
                s.put("title", title);
                s.put("sourceTitle", title);
                s.put("url", url);
                s.put("sourceUrl", url);
                s.put("snippet", snippet);
                s.put("chunkText", snippet);
                s.put("type", "online");

                double sim = Math.max(0.0, 0.95 - 0.07 * i);
                s.put("similarity", String.format(Locale.US, "%.4f", sim));

                combinedSources.add(s);
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        return new RagResult(activeMode, internet, combinedSources, duration);
    }

    public String buildRagPromptFromSources(String question, List<Map<String, String>> sources) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are FocusAI, a premium productivity and study assistant. ");
        sb.append("Use the following context from the user's local database and online search sources to provide a highly accurate, professional, and personalized answer.\n\n");

        if (sources != null && !sources.isEmpty()) {
            sb.append("--- CONTEXTUAL KNOWLEDGE ---\n");
            for (int i = 0; i < sources.size(); i++) {
                Map<String, String> s = sources.get(i);
                sb.append(String.format("[%d] SOURCE (%s): %s\nURL: %s\nCONTENT: %s\n\n",
                    i + 1,
                    s.getOrDefault("type", "local").toUpperCase(),
                    s.get("title"),
                    s.get("url"),
                    s.get("snippet")));
            }
            sb.append("--- END OF CONTEXT ---\n\n");
            sb.append("Answer the user's question based on the provided context. If the context doesn't contain the answer, use your general knowledge but mention the context was insufficient.\n\n");
        }

        sb.append("User Question: ").append(question).append("\n\n");
        sb.append("FocusAI Response:");
        return sb.toString();
    }
}
