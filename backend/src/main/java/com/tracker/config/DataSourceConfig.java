package com.tracker.config;

import com.tracker.security.EncryptionUtils;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.io.File;
import java.io.FileInputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

/**
 * DataSourceConfig — Programmatic datasource factory.
 * Resolves PostgreSQL dynamically from saved secure properties;
 * falls back seamlessly to H2 embedded database on connection failures to enable Setup Mode.
 */
@Configuration
public class DataSourceConfig {

    private static boolean databaseConfigured = false;
    private static String activeDatabase = "h2";

    public static boolean isDatabaseConfigured() {
        return databaseConfigured;
    }

    public static String getActiveDatabase() {
        return activeDatabase;
    }

    @Bean
    @Primary
    public DataSource dataSource() {
        File configFile = new File("data/postgres-config.properties");
        if (configFile.exists()) {
            try {
                Properties props = new Properties();
                try (FileInputStream fis = new FileInputStream(configFile)) {
                    props.load(fis);
                }

                String host = props.getProperty("db.host", "localhost");
                String port = props.getProperty("db.port", "5432");
                String dbName = props.getProperty("db.name");
                String username = props.getProperty("db.username");
                String encPassword = props.getProperty("db.password");
                String password = EncryptionUtils.decrypt(encPassword);

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + dbName;

                // Validate connection with a tight 3-second timeout
                if (testConnection(jdbcUrl, username, password)) {
                    System.out.println("🟢 Successfully connected to local PostgreSQL database: " + jdbcUrl);
                    HikariConfig config = new HikariConfig();
                    config.setJdbcUrl(jdbcUrl);
                    config.setUsername(username);
                    config.setPassword(password);
                    config.setDriverClassName("org.postgresql.Driver");
                    
                    // Production-ready connection pool sizing
                    config.setMaximumPoolSize(10);
                    config.setMinimumIdle(2);
                    config.setIdleTimeout(30000);
                    config.setConnectionTimeout(3000);

                    databaseConfigured = true;
                    activeDatabase = "postgresql";
                    return new HikariDataSource(config);
                } else {
                    System.err.println("⚠️ Local PostgreSQL is unreachable. Gracefully falling back to H2 (Setup Mode)...");
                }
            } catch (Exception e) {
                System.err.println("⚠️ Failed to parse PostgreSQL properties: " + e.getMessage() + ". Falling back to H2.");
            }
        } else {
            System.out.println("ℹ️ PostgreSQL database configuration file not found. Bootstrapping with H2 fallback.");
        }

        // Graceful Bootstrap Fallback: Embedded H2
        System.out.println("🤖 Booting temporary fallback embedded H2 database (Setup Wizard Active)...");
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:file:./data/focusai;DB_CLOSE_ON_EXIT=FALSE");
        config.setUsername("sa");
        config.setPassword("");
        config.setDriverClassName("org.h2.Driver");
        config.setMaximumPoolSize(5);

        databaseConfigured = false;
        activeDatabase = "h2";
        return new HikariDataSource(config);
    }

    private boolean testConnection(String url, String user, String password) {
        try {
            Class.forName("org.postgresql.Driver");
            DriverManager.setLoginTimeout(3); // 3-second network login timeout
            try (Connection conn = DriverManager.getConnection(url, user, password)) {
                return conn.isValid(3);
            }
        } catch (Exception e) {
            return false;
        }
    }
}
