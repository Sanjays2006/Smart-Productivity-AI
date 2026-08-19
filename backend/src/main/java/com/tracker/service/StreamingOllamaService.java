package com.tracker.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * StreamingOllamaService — calls Ollama with stream=true,
 * reads NDJSON line-by-line, and invokes the token callback for each token.
 */
@Service
public class StreamingOllamaService {

    @Value("${ollama.url:http://localhost:11434}")
    private String ollamaBaseUrl;

    @Value("${ollama.model:phi3}")
    private String ollamaModel;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Streams an Ollama response, calling {@code tokenCallback} for each generated token.
     * Blocks until streaming is complete.
     */
    public void streamResponse(String prompt, Consumer<String> tokenCallback) throws Exception {
        String urlStr = ollamaBaseUrl + "/api/generate";

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", ollamaModel);
        requestBody.put("prompt", prompt);
        requestBody.put("stream", true);
        requestBody.put("options", Map.of(
            "temperature", 0.7,
            "num_predict", 1024,
            "top_p", 0.9,
            "num_ctx", 4096
        ));

        String jsonBody = objectMapper.writeValueAsString(requestBody);

        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(180_000);
        conn.setDoOutput(true);

        // Write request body
        conn.getOutputStream().write(jsonBody.getBytes());
        conn.getOutputStream().flush();

        int status = conn.getResponseCode();
        if (status != 200) {
            String err = conn.getErrorStream() != null ? new String(conn.getErrorStream().readAllBytes()) : "HTTP error " + status;
            throw new RuntimeException("Ollama error " + status + ": " + err);
        }

        // Read NDJSON stream line by line
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                try {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> parsed = objectMapper.readValue(line, Map.class);
                    String token = (String) parsed.get("response");
                    Boolean done = (Boolean) parsed.get("done");
                    if (token != null && !token.isEmpty()) {
                        tokenCallback.accept(token);
                    }
                    if (Boolean.TRUE.equals(done)) break;
                } catch (Exception parseEx) {
                    // Skip malformed lines
                }
            }
        } finally {
            conn.disconnect();
        }
    }

    /** Quick non-streaming check if Ollama is reachable */
    public boolean isRunning() {
        try {
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(3000);
            factory.setReadTimeout(3000);
            RestTemplate rt = new RestTemplate(factory);
            rt.getForEntity(ollamaBaseUrl + "/api/tags", String.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String getModel() { return ollamaModel; }
}
