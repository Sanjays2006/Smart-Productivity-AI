package com.tracker.service;

import com.tracker.model.AiConversation;
import com.tracker.model.User;
import com.tracker.repository.AiConversationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * OllamaService — Calls local Ollama API (phi3) with RAG context.
 * Falls back gracefully if Ollama is not running.
 */
@Service
public class OllamaService {

    @Value("${ollama.url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:phi3}")
    private String ollamaModel;

    @Value("${ollama.embed-model:nomic-embed-text}")
    private String embedModel;

    private final RagService ragService;
    private final AiConversationRepository conversationRepository;
    private final ActivityTrackingService activityTrackingService;
    private final ActivityRecallService activityRecallService;
    private final RestTemplate restTemplate;
    private final RestTemplate embeddingRestTemplate;
    private boolean embeddingsSupported = true;

    public OllamaService(RagService ragService,
                         AiConversationRepository conversationRepository,
                         ActivityTrackingService activityTrackingService,
                         ActivityRecallService activityRecallService) {
        this.ragService = ragService;
        this.conversationRepository = conversationRepository;
        this.activityTrackingService = activityTrackingService;
        this.activityRecallService = activityRecallService;
        // 10s connect, 120s read (model may need time to load)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(120_000);
        this.restTemplate = new RestTemplate(factory);

        // Fast client for embeddings & status check (2s connect, 5s read)
        SimpleClientHttpRequestFactory embedFactory = new SimpleClientHttpRequestFactory();
        embedFactory.setConnectTimeout(2_000);
        embedFactory.setReadTimeout(5_000);
        this.embeddingRestTemplate = new RestTemplate(embedFactory);
    }

    /**
     * Main entry point: RAG retrieve → build prompt → call Ollama → persist conversation.
     */
    public Map<String, Object> askQuestion(User user, String question, String mode) {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        // Track user prompt activity
        if (user.getId() != null) {
            activityTrackingService.track(user.getId(), "CHAT", "PROMPT_SEND", "Asked AI (RAG): " + (question.length() > 60 ? question.substring(0, 57) + "..." : question), question, "rag-ask");
        }

        boolean isRecall = activityRecallService.isActivityRecallQuery(question);

        // 1. Run Hybrid RAG retrieval (bypass semantic search/online search for recall queries to prevent timeouts)
        RagService.RagResult ragResult;
        if (isRecall) {
            ragResult = new RagService.RagResult("recall", false, Collections.emptyList(), 0);
        } else {
            ragResult = ragService.retrieveHybridRag(user, question, mode);
        }

        // 2. Build enriched prompt
        String questionToUse = question;
        if (isRecall) {
            String recallContext = activityRecallService.buildRecallPromptContext(user, question);
            questionToUse = recallContext + "\nUser Query: " + question;
        }
        String prompt = ragService.buildRagPromptFromSources(questionToUse, ragResult.getSources());

        // 3. Call Ollama
        String answer;
        try {
            answer = callOllama(prompt);
        } catch (ResourceAccessException e) {
            if (activityRecallService.isActivityRecallQuery(question)) {
                answer = activityRecallService.buildOfflineRecallSummary(user, question);
            } else {
                answer = "⚠️ Ollama is not running. Please start Ollama: run `ollama serve` in your terminal, then pull the model with `ollama pull phi3`.";
            }
        } catch (Exception e) {
            if (activityRecallService.isActivityRecallQuery(question)) {
                answer = activityRecallService.buildOfflineRecallSummary(user, question);
            } else {
                answer = "⚠️ Error contacting Ollama: " + e.getMessage();
            }
        }

        // Track AI response activity
        if (user.getId() != null) {
            activityTrackingService.track(user.getId(), "CHAT", "RESPONSE_RECEIVE", "AI responded: " + (answer.length() > 60 ? answer.substring(0, 57) + "..." : answer), answer, "rag-response");
        }

        // 4. Collect sources for metadata persistence
        List<String> persistSources = (ragResult.getSources() != null ? ragResult.getSources() : Collections.<Map<String, String>>emptyList()).stream()
                .map(s -> {
                    String title = s.get("title") != null ? s.get("title") : "";
                    String url = s.get("url") != null ? s.get("url") : "";
                    return title + (url.isEmpty() ? "" : " [" + url + "]");
                })
                .distinct()
                .toList();

        // 5. Persist conversation to PostgreSQL
        AiConversation conv = new AiConversation();
        conv.setUser(user);
        conv.setQuestion(question);
        conv.setAnswer(answer);
        conv.setModelUsed(ollamaModel);
        conv.setSources(String.join("|", persistSources));
        conv.setMode(ragResult.getRetrievalMode());
        conversationRepository.save(conv);

        // 6. Build response
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("question", question);
        response.put("answer", answer);
        response.put("model", ollamaModel);
        response.put("retrievalMode", ragResult.getRetrievalMode());
        response.put("internetAvailable", ragResult.isInternetAvailable());
        response.put("retrievalTimeMs", ragResult.getRetrievalTimeMs());
        response.put("sources", ragResult.getSources());
        response.put("contextChunksUsed", ragResult.getSources().size());
        return response;
    }

