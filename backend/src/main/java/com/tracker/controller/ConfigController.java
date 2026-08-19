package com.tracker.controller;

import com.tracker.TrackerApplication;
import com.tracker.config.DataSourceConfig;
import com.tracker.security.EncryptionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.FileOutputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * ConfigController — Handles runtime database setup, connection tests, catalog provisioning,
 * and triggers programmatic hot-reloads of the Spring Application Context.
 */
@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        boolean configured = DataSourceConfig.isDatabaseConfigured();
        status.put("configured", configured);
        status.put("database", DataSourceConfig.getActiveDatabase());
        
        File configFile = new File("data/postgres-config.properties");
        boolean exists = configFile.exists();
        status.put("configFileExists", exists);
        
        if (exists && !configured) {
            status.put("error", "Failed to connect to local PostgreSQL using saved configuration. Please check your service, host, and credentials.");
        }
        return ResponseEntity.ok(status);
    }

    @PostMapping("/setup")
    public ResponseEntity<Map<String, Object>> setupDatabase(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new LinkedHashMap<>();
        
        String host = request.getOrDefault("host", "localhost").trim();
        String portStr = request.getOrDefault("port", "5432").trim();
        String dbName = request.getOrDefault("dbName", "focusai_db").trim();
        String username = request.getOrDefault("username", "postgres").trim();
        String password = request.getOrDefault("password", "").trim();

        if (host.isEmpty() || portStr.isEmpty() || dbName.isEmpty() || username.isEmpty()) {
            response.put("success", false);
            response.put("error", "All fields except password are required.");
            return ResponseEntity.badRequest().body(response);
        }

        int port;
        try {
            port = Integer.parseInt(portStr);
        } catch (NumberFormatException e) {
            response.put("success", false);
            response.put("error", "Invalid port number.");
            return ResponseEntity.badRequest().body(response);
        }

        try {
            // 1. Establish initial check link to default 'postgres' catalog catalog to auto-create target db
            System.out.println("🔗 Linking to default postgres catalog for database verification...");
            ensureTargetDatabaseExists(host, port, dbName, username, password);

            // 2. Validate full link capability to the newly created/existing target database
            String targetJdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + dbName;
            System.out.println("🧪 Testing link to target database: " + targetJdbcUrl);
            validateTargetLink(targetJdbcUrl, username, password);

            // 3. Encrypt password using AES-128 and write configuration locally
            System.out.println("🔒 Connection verified! Securely saving encrypted PostgreSQL properties locally...");
            saveSecureConfig(host, portStr, dbName, username, password);

            // 4. Respond with hot-reload signal
            response.put("success", true);
            response.put("message", "Database successfully configured! Initializing neural components and reloading cores...");
            
            // 5. Trigger programmatic hot-reload on separate thread to allow HTTP response to flush first
            TrackerApplication.restart();

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("❌ Database Onboarding Failed: " + e.getMessage());
            response.put("success", false);
            response.put("error", e.getMessage() != null ? e.getMessage() : "Unknown connection error.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    private void ensureTargetDatabaseExists(String host, int port, String dbName, String username, String password) throws Exception {
        String baseLinkUrl = "jdbc:postgresql://" + host + ":" + port + "/postgres";
        Class.forName("org.postgresql.Driver");
        
        DriverManager.setLoginTimeout(4); // 4-second timeout for initial connection check

        try (Connection conn = DriverManager.getConnection(baseLinkUrl, username, password)) {
            // Check if target database already exists
            String checkQuery = "SELECT 1 FROM pg_database WHERE datname = ?";
            try (PreparedStatement pstmt = conn.prepareStatement(checkQuery)) {
                pstmt.setString(1, dbName);
                try (ResultSet rs = pstmt.executeQuery()) {
                    if (!rs.next()) {
                        System.out.println("🛠️ Database '" + dbName + "' not found. Automatically provisioning target catalog...");
                        // CREATE DATABASE cannot be executed within a transaction, run dynamically as Statement
                        String createSql = "CREATE DATABASE " + dbName;
                        try (Statement stmt = conn.createStatement()) {
                            stmt.executeUpdate(createSql);
                            System.out.println("🎉 Database '" + dbName + "' successfully provisioned!");
                        }
                    } else {
                        System.out.println("ℹ️ Target database '" + dbName + "' already exists.");
                    }
                }
            }
        } catch (Exception e) {
            throw new Exception("Authentication failed on postgres catalog: " + e.getMessage());
        }
    }

    private void validateTargetLink(String url, String user, String password) throws Exception {
        DriverManager.setLoginTimeout(3);
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            if (!conn.isValid(3)) {
                throw new Exception("Connection link is invalid or timed out.");
            }
        } catch (Exception e) {
            throw new Exception("Failed to establish secure link to target database: " + e.getMessage());
        }
    }

    private void saveSecureConfig(String host, String port, String dbName, String username, String password) throws Exception {
        File dataDir = new File("data");
        if (!dataDir.exists()) dataDir.mkdirs();

        File configFile = new File(dataDir, "postgres-config.properties");
        Properties props = new Properties();
        props.setProperty("db.host", host);
        props.setProperty("db.port", port);
        props.setProperty("db.name", dbName);
        props.setProperty("db.username", username);
        
        // Encrypt the password using AES-128 before saving
        String encryptedPassword = EncryptionUtils.encrypt(password);
        props.setProperty("db.password", encryptedPassword != null ? encryptedPassword : "");

        try (FileOutputStream fos = new FileOutputStream(configFile)) {
            props.store(fos, "FocusAI PostgreSQL Database Configuration (Encrypted Key)");
        }
    }
}