    public String ask(String prompt) {
        return callOllama(prompt);
    }

    private String callOllama(String prompt) {
        String url = ollamaBaseUrl + "/api/generate";

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", ollamaModel);
        requestBody.put("prompt", prompt);
        requestBody.put("stream", false);
        requestBody.put("options", Map.of(
            "temperature", 0.3,
            "num_predict", 600,
            "top_p", 0.9
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<Map> responseEntity = restTemplate.postForEntity(url, entity, Map.class);

        if (responseEntity.getStatusCode().is2xxSuccessful() && responseEntity.getBody() != null) {
            Object responseText = responseEntity.getBody().get("response");
            return responseText != null ? responseText.toString().trim() : "No response from model.";
        }
        return "Ollama returned an unexpected response.";
    }

    /**
     * Call Ollama embeddings endpoint to get a vector representation of text.
     */
    @SuppressWarnings("unchecked")
    public List<Double> generateEmbedding(String text) {
        if (!embeddingsSupported) {
            return Collections.emptyList();
        }
        // Try new /api/embed endpoint first
        try {
            String url = ollamaBaseUrl + "/api/embed";
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", embedModel);
            requestBody.put("input", text);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> responseEntity = embeddingRestTemplate.postForEntity(url, entity, Map.class);
            if (responseEntity.getStatusCode().is2xxSuccessful() && responseEntity.getBody() != null) {
                Object embeddings = responseEntity.getBody().get("embeddings");
                if (embeddings instanceof List) {
                    List<?> list = (List<?>) embeddings;
                    if (!list.isEmpty() && list.get(0) instanceof List) {
                        return (List<Double>) list.get(0);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Ollama /api/embed failed, trying /api/embeddings fallback: " + e.getMessage());
        }

        // Fallback to legacy /api/embeddings endpoint
        try {
            String url = ollamaBaseUrl + "/api/embeddings";
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", embedModel);
            requestBody.put("prompt", text);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> responseEntity = embeddingRestTemplate.postForEntity(url, entity, Map.class);
            if (responseEntity.getStatusCode().is2xxSuccessful() && responseEntity.getBody() != null) {
                Object embedding = responseEntity.getBody().get("embedding");
                if (embedding instanceof List) {
                    return (List<Double>) embedding;
                }
            }
        } catch (Exception e) {
            System.err.println("Ollama /api/embeddings fallback failed: " + e.getMessage());
            // Since both failed/timed out, disable future attempts to prevent lagging the application thread pool
            embeddingsSupported = false;
            System.err.println("⚠️ Ollama embeddings are not supported or timed out. Disabling embedding calls and falling back to keyword similarity.");
        }

        return Collections.emptyList();
    }

    public boolean isOllamaRunning() {
        try {
            embeddingRestTemplate.getForEntity(ollamaBaseUrl + "/api/tags", String.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public List<AiConversation> getConversationHistory(User user) {
        return conversationRepository.findTop20ByUserOrderByCreatedAtDesc(user);
    }
}
